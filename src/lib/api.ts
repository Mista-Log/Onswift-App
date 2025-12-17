import { Project } from "../contexts/ProjectContext";



const mapFromBackend = (p: any): Project => ({
  id: p.id,
  name: p.name,
  description: p.description,
  due_date: p.due_date,
  status: p.status,
  teamMembers: p.teamMembers || [],
  taskCount: p.task_count,
  completedTasks: p.completed_tasks,
});

export { mapFromBackend };
