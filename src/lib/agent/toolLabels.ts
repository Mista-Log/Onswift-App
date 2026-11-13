// Plain-language wording for the tool steps shown while the Agent works.
const RUNNING: Record<string, string> = {
  list_projects: "Looking through your projects",
  get_project: "Opening a project",
  list_tasks: "Checking your tasks",
  list_deadlines: "Checking your deadlines",
  list_notifications: "Checking your notifications",
  list_clients: "Looking through your clients",
  get_client: "Opening a client",
  create_project: "Preparing a new project",
  create_task: "Preparing a new task",
  update_task: "Preparing a task change",
  get_analytics: "Checking your workspace numbers",
  search_docs: "Searching your docs",
  search_library: "Searching your files",
  create_doc: "Preparing a new doc",
  create_form: "Preparing a new form",
  list_forms: "Looking through your forms",
  get_form: "Opening a form",
  update_form: "Preparing a form change",
  create_onboarding_form: "Preparing a client onboarding form",
};

const DONE: Record<string, string> = {
  list_projects: "Looked through your projects",
  get_project: "Opened a project",
  list_tasks: "Checked your tasks",
  list_deadlines: "Checked your deadlines",
  list_notifications: "Checked your notifications",
  list_clients: "Looked through your clients",
  get_client: "Opened a client",
  create_project: "Prepared a new project for your approval",
  create_task: "Prepared a new task for your approval",
  update_task: "Prepared a task change for your approval",
  get_analytics: "Checked your workspace numbers",
  search_docs: "Searched your docs",
  search_library: "Searched your files",
  create_doc: "Prepared a new doc for your approval",
  create_form: "Prepared a new form for your approval",
  list_forms: "Looked through your forms",
  get_form: "Opened a form",
  update_form: "Prepared a form change for your approval",
  create_onboarding_form: "Prepared a client onboarding form for your approval",
};

const FAILED = "Couldn't read that";
const FAILED_WRITE = "Couldn't prepare that change";
const WRITE_TOOLS = new Set(["create_project", "create_task", "update_task", "create_doc", "create_form", "update_form", "create_onboarding_form"]);

/** Tool names we haven't labelled still read sensibly: "list_widgets" becomes "list widgets". */
const fallback = (name: string) => name.replace(/_/g, " ");

export function toolLabel(name: string, status: "running" | "done" | "failed"): string {
  if (status === "failed") return WRITE_TOOLS.has(name) ? FAILED_WRITE : FAILED;
  const table = status === "running" ? RUNNING : DONE;
  return table[name] ?? fallback(name);
}
