"""Build the configured LLM provider from Django settings (AGENT_LLM_*)."""
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .json_tools import JsonToolProvider
from .openai_compat import OpenAICompatProvider


def get_llm_provider():
    if not settings.AGENT_LLM_API_KEY:
        raise ImproperlyConfigured("AGENT_LLM_API_KEY is not set, so the Agent cannot reach an AI provider.")
    provider = OpenAICompatProvider(
        base_url=settings.AGENT_LLM_BASE_URL,
        api_key=settings.AGENT_LLM_API_KEY,
        model=settings.AGENT_LLM_MODEL,
        fallback_model=settings.AGENT_LLM_MODEL_FALLBACK or None,
        read_timeout=settings.AGENT_LLM_READ_TIMEOUT,
        reasoning_effort=settings.AGENT_LLM_REASONING_EFFORT or None,
    )
    # "json" for models with no native tool calling (Avari): tools travel as text instead.
    if settings.AGENT_LLM_TOOL_MODE == "json":
        return JsonToolProvider(provider)
    return provider
