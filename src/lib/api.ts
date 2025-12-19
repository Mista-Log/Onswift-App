import { Project } from "../contexts/ProjectContext";



const mapFromBackend = (p: any): Project => ({
  id: p.id,
  name: p.name,
  description: p.description,
  due_date: p.due_date,
  status: p.status,
  teamMembers: p.teamMembers || [],
  task_count: p.task_count,
  completed_tasks: p.completed_tasks,
});

export { mapFromBackend };
