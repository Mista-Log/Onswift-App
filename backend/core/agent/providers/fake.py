"""Scripted provider used by every unit test, so tests never touch the network."""
from .base import LLMProvider


class FakeProvider(LLMProvider):
    """`script` is a list of turns. Each turn is a list of events to yield, or an Exception
    instance to raise (before yielding anything). Every call is recorded in `self.calls`."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def stream(self, messages, tools=None, system=None):
        self.calls.append({"messages": messages, "tools": tools, "system": system})
        if not self.script:
            raise AssertionError("FakeProvider was called more times than its script allows")
        turn = self.script.pop(0)
        if isinstance(turn, Exception):
            raise turn
        yield from turn
