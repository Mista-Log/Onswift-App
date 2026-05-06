/**
 * Frontend invite template definitions
 * Mirrors backend templates in backend/core/portal/templates.py
 */

export interface InviteTemplate {
  id: string;
  name: string;
  description: string;
  question_count: number;
}

export function list_templates(): InviteTemplate[] {
  return [
    {
      id: "project_kickoff",
      name: "Project Kickoff",
      description: "Gather essential project information and team details",
      question_count: 5,
    },
    {
      id: "timeline_goals",
      name: "Timeline & Goals",
      description: "Define project goals, timeline, and success metrics",
      question_count: 5,
    },
    {
      id: "team_scope",
      name: "Team & Scope",
      description: "Define team structure and detailed project scope",
      question_count: 5,
    },
  ];
}
