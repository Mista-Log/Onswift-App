"""
Onboarding templates for client invites.
These templates provide pre-built forms that creators can use or customize.
"""

# Template: Project Kickoff
# Used for initial project setup and team introduction
PROJECT_KICKOFF_TEMPLATE = {
    "name": "Project Kickoff",
    "description": "Gather essential project information and team details",
    "questions": [
        {
            "id": "name",
            "type": "text",
            "label": "Your Name",
            "required": True,
            "placeholder": "e.g., Jane Doe",
        },
        {
            "id": "company",
            "type": "text",
            "label": "Company/Organization",
            "required": True,
            "placeholder": "e.g., Acme Corp",
        },
        {
            "id": "role",
            "type": "text",
            "label": "Your Role",
            "required": True,
            "placeholder": "e.g., Project Manager",
        },
        {
            "id": "phone",
            "type": "text",
            "label": "Contact Phone",
            "required": False,
            "placeholder": "+1 (555) 123-4567",
        },
        {
            "id": "team_members",
            "type": "textarea",
            "label": "Key Team Members (Optional)",
            "required": False,
            "placeholder": "List other team members who will be involved",
        },
    ],
}

# Template: Timeline & Goals
# Used for establishing project milestones and objectives
TIMELINE_GOALS_TEMPLATE = {
    "name": "Timeline & Goals",
    "description": "Define project goals, timeline, and success metrics",
    "questions": [
        {
            "id": "project_goal",
            "type": "textarea",
            "label": "What is the primary goal of this project?",
            "required": True,
            "placeholder": "Describe the main objective...",
        },
        {
            "id": "success_metrics",
            "type": "textarea",
            "label": "How will we measure success?",
            "required": True,
            "placeholder": "Define KPIs and success criteria...",
        },
        {
            "id": "target_launch",
            "type": "date",
            "label": "Target Launch/Delivery Date",
            "required": True,
        },
        {
            "id": "constraints",
            "type": "textarea",
            "label": "Any constraints or considerations?",
            "required": False,
            "placeholder": "Budget, timeline, technical limitations, etc.",
        },
        {
            "id": "stakeholders",
            "type": "textarea",
            "label": "Key stakeholders and approval chain",
            "required": False,
            "placeholder": "Who needs to approve decisions?",
        },
    ],
}

# Template: Team & Scope
# Used for understanding team structure and project scope
TEAM_SCOPE_TEMPLATE = {
    "name": "Team & Scope",
    "description": "Define team structure and detailed project scope",
    "questions": [
        {
            "id": "team_size",
            "type": "select",
            "label": "Team Size",
            "required": True,
            "options": [
                {"value": "1", "label": "1 person"},
                {"value": "2-5", "label": "2-5 people"},
                {"value": "6-10", "label": "6-10 people"},
                {"value": "10+", "label": "10+ people"},
            ],
        },
        {
            "id": "team_roles",
            "type": "textarea",
            "label": "Team Roles and Responsibilities",
            "required": True,
            "placeholder": "Describe each team member's role...",
        },
        {
            "id": "project_scope",
            "type": "textarea",
            "label": "Detailed Project Scope",
            "required": True,
            "placeholder": "What's included and what's not in scope?",
        },
        {
            "id": "deliverables",
            "type": "textarea",
            "label": "Expected Deliverables",
            "required": False,
            "placeholder": "List specific deliverables...",
        },
        {
            "id": "communication_preference",
            "type": "select",
            "label": "Preferred Communication Method",
            "required": False,
            "options": [
                {"value": "email", "label": "Email"},
                {"value": "portal", "label": "Project Portal"},
                {"value": "slack", "label": "Slack"},
                {"value": "calls", "label": "Video Calls"},
                {"value": "mixed", "label": "Mixed Methods"},
            ],
        },
    ],
}

# Template mapping for easy access
TEMPLATES = {
    "project_kickoff": PROJECT_KICKOFF_TEMPLATE,
    "timeline_goals": TIMELINE_GOALS_TEMPLATE,
    "team_scope": TEAM_SCOPE_TEMPLATE,
}

# Default template (most commonly used)
DEFAULT_TEMPLATE = PROJECT_KICKOFF_TEMPLATE


def get_template(template_id: str) -> dict:
    """
    Retrieve a template by its ID.
    
    Args:
        template_id: One of 'project_kickoff', 'timeline_goals', 'team_scope'
    
    Returns:
        Template dictionary, or DEFAULT_TEMPLATE if not found
    """
    return TEMPLATES.get(template_id, DEFAULT_TEMPLATE)


def list_templates() -> list:
    """
    Get a list of all available templates with metadata.
    
    Returns:
        List of template names and descriptions
    """
    return [
        {
            "id": template_id,
            "name": template["name"],
            "description": template["description"],
            "question_count": len(template["questions"]),
        }
        for template_id, template in TEMPLATES.items()
    ]
