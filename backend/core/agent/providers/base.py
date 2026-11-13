"""Provider-neutral types for the agent's LLM layer.

The runner only ever sees these events and exceptions, so swapping the model
provider (Gemini, Avari, OpenRouter, ...) never touches the runner or the views.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterator, Optional


@dataclass(frozen=True)
class TextDelta:
    text: str


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: dict
    # The provider's original tool_call object, including vendor extras such as Gemini's
    # `extra_content.google.thought_signature`. Gemini 3 expects that signature echoed back when
    # the assistant's tool call is replayed, so this is stored and resent verbatim, never rebuilt.
    raw: dict


@dataclass(frozen=True)
class Usage:
    prompt_tokens: int
    completion_tokens: int
    # Includes hidden "thinking" tokens on some providers (94 vs 9 for a one-word reply),
    # so cost tracking uses this field, not prompt + completion.
    total_tokens: int


@dataclass(frozen=True)
class Done:
    finish_reason: Optional[str]
    # Vendor extras attached to the assistant message itself; replay verbatim.
    message_extra: Optional[dict] = None


class ProviderError(Exception):
    """Base class. `status` is the HTTP status when there was one; `retry_after` is in seconds."""

    kind = "error"

    def __init__(self, message, *, status=None, retry_after=None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


class ProviderAuthError(ProviderError):
    kind = "auth"


class ProviderModelNotFound(ProviderError):
    kind = "model_not_found"


class ProviderRateLimited(ProviderError):
    kind = "rate_limited"


class ProviderUnavailable(ProviderError):
    kind = "unavailable"


class ProviderTimeout(ProviderError):
    kind = "timeout"


class ProviderBadRequest(ProviderError):
    kind = "bad_request"


class ProviderBadResponse(ProviderError):
    kind = "bad_response"


class ProviderStreamInterrupted(ProviderError):
    kind = "stream_interrupted"


class LLMProvider(ABC):
    @abstractmethod
    def stream(self, messages: list, tools: Optional[list] = None, system: Optional[str] = None) -> Iterator:
        """Yield TextDelta / ToolCall / Usage / Done events for one model turn.

        `messages` are OpenAI-shaped dicts and are passed through untouched. Raises a
        ProviderError subclass on failure.
        """
