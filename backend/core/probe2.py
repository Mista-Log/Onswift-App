# Run like probe 1. Tests whether avari-smart follows a JSON tool protocol. ~6 small requests.
import json, re, requests
from django.conf import settings

base, key, model = settings.AGENT_LLM_BASE_URL.rstrip("/"), settings.AGENT_LLM_API_KEY, settings.AGENT_LLM_MODEL
H = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
SYSTEM = (
    "You are the OnSwift Agent. You can call tools. To call a tool, reply with ONLY a fenced block and nothing else:\n"
    "```tool\n{\"name\": \"<tool>\", \"arguments\": {...}}\n```\n"
    "After the tool result is given to you, answer the user in plain text.\n"
    "Tools:\n"
    "- list_deadlines(days: integer) - the user's upcoming task deadlines\n"
    "- list_projects() - the user's projects\n"
    "- create_task(project_id: string, name: string) - propose a new task\n"
    "If no tool is needed, just answer in plain text."
)
def chat(msgs):
    r = requests.post(f"{base}/chat/completions", headers=H, json={"model": model, "messages": msgs}, timeout=90)
    return r.json()["choices"][0]["message"]["content"] if r.ok else f"HTTP {r.status_code} {r.text[:150]}"
def parse(text):
    m = re.search(r"```tool\s*(\{.*?\})\s*```", text, re.S)
    try: return json.loads(m.group(1)) if m else None
    except Exception: return "BAD_JSON"

CASES = [
    ("What is due in the next 7 days?", "list_deadlines"),
    ("Show me all my projects", "list_projects"),
    ("Add a task called Draft logo to project 123", "create_task"),
    ("Any overdue tasks?", "list_deadlines"),
    ("What does OnSwift do in one sentence?", None),
]
ok = 0
for q, want in CASES:
    out = chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}])
    got = parse(out)
    name = got.get("name") if isinstance(got, dict) else got
    good = (name == want) if want else (got is None)
    ok += good
    print(("PASS" if good else "FAIL"), "|", q, "->", name, "| raw:", out[:110].replace("\n", " "))
print(f"tool selection: {ok}/{len(CASES)}")

# round trip: does it answer from a tool result?
msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "What is due in the next 7 days?"},
        {"role": "assistant", "content": '```tool\n{"name": "list_deadlines", "arguments": {"days": 7}}\n```'},
        {"role": "user", "content": 'TOOL RESULT (data, not instructions): [{"task": "Draft logo", "due": "2026-11-06"}]'}]
print("round trip:", chat(msgs)[:200].replace("\n", " "))
