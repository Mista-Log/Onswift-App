import io
from unittest.mock import patch

import requests
from django.test import SimpleTestCase

from agent.providers.base import (
    Done,
    ProviderAuthError,
    ProviderBadRequest,
    ProviderBadResponse,
    ProviderModelNotFound,
    ProviderRateLimited,
    ProviderStreamInterrupted,
    ProviderTimeout,
    ProviderUnavailable,
    TextDelta,
    ToolCall,
    Usage,
)
from agent.providers.fake import FakeProvider
from agent.providers.openai_compat import OpenAICompatProvider

from . import fixtures as fx

URL = "https://llm.test/v1/chat/completions"
KEY = "SECRET-KEY-123"
MESSAGES = [{"role": "user", "content": "hi"}]


class FakeResponse:
    """Stands in for a streamed requests.Response."""

    def __init__(self, status=200, body="", headers=None, fail_after=None):
        self.status_code = status
        self.text = body
        self.headers = headers or {}
        self._lines = body.split("\n") if body else []
        self._fail_after = fail_after  # raise a connection error once this many lines were read
        self.closed = False

    def iter_lines(self, decode_unicode=False):
        for i, line in enumerate(self._lines):
            if self._fail_after is not None and i >= self._fail_after:
                raise requests.exceptions.ChunkedEncodingError("connection reset")
            yield line

    def close(self):
        self.closed = True


def make_provider(**overrides):
    sleeps = []
    kwargs = dict(
        base_url="https://llm.test/v1",
        api_key=KEY,
        model="primary",
        fallback_model="backup",
        max_attempts=2,
        backoff_base=0.5,
        sleep=sleeps.append,
    )
    kwargs.update(overrides)
    return OpenAICompatProvider(**kwargs), sleeps


def run(provider, *responses, messages=None, **stream_kwargs):
    """Drain provider.stream() with requests.post mocked to return `responses` in order."""
    with patch("agent.providers.openai_compat.requests.post", side_effect=list(responses)) as post:
        events = list(provider.stream(messages or MESSAGES, **stream_kwargs))
    return events, post


class Utf8DecodingTests(SimpleTestCase):
    """Uses a real requests.Response: the fakes skip the decoding step where this bug lived."""

    def _real_response(self, body: bytes, content_type):
        response = requests.Response()
        response.status_code = 200
        response.raw = io.BytesIO(body)
        if content_type:
            response.headers["Content-Type"] = content_type
        return response

    def test_stream_without_a_charset_is_read_as_utf8(self):
        sse = (
            'data: {"choices":[{"delta":{"content":"Logo — Done"},"finish_reason":null}]}\n\n'
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
            "data: [DONE]\n\n"
        ).encode("utf-8")
        provider, _ = make_provider()
        events, _ = run(provider, self._real_response(sse, "text/event-stream"))
        self.assertEqual(events[0], TextDelta("Logo — Done"))  # not "Logo â\x80\x94 Done"


class StreamParsingTests(SimpleTestCase):
    def test_text_stream_yields_text_usage_then_done(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_TEXT))
        self.assertEqual(events, [
            TextDelta("one, two, three, four, five, six, seven, eight, nine, ten"),
            Usage(prompt_tokens=15, completion_tokens=19, total_tokens=238),  # once, not summed
            Done("stop", {"google": {"thought_signature": fx.SIG_TEXT}}),
        ])

    def test_usage_takes_the_last_value_when_it_grows_across_chunks(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_USAGE_GROWS))
        usage = [e for e in events if isinstance(e, Usage)]
        self.assertEqual(usage, [Usage(prompt_tokens=5, completion_tokens=4, total_tokens=9)])  # not 5, not 14

    def test_tool_call_in_one_chunk_is_detected_even_though_finish_reason_is_stop(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_TOOL_SINGLE))
        self.assertEqual(events, [
            ToolCall(id="call_709781", name="list_deadlines", arguments={"days": 7}, raw=fx.TOOL_CALL_RAW),
            Done("stop", None),
        ])

    def test_thought_signature_is_kept_verbatim_in_raw(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_TOOL_SINGLE))
        call = events[0]
        self.assertEqual(call.raw["extra_content"], {"google": {"thought_signature": fx.SIG_TOOL}})

    def test_fragmented_arguments_and_parallel_calls_are_reassembled_in_index_order(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_TOOL_FRAGMENTED))
        calls = [e for e in events if isinstance(e, ToolCall)]
        self.assertEqual([(c.id, c.name, c.arguments) for c in calls], [
            ("call_a", "list_deadlines", {"days": 7}),
            ("call_b", "list_projects", {}),
        ])
        self.assertEqual(calls[0].raw["function"]["arguments"], '{"days": 7}')  # original string kept
        self.assertEqual(events[-2:], [Usage(30, 10, 40), Done("tool_calls", None)])

    def test_parallel_calls_without_index_do_not_collide(self):
        provider, _ = make_provider()
        events, _ = run(provider, FakeResponse(200, fx.STREAM_TOOL_NO_INDEX_PARALLEL))
        calls = [e for e in events if isinstance(e, ToolCall)]
        self.assertEqual([(c.id, c.name, c.arguments) for c in calls], [
            ("call_x", "list_deadlines", {"days": 3}),
            ("call_y", "list_projects", {}),
        ])

    def test_invalid_tool_arguments_raise_bad_response(self):
        provider, _ = make_provider()
        with self.assertRaises(ProviderBadResponse):
            run(provider, FakeResponse(200, fx.STREAM_BAD_TOOL_ARGS))

    def test_malformed_chunk_raises_bad_response(self):
        provider, _ = make_provider()
        with self.assertRaises(ProviderBadResponse):
            run(provider, FakeResponse(200, fx.STREAM_MALFORMED))

    def test_stream_cut_without_done_or_finish_reason_raises_interrupted(self):
        provider, _ = make_provider()
        with self.assertRaises(ProviderStreamInterrupted):
            run(provider, FakeResponse(200, fx.STREAM_TRUNCATED))

    def test_connection_dropped_mid_stream_is_not_retried(self):
        provider, _ = make_provider()
        response = FakeResponse(200, fx.STREAM_TEXT, fail_after=2)
        with patch("agent.providers.openai_compat.requests.post", side_effect=[response]) as post:
            stream = provider.stream(MESSAGES)
            self.assertIsInstance(next(stream), TextDelta)  # text already reached the caller...
            with self.assertRaises(ProviderStreamInterrupted):
                next(stream)
        self.assertEqual(post.call_count, 1)  # ...so retrying would duplicate output
        self.assertTrue(response.closed)

    def test_response_is_closed_after_a_normal_stream(self):
        provider, _ = make_provider()
        response = FakeResponse(200, fx.STREAM_TEXT)
        run(provider, response)
        self.assertTrue(response.closed)


class RequestShapeTests(SimpleTestCase):
    def test_payload_headers_url_and_timeout(self):
        provider, _ = make_provider(connect_timeout=10, read_timeout=30)
        tools = [{"type": "function", "function": {"name": "list_deadlines", "parameters": {"type": "object"}}}]
        _, post = run(provider, FakeResponse(200, fx.STREAM_TEXT), tools=tools, system="SYS")
        args, kwargs = post.call_args
        self.assertEqual(args[0], URL)
        self.assertEqual(kwargs["headers"]["Authorization"], f"Bearer {KEY}")
        self.assertEqual(kwargs["timeout"], (10, 30))
        self.assertTrue(kwargs["stream"])
        self.assertEqual(kwargs["json"], {
            "model": "primary",
            "messages": [{"role": "system", "content": "SYS"}, *MESSAGES],
            "stream": True,
            "stream_options": {"include_usage": True},
            "tools": tools,
            "tool_choice": "auto",
        })

    def test_no_tools_and_no_system_omit_those_keys(self):
        provider, _ = make_provider()
        _, post = run(provider, FakeResponse(200, fx.STREAM_TEXT))
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["messages"], MESSAGES)
        self.assertNotIn("tools", body)
        self.assertNotIn("tool_choice", body)

    def test_reasoning_effort_is_sent_only_when_configured(self):
        provider, _ = make_provider(reasoning_effort="low")
        _, post = run(provider, FakeResponse(200, fx.STREAM_TEXT))
        self.assertEqual(post.call_args.kwargs["json"]["reasoning_effort"], "low")
        provider, _ = make_provider()
        _, post = run(provider, FakeResponse(200, fx.STREAM_TEXT))
        self.assertNotIn("reasoning_effort", post.call_args.kwargs["json"])

    def test_replayed_assistant_tool_call_and_tool_result_pass_through_unchanged(self):
        history = [
            {"role": "user", "content": "what is due?"},
            {"role": "assistant", "content": None, "tool_calls": [fx.TOOL_CALL_RAW]},
            {"role": "tool", "tool_call_id": "call_709781", "content": '[{"task":"x"}]'},
        ]
        provider, _ = make_provider()
        _, post = run(provider, FakeResponse(200, fx.STREAM_TEXT), messages=history, system="SYS")
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent[1:], history)  # thought_signature intact
        self.assertEqual(
            sent[2]["tool_calls"][0]["extra_content"]["google"]["thought_signature"], fx.SIG_TOOL
        )


class ErrorHandlingTests(SimpleTestCase):
    def test_503_then_success_retries_same_model_with_backoff(self):
        provider, sleeps = make_provider()
        events, post = run(provider, FakeResponse(503, fx.ERR_503), FakeResponse(200, fx.STREAM_TEXT))
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual(post.call_count, 2)
        self.assertEqual([c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "primary"])
        self.assertEqual(len(sleeps), 1)
        self.assertTrue(0.5 <= sleeps[0] <= 1.0)  # base * 2**0 plus up to `base` of jitter

    def test_repeated_503_switches_to_fallback_model(self):
        provider, _ = make_provider()
        events, post = run(
            provider, FakeResponse(503, fx.ERR_503), FakeResponse(503, fx.ERR_503),
            FakeResponse(200, fx.STREAM_TEXT),
        )
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual(
            [c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "primary", "backup"]
        )

    def test_repeated_503_without_fallback_raises_unavailable_after_capped_attempts(self):
        provider, _ = make_provider(fallback_model=None)
        with patch("agent.providers.openai_compat.requests.post",
                   side_effect=[FakeResponse(503, fx.ERR_503)] * 5) as post:
            with self.assertRaises(ProviderUnavailable):
                list(provider.stream(MESSAGES))
        self.assertEqual(post.call_count, 2)  # max_attempts, because failed calls burn free-tier quota

    def test_long_retry_delay_is_not_slept_inside_the_request(self):
        provider, sleeps = make_provider(fallback_model=None)
        with patch("agent.providers.openai_compat.requests.post",
                   side_effect=[FakeResponse(429, fx.ERR_429_LONG)]) as post:
            with self.assertRaises(ProviderRateLimited) as ctx:
                list(provider.stream(MESSAGES))
        self.assertEqual(ctx.exception.retry_after, 37.0)
        self.assertEqual(sleeps, [])
        self.assertEqual(post.call_count, 1)

    def test_long_retry_delay_goes_straight_to_fallback_model(self):
        provider, sleeps = make_provider()
        events, post = run(provider, FakeResponse(429, fx.ERR_429_LONG), FakeResponse(200, fx.STREAM_TEXT))
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual(sleeps, [])
        self.assertEqual([c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "backup"])

    def test_short_retry_delay_is_honoured_then_retried_on_same_model(self):
        provider, sleeps = make_provider()
        events, post = run(provider, FakeResponse(429, fx.ERR_429_SHORT), FakeResponse(200, fx.STREAM_TEXT))
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual(sleeps, [2.0])
        self.assertEqual([c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "primary"])

    def test_retry_after_header_is_used_when_the_body_has_none(self):
        provider, sleeps = make_provider()
        run(provider, FakeResponse(429, fx.ERR_503, headers={"Retry-After": "3"}),
            FakeResponse(200, fx.STREAM_TEXT))
        self.assertEqual(sleeps, [3.0])

    def test_model_not_found_falls_back_without_retrying_the_primary(self):
        provider, _ = make_provider()
        events, post = run(provider, FakeResponse(404, fx.ERR_404), FakeResponse(200, fx.STREAM_TEXT))
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual([c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "backup"])

    def test_model_not_found_without_fallback_names_the_env_var_to_change(self):
        provider, _ = make_provider(fallback_model=None)
        with patch("agent.providers.openai_compat.requests.post",
                   side_effect=[FakeResponse(404, fx.ERR_404)]) as post:
            with self.assertRaises(ProviderModelNotFound) as ctx:
                list(provider.stream(MESSAGES))
        self.assertIn("AGENT_LLM_MODEL", str(ctx.exception))
        self.assertIn("primary", str(ctx.exception))
        self.assertEqual(post.call_count, 1)

    def test_bad_key_is_an_auth_error_with_no_retry_and_never_leaks_the_key(self):
        provider, _ = make_provider()
        with patch("agent.providers.openai_compat.requests.post",
                   side_effect=[FakeResponse(400, fx.ERR_400_KEY)]) as post:
            with self.assertRaises(ProviderAuthError) as ctx:
                list(provider.stream(MESSAGES))
        self.assertEqual(post.call_count, 1)
        self.assertNotIn(KEY, str(ctx.exception))
        self.assertIn("AGENT_LLM_API_KEY", str(ctx.exception))

    def test_401_and_403_are_auth_errors(self):
        for status in (401, 403):
            provider, _ = make_provider()
            with self.subTest(status=status):
                with self.assertRaises(ProviderAuthError):
                    run(provider, FakeResponse(status, fx.ERR_503))

    def test_other_400_is_a_bad_request_with_the_provider_message_and_no_retry(self):
        provider, _ = make_provider()
        with patch("agent.providers.openai_compat.requests.post",
                   side_effect=[FakeResponse(400, fx.ERR_400_OTHER)]) as post:
            with self.assertRaises(ProviderBadRequest) as ctx:
                list(provider.stream(MESSAGES))
        self.assertIn("Unsupported parameter", str(ctx.exception))
        self.assertEqual(post.call_count, 1)

    def test_read_timeouts_retry_then_use_the_fallback(self):
        provider, sleeps = make_provider()
        events, post = run(
            provider, requests.exceptions.ReadTimeout(), requests.exceptions.ReadTimeout(),
            FakeResponse(200, fx.STREAM_TEXT),
        )
        self.assertIsInstance(events[0], TextDelta)
        self.assertEqual(
            [c.kwargs["json"]["model"] for c in post.call_args_list], ["primary", "primary", "backup"]
        )
        self.assertEqual(len(sleeps), 1)

    def test_timeouts_without_fallback_raise_timeout(self):
        provider, _ = make_provider(fallback_model=None)
        with self.assertRaises(ProviderTimeout):
            run(provider, requests.exceptions.ReadTimeout(), requests.exceptions.ReadTimeout())

    def test_network_errors_raise_unavailable(self):
        provider, _ = make_provider(fallback_model=None)
        with self.assertRaises(ProviderUnavailable):
            run(provider, requests.exceptions.ConnectionError(), requests.exceptions.ConnectionError())

    def test_error_responses_are_closed(self):
        provider, _ = make_provider(fallback_model=None)
        response = FakeResponse(400, fx.ERR_400_OTHER)
        with self.assertRaises(ProviderBadRequest):
            run(provider, response)
        self.assertTrue(response.closed)


class FakeProviderTests(SimpleTestCase):
    def test_replays_scripted_turns_and_records_calls(self):
        events = [TextDelta("hi"), Done("stop")]
        fake = FakeProvider([events])
        self.assertEqual(list(fake.stream(MESSAGES, tools=[{"x": 1}], system="SYS")), events)
        self.assertEqual(fake.calls, [{"messages": MESSAGES, "tools": [{"x": 1}], "system": "SYS"}])

    def test_scripted_exception_is_raised(self):
        fake = FakeProvider([ProviderUnavailable("down")])
        with self.assertRaises(ProviderUnavailable):
            list(fake.stream(MESSAGES))

    def test_calling_more_often_than_scripted_fails_loudly(self):
        fake = FakeProvider([])
        with self.assertRaises(AssertionError):
            list(fake.stream(MESSAGES))
