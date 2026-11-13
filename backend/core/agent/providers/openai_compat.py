"""Adapter for any OpenAI-style /chat/completions endpoint (Gemini, Avari, OpenRouter, ...).

Switching provider is a config change (AGENT_LLM_BASE_URL / _API_KEY / _MODEL), not a code change.
Behaviours here come from the real streams captured in the Phase 0 spike:
  * tool calls are detected by their presence, never by finish_reason (Gemini ends with "stop")
  * a tool call may arrive whole in one chunk, with no `index`
  * vendor extras (Gemini's thought_signature) are kept verbatim so the call can be replayed
  * `usage` repeats across chunks, so the last one wins and it is never summed
"""
import json
import random
import re
import time
from typing import Iterator, Optional

import requests

from .base import (
    Done,
    LLMProvider,
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

# Never sleep longer than this inside a web request. A longer wait moves on to the fallback model,
# or surfaces to the caller as a RateLimited error carrying `retry_after`.
MAX_INLINE_WAIT = 5.0
_TEXT_LIMIT = 300  # provider error text is truncated before it reaches logs or users

_RETRYABLE = (ProviderRateLimited, ProviderUnavailable, ProviderTimeout)


class OpenAICompatProvider(LLMProvider):
    def __init__(
        self,
        base_url,
        api_key,
        model,
        fallback_model=None,
        connect_timeout=10,
        read_timeout=30,
        max_attempts=2,
        backoff_base=0.5,
        reasoning_effort=None,
        sleep=time.sleep,
    ):
        self.url = f"{base_url.rstrip('/')}/chat/completions"
        self.model = model
        self.fallback_model = fallback_model
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        # Attempts per model. Kept small: failed calls (e.g. 503) still count against free-tier quota.
        self.max_attempts = max(1, int(max_attempts))
        self.backoff_base = backoff_base
        self.reasoning_effort = reasoning_effort
        self._sleep = sleep
        self._headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # -- public ----------------------------------------------------------------------------

    def stream(self, messages, tools=None, system=None) -> Iterator:
        models = [self.model]
        if self.fallback_model and self.fallback_model != self.model:
            models.append(self.fallback_model)

        last_error = None
        for model in models:
            payload = self._payload(model, messages, tools, system)
            for attempt in range(self.max_attempts):
                try:
                    response = self._open(model, payload)
                except ProviderModelNotFound as error:
                    last_error = error
                    break  # retrying the same model id cannot help; try the fallback
                except _RETRYABLE as error:
                    last_error = error
                    if attempt + 1 < self.max_attempts and self._wait(error, attempt):
                        continue
                    break
                # Only failures before the first event are retried. Once output has been handed to
                # the caller, retrying would duplicate it, so errors inside _consume propagate.
                yield from self._consume(response)
                return
        raise last_error

    # -- request ---------------------------------------------------------------------------

    def _payload(self, model, messages, tools, system):
        prefix = [{"role": "system", "content": system}] if system else []
        body = {
            "model": model,
            "messages": prefix + list(messages),
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        if self.reasoning_effort:
            body["reasoning_effort"] = self.reasoning_effort
        return body

    def _open(self, model, payload):
        try:
            response = requests.post(
                self.url,
                headers=self._headers,
                json=payload,
                stream=True,
                timeout=(self.connect_timeout, self.read_timeout),
            )
        except requests.exceptions.Timeout:
            raise ProviderTimeout("The AI provider took too long to respond.") from None
        except requests.exceptions.ConnectionError:
            raise ProviderUnavailable("Could not reach the AI provider.") from None
        if response.status_code == 200:
            return response
        try:
            raise self._error_for(response, model)
        finally:
            response.close()

    def _wait(self, error, attempt):
        """Sleep before a retry. Returns False when the wait would be too long to spend here."""
        if error.retry_after is not None:
            if error.retry_after > MAX_INLINE_WAIT:
                return False
            delay = error.retry_after
        else:
            delay = min(
                MAX_INLINE_WAIT,
                self.backoff_base * (2 ** attempt) + random.uniform(0, self.backoff_base),
            )
        self._sleep(delay)
        return True

    # -- errors ----------------------------------------------------------------------------

    def _error_for(self, response, model):
        status = response.status_code
        message, body_delay = _parse_error(response.text)
        header_delay = _seconds(response.headers.get("Retry-After"))
        retry_after = header_delay if header_delay is not None else body_delay

        if status in (401, 403) or (status == 400 and "api key" in message.lower()):
            return ProviderAuthError(
                "The AI provider rejected the API key. Check AGENT_LLM_API_KEY.", status=status
            )
        if status == 404:
            return ProviderModelNotFound(
                f"Model '{model}' is not available from the AI provider. "
                "Change AGENT_LLM_MODEL (or AGENT_LLM_MODEL_FALLBACK).",
                status=status,
            )
        if status == 429:
            return ProviderRateLimited(
                f"Rate limited by the AI provider: {message}", status=status, retry_after=retry_after
            )
        if status >= 500:
            return ProviderUnavailable(
                f"The AI provider is unavailable ({status}): {message}", status=status
            )
        return ProviderBadRequest(f"The AI provider rejected the request: {message}", status=status)

    # -- response --------------------------------------------------------------------------

    def _consume(self, response):
        calls = {}
        usage = None
        finish_reason = None
        message_extra = None
        saw_done = False
        # An SSE stream is always UTF-8. Without a charset header (Avari sends none) requests assumes
        # Latin-1, which turns every "—" into "â".
        response.encoding = "utf-8"
        try:
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    saw_done = True
                    break
                try:
                    chunk = json.loads(data)
                except ValueError:
                    raise ProviderBadResponse("The AI provider sent a malformed stream chunk.") from None
                if chunk.get("usage"):
                    usage = chunk["usage"]  # repeated across chunks: last wins, never summed
                for choice in chunk.get("choices") or []:
                    delta = choice.get("delta") or {}
                    if delta.get("content"):
                        yield TextDelta(delta["content"])
                    if delta.get("extra_content"):
                        message_extra = delta["extra_content"]
                    for item in delta.get("tool_calls") or []:
                        _accumulate(calls, item)
                    if choice.get("finish_reason"):
                        finish_reason = choice["finish_reason"]
        except requests.exceptions.RequestException:
            raise ProviderStreamInterrupted(
                "The connection to the AI provider was lost mid-response."
            ) from None
        finally:
            response.close()

        if not saw_done and finish_reason is None:
            raise ProviderStreamInterrupted("The AI provider's response was cut off.")

        for position, key in enumerate(sorted(calls)):
            yield _finish_call(calls[key], position)
        if usage:
            prompt = usage.get("prompt_tokens") or 0
            completion = usage.get("completion_tokens") or 0
            yield Usage(prompt, completion, usage.get("total_tokens") or prompt + completion)
        yield Done(finish_reason, message_extra)


# -- helpers -------------------------------------------------------------------------------


def _accumulate(calls, item):
    """Fold one streamed tool_call item into `calls`, tolerating fragments and a missing `index`."""
    index = item.get("index")
    if index is None:
        existing = next((k for k, v in calls.items() if item.get("id") and v["id"] == item["id"]), None)
        if existing is not None:
            index = existing  # the provider repeated the id on a continuation chunk
        elif item.get("id") or not calls:
            index = len(calls)  # no index: a new id starts a new call
        else:
            index = max(calls)  # no index and no id: continues the latest call
    slot = calls.setdefault(index, {"id": None, "name": "", "arguments": "", "extra": None})
    if item.get("id"):
        slot["id"] = item["id"]
    function = item.get("function") or {}
    if function.get("name") and not slot["name"]:
        slot["name"] = function["name"]
    slot["arguments"] += function.get("arguments") or ""
    if item.get("extra_content"):
        slot["extra"] = item["extra_content"]


def _finish_call(slot, position):
    name = slot["name"]
    if not name:
        raise ProviderBadResponse("The AI provider sent a tool call without a name.")
    raw_arguments = slot["arguments"] or "{}"
    try:
        arguments = json.loads(raw_arguments)
    except ValueError:
        arguments = None
    if not isinstance(arguments, dict):
        raise ProviderBadResponse(f"The AI provider sent invalid arguments for tool '{name}'.")
    call_id = slot["id"] or f"call_{position}"
    raw = {"id": call_id, "type": "function", "function": {"name": name, "arguments": raw_arguments}}
    if slot["extra"]:
        raw["extra_content"] = slot["extra"]
    return ToolCall(id=call_id, name=name, arguments=arguments, raw=raw)


def _parse_error(text):
    """Return (message, retry_delay_seconds). Handles Gemini's list-wrapped errors and OpenAI dicts."""
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return (text or "").strip()[:_TEXT_LIMIT], None
    if isinstance(data, list) and data:
        data = data[0]
    error = data.get("error") if isinstance(data, dict) else None
    if not isinstance(error, dict):
        return str(data)[:_TEXT_LIMIT], None
    delay = None
    for detail in error.get("details") or []:
        if isinstance(detail, dict) and "RetryInfo" in str(detail.get("@type", "")):
            delay = _seconds(detail.get("retryDelay"))
    return str(error.get("message") or "")[:_TEXT_LIMIT], delay


def _seconds(value):
    """'37s', '2.5s', '3' or 3 -> float seconds; anything else (e.g. an HTTP date) -> None."""
    if value is None:
        return None
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*s?\s*", str(value))
    return float(match.group(1)) if match else None
