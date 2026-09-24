from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PersonalTask, Task


class DeadlineListView(APIView):
    """
    GET /deadlines/ -> every task with a due date the user can see, in one response,
    so the Deadlines page doesn't need one request per project.
    Creators see all tasks in their projects; others see tasks assigned to them.
    Personal tasks are included with project_id null.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == "creator":
            base = Task.objects.filter(project__creator=user)
        else:
            base = Task.objects.filter(assignees=user)

        tasks = (
            base.filter(deadline__isnull=False)
            .select_related("project")
            .prefetch_related("assignees")
            .distinct()
        )

        rows = []
        for t in tasks:
            first = next(iter(t.assignees.all()), None)
            rows.append({
                "id": str(t.id),
                "name": t.name,
                "project_id": str(t.project_id),
                "project_name": t.project.name,
                "deadline": t.deadline.isoformat(),
                "status": t.status,
                "assignee_id": str(first.id) if first else None,
                "assignee_name": (first.full_name or first.email) if first else None,
                "is_personal": False,
            })

        for t in PersonalTask.objects.filter(owner=user, deadline__isnull=False):
            rows.append({
                "id": str(t.id),
                "name": t.name,
                "project_id": None,
                "project_name": "Personal",
                "deadline": t.deadline.isoformat(),
                "status": t.status,
                "assignee_id": str(user.id),
                "assignee_name": "You",
                "is_personal": True,
            })

        return Response(rows)
