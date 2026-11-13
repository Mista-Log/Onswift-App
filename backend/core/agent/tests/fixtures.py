"""Raw SSE and error bodies for the provider unit tests.

STREAM_TEXT and STREAM_TOOL_SINGLE reproduce the exact shape captured from Gemini
(gemini-3.5-flash) during the Phase 0 spike, with the opaque thought_signature blobs shortened to
placeholders. The rest are hand-written edge cases. Synthetic prompts only; no keys or headers.

Two quirks of the real Gemini stream that the adapter must handle:
  * a whole tool call arrives in ONE chunk and the final finish_reason is "stop", not "tool_calls"
  * tool_call items carry no `index` field
"""
import json

SIG_TEXT = "SIG_TEXT_PLACEHOLDER"
SIG_TOOL = "SIG_TOOL_PLACEHOLDER"


def sse(*chunks, done=True):
    """Build an SSE body. Each chunk is a dict (JSON-encoded) or a raw string."""
    parts = [
        "data: " + (c if isinstance(c, str) else json.dumps(c, separators=(",", ":")))
        for c in chunks
    ]
    if done:
        parts.append("data: [DONE]")
    return "\n\n".join(parts) + "\n\n"


def chunk(delta, finish_reason=None, usage=None):
    body = {
        "choices": [{"delta": delta, "index": 0}],
        "created": 1793288777,
        "id": "chatcmpl-test",
        "model": "test-model",
        "object": "chat.completion.chunk",
    }
    if finish_reason:
        body["choices"][0]["finish_reason"] = finish_reason
    if usage:
        body["usage"] = usage
    return body


USAGE_TEXT = {"completion_tokens": 19, "prompt_tokens": 15, "total_tokens": 238}

# Real shape: usage repeated on two chunks (must be recorded once, not summed), signature on the
# message-level extra_content of the closing chunk.
STREAM_TEXT = sse(
    chunk(
        {"content": "one, two, three, four, five, six, seven, eight, nine, ten", "role": "assistant"},
        usage=USAGE_TEXT,
    ),
    chunk(
        {"extra_content": {"google": {"thought_signature": SIG_TEXT}}, "role": "assistant"},
        finish_reason="stop",
        usage=USAGE_TEXT,
    ),
)

TOOL_CALL_RAW = {
    "extra_content": {"google": {"thought_signature": SIG_TOOL}},
    "function": {"arguments": '{"days":7}', "name": "list_deadlines"},
    "id": "call_709781",
    "type": "function",
}

# Real shape: complete call in one chunk, no `index`, finish_reason "stop".
# Hand-written: a provider that sends running totals, so the last usage differs from the first.
STREAM_USAGE_GROWS = sse(
    chunk({"content": "hi", "role": "assistant"}, usage={"prompt_tokens": 5, "completion_tokens": 0, "total_tokens": 5}),
    chunk({}, finish_reason="stop", usage={"prompt_tokens": 5, "completion_tokens": 4, "total_tokens": 9}),
)

STREAM_TOOL_SINGLE = sse(
    chunk({"role": "assistant", "tool_calls": [TOOL_CALL_RAW]}),
    chunk({"role": "assistant"}, finish_reason="stop"),
)

# OpenAI style: id+name first, arguments fragmented, two parallel calls with explicit indexes.
STREAM_TOOL_FRAGMENTED = sse(
    chunk({"role": "assistant", "tool_calls": [
        {"index": 0, "id": "call_a", "type": "function", "function": {"name": "list_deadlines", "arguments": ""}},
    ]}),
    chunk({"tool_calls": [{"index": 0, "function": {"arguments": '{"da'}}]}),
    chunk({"tool_calls": [
        {"index": 0, "function": {"arguments": 'ys": 7}'}},
        {"index": 1, "id": "call_b", "type": "function", "function": {"name": "list_projects", "arguments": "{}"}},
    ]}),
    chunk({}, finish_reason="tool_calls", usage={"prompt_tokens": 30, "completion_tokens": 10, "total_tokens": 40}),
)

# Two parallel calls in one chunk, each with an id and NO index (as Gemini sends them).
STREAM_TOOL_NO_INDEX_PARALLEL = sse(
    chunk({"role": "assistant", "tool_calls": [
        {"id": "call_x", "type": "function", "function": {"name": "list_deadlines", "arguments": '{"days":3}'}},
        {"id": "call_y", "type": "function", "function": {"name": "list_projects", "arguments": "{}"}},
    ]}),
    chunk({}, finish_reason="stop"),
)

STREAM_BAD_TOOL_ARGS = sse(
    chunk({"role": "assistant", "tool_calls": [
        {"id": "call_z", "type": "function", "function": {"name": "list_deadlines", "arguments": '{"da'}},
    ]}),
    chunk({}, finish_reason="stop"),
)

STREAM_MALFORMED = sse(chunk({"content": "hi", "role": "assistant"}), "{not json", done=False)

# Ends without [DONE] and without a finish_reason: the connection was cut mid-answer.
STREAM_TRUNCATED = sse(chunk({"content": "partial", "role": "assistant"}), done=False)


def _err(code, message, status, retry_delay=None):
    error = {"code": code, "message": message, "status": status}
    if retry_delay:
        error["details"] = [
            {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": retry_delay}
        ]
    return json.dumps([{"error": error}], indent=2)  # Gemini wraps the error object in a list


ERR_429_LONG = _err(429, "You exceeded your current quota, please check your plan and billing details.",
                    "RESOURCE_EXHAUSTED", "37s")
ERR_429_SHORT = _err(429, "Rate limit reached.", "RESOURCE_EXHAUSTED", "2s")
ERR_503 = _err(503, "This model is currently experiencing high demand. Spikes in demand are usually "
                    "temporary. Please try again later.", "UNAVAILABLE")
ERR_404 = _err(404, "This model models/gemini-2.5-flash is no longer available to new users.", "NOT_FOUND")
ERR_400_KEY = _err(400, "Please pass a valid API key", "INVALID_ARGUMENT")
ERR_400_OTHER = json.dumps({"error": {"message": "Unsupported parameter: foo"}})  # OpenAI-style dict
