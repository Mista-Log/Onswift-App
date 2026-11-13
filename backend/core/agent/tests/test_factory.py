from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from agent.providers.factory import get_llm_provider
from agent.providers.openai_compat import OpenAICompatProvider

CONFIG = dict(
    AGENT_LLM_BASE_URL="https://llm.test/v1/",
    AGENT_LLM_API_KEY="SECRET-KEY-123",
    AGENT_LLM_MODEL="primary",
    AGENT_LLM_MODEL_FALLBACK="backup",
    AGENT_LLM_REASONING_EFFORT="low",
    AGENT_LLM_READ_TIMEOUT=12,
    AGENT_LLM_TOOL_MODE="native",  # pinned: a developer's .env may set "json" (Avari), which wraps the adapter
)


class GetLLMProviderTests(SimpleTestCase):
    @override_settings(**CONFIG)
    def test_builds_the_adapter_from_settings(self):
        provider = get_llm_provider()
        self.assertIsInstance(provider, OpenAICompatProvider)
        self.assertEqual(provider.url, "https://llm.test/v1/chat/completions")
        self.assertEqual(provider.model, "primary")
        self.assertEqual(provider.fallback_model, "backup")
        self.assertEqual(provider.reasoning_effort, "low")
        self.assertEqual(provider.read_timeout, 12)

    @override_settings(**{**CONFIG, "AGENT_LLM_MODEL_FALLBACK": "", "AGENT_LLM_REASONING_EFFORT": ""})
    def test_empty_optional_settings_become_none(self):
        provider = get_llm_provider()
        self.assertIsNone(provider.fallback_model)
        self.assertIsNone(provider.reasoning_effort)

    @override_settings(**{**CONFIG, "AGENT_LLM_TOOL_MODE": "json"})
    def test_json_tool_mode_wraps_the_adapter(self):
        from agent.providers.json_tools import JsonToolProvider
        provider = get_llm_provider()
        self.assertIsInstance(provider, JsonToolProvider)
        self.assertIsInstance(provider.inner, OpenAICompatProvider)
        self.assertEqual(provider.model, "primary")

    @override_settings(**{**CONFIG, "AGENT_LLM_API_KEY": ""})
    def test_missing_key_raises_a_message_that_names_the_setting(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            get_llm_provider()
        self.assertIn("AGENT_LLM_API_KEY", str(ctx.exception))

    @override_settings(**CONFIG)
    def test_key_is_not_exposed_through_the_provider_repr_or_url(self):
        provider = get_llm_provider()
        self.assertNotIn("SECRET-KEY-123", provider.url)
        self.assertNotIn("SECRET-KEY-123", repr(provider))
