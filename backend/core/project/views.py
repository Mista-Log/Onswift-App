from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Project, Task, ProjectSample, Deliverable, Message, Conversation, Group, GroupMembership, GroupMessage, GroupMessageReadStatus
from .models import GoogleCalendarToken, CalendarSyncedTask, ProjectClientMembership
from .models import TaskComment, TaskAttachment, TaskChecklist, TaskChecklistItem
from .serializers import (
    ProjectSerializer, TaskSerializer, TaskDetailSerializer, ProjectSampleSerializer,
    DeliverableSerializer, DeliverableCreateSerializer, DeliverableReviewSerializer,
    MessageSerializer, ConversationSerializer,
    GroupSerializer, GroupCreateSerializer, GroupUpdateSerializer,
    GroupMemberSerializer, GroupMessageSerializer, GroupMessageCreateSerializer,
    GroupAddMembersSerializer,
    GoogleCalendarStatusSerializer, GoogleCalendarConnectSerializer,
    TaskSyncSerializer, CalendarSyncedTaskSerializer,
    TaskCommentSerializer, TaskAttachmentSerializer,
    TaskChecklistSerializer, TaskChecklistItemSerializer,
)
from .permissions import IsCreator
from rest_framework import permissions
from django.db.models import Q
from . import google_calendar

# Project Views
class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            # Creators see their own projects
            return Project.objects.filter(creator=user)
        else:
            # Talents see projects where they are assigned to tasks
            return Project.objects.filter(tasks__assignees=user).distinct()

    def perform_create(self, serializer):
        # Automatically assign creator
        serializer.save(creator=self.request.user)



class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            return Project.objects.filter(creator=user)
        else:
            # Talents can view projects where they have assigned tasks
            return Project.objects.filter(tasks__assignees=user).distinct()

    def check_permissions(self, request):
        super().check_permissions(request)
        # Only creators can update/delete
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            if request.user.role != "creator":
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only creators can modify projects.")


class ProjectCompleteView(APIView):
    """
    POST /api/v5/projects/<project_id>/complete/
    Mark a project as completed.
    Updates ProjectClientMembership status for all clients to "completed".
    Only the project creator can complete a project.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can complete a project"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Idempotency: only run the completion side effects (and notifications)
        # on the first transition, so retries or repeated clicks don't spam users.
        already_completed = project.status == "completed"

        # Mark project as completed
        project.status = "completed"
        project.save()

        # Signal will automatically update memberships, but ensure it here too
        ProjectClientMembership.objects.filter(
            project=project,
            status__in=["active", "on_hold"]
        ).update(status="completed")

        # Celebrate the wrap-up: notify every assigned talent and the creator.
        if not already_completed:
            from notification.services import create_notification
            User = get_user_model()
            talents = User.objects.filter(assigned_tasks__project=project).distinct()
            for talent in talents:
                create_notification(
                    user=talent,
                    title="Project Completed 🎉",
                    message=f"\"{project.name}\" has been marked complete. Great work — that's a wrap!",
                    notification_type="system",
                )
            create_notification(
                user=project.creator,
                title="Project Completed 🎉",
                message=f"You wrapped up \"{project.name}\". Congratulations on seeing it through!",
                notification_type="system",
            )

        return Response({
            "message": "Project marked as completed",
            "project_id": str(project.id),
            "status": project.status,
        }, status=status.HTTP_200_OK)


class ProjectArchiveView(APIView):
    """
    POST /api/v5/projects/<project_id>/archive/
    Mark a project as archived.
    Updates ProjectClientMembership status for all clients to "archived".
    Only the project creator can archive a project.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify creator
        if project.creator != request.user:
            return Response(
                {"error": "Only the project creator can archive a project"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Mark project as archived
        project.status = "archived"
        project.save()

        # Update memberships to archived
        ProjectClientMembership.objects.filter(
            project=project,
        ).update(status="archived")

        return Response({
            "message": "Project archived",
            "project_id": str(project.id),
            "status": project.status,
        }, status=status.HTTP_200_OK)


# Task Views
class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        project_id = self.kwargs["project_id"]

        if user.role == "creator":
            # Creators see all tasks for their projects
            try:
                project = Project.objects.get(id=project_id, creator=user)
                return project.tasks.all()
            except Project.DoesNotExist:
                return Task.objects.none()
        else:
            # Talents see only tasks assigned to them in this project
            return Task.objects.filter(
                project_id=project_id,
                assignees=user
            )

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "creator":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only creators can create tasks.")

        try:
            project = Project.objects.get(
                id=self.kwargs["project_id"],
                creator=user
            )
            task = serializer.save(project=project)
        except Project.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Project not found.")

        from notification.services import create_notification
        for assignee in task.assignees.all():
            create_notification(
                user=assignee,
                title="New Task Assigned",
                message=f"{user.full_name} assigned you \"{task.name}\" in {project.name}.",
                notification_type="system",
                priority=1,
            )



class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("GET", "HEAD"):
            return TaskDetailSerializer
        return TaskSerializer

    def get_queryset(self):
        user = self.request.user
        deliverable_prefetch = ['deliverables__links', 'deliverables__files', 'deliverables__submitted_by']
        if user.role == "creator":
            return Task.objects.filter(project__creator=user).prefetch_related(*deliverable_prefetch)
        elif user.role == "client":
            return Task.objects.filter(
                project__client_memberships__client=user
            ).prefetch_related(*deliverable_prefetch)
        else:
            return Task.objects.filter(assignees=user).prefetch_related(*deliverable_prefetch)

    def perform_update(self, serializer):
        serializer.save()

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in ("PUT", "PATCH", "DELETE"):
            if request.user.role != "creator":
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only creators can modify tasks.")


def _get_task_for_user(user, task_id):
    """Return task if user has access, else raise Http404."""
    from django.http import Http404
    try:
        task = Task.objects.select_related("project__creator").get(id=task_id)
    except Task.DoesNotExist:
        raise Http404
    if user.role == "creator" and task.project.creator == user:
        return task
    if user.role == "talent" and task.assignees.filter(id=user.id).exists():
        return task
    if user.role == "client":
        if ProjectClientMembership.objects.filter(project=task.project, client=user).exists():
            return task
    raise Http404


class TaskRequestCompletionView(APIView):
    """
    POST /api/v2/tasks/<task_id>/request-completion/
    An assignee marks a task done without a deliverable: flag it for the creator's
    approval and notify them. Does not change the task's status (only creators can).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        task = _get_task_for_user(request.user, task_id)

        if not task.assignees.filter(id=request.user.id).exists():
            return Response(
                {"error": "Only an assignee can request completion."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # A completed task has nothing to approve — reject rather than flag it,
        # which would otherwise leave it "completed + awaiting approval".
        if task.status == "completed":
            return Response(
                {"error": "This task is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Idempotent: if the request is already pending, don't re-flag or re-notify.
        if task.awaiting_approval:
            return Response({"status": "ok", "awaiting_approval": True})

        task.awaiting_approval = True
        task.save(update_fields=["awaiting_approval"])

        from notification.services import create_notification
        create_notification(
            user=task.project.creator,
            title="Task Ready for Approval",
            message=f"{request.user.full_name} marked '{task.name}' as ready — awaiting your approval.",
            notification_type="system",
            link=f"/projects/{task.project.id}?task={task.id}",
            priority=1,
        )

        return Response({"status": "ok", "awaiting_approval": True})


class TaskRequestRevisionView(APIView):
    """
    POST /api/v2/tasks/<task_id>/request-revision/
    The project creator bounces a task awaiting approval back to its assignees
    instead of completing it: clear the pending flag and notify the talent with
    the creator's feedback.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        task = _get_task_for_user(request.user, task_id)

        if task.project.creator_id != request.user.id:
            return Response(
                {"error": "Only the creator can request a revision."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Idempotent: nothing to bounce back if it isn't awaiting approval.
        if not task.awaiting_approval:
            return Response({"status": "ok", "awaiting_approval": False})

        feedback = (request.data.get("feedback") or "").strip()

        task.awaiting_approval = False
        task.save(update_fields=["awaiting_approval"])

        from notification.services import create_notification
        for assignee in task.assignees.all():
            create_notification(
                user=assignee,
                title="Revision Requested",
                message=f"{request.user.full_name} requested changes on '{task.name}': {feedback or 'No feedback provided'}",
                notification_type="system",
                link=f"/projects/{task.project.id}?task={task.id}",
                priority=1,
            )

        return Response({"status": "ok", "awaiting_approval": False})


class TaskCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskCommentSerializer
    permission_classes = [IsAuthenticated]

    def _task(self):
        return _get_task_for_user(self.request.user, self.kwargs["task_id"])

    def get_queryset(self):
        return self._task().comments.select_related("author")

    def perform_create(self, serializer):
        serializer.save(task=self._task(), author=self.request.user)


class TaskCommentDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self):
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied
        task = _get_task_for_user(self.request.user, self.kwargs["task_id"])
        try:
            comment = TaskComment.objects.get(id=self.kwargs["comment_id"], task=task)
        except TaskComment.DoesNotExist:
            raise Http404
        if comment.author != self.request.user and task.project.creator != self.request.user:
            raise PermissionDenied("You cannot delete this comment.")
        return comment


class TaskAttachmentListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [IsAuthenticated]

    def _task(self):
        return _get_task_for_user(self.request.user, self.kwargs["task_id"])

    def get_queryset(self):
        return self._task().attachments.select_related("uploaded_by")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        task = self._task()
        uploaded_file = self.request.FILES.get("file")
        url = self.request.data.get("url", "").strip()
        name = self.request.data.get("name", "").strip()
        if not uploaded_file and not url:
            raise ValidationError("Either a file or a URL is required.")
        if url and not url.startswith(("http://", "https://")):
            url = "https://" + url
        if not name:
            name = uploaded_file.name if uploaded_file else url
        serializer.save(task=task, uploaded_by=self.request.user, name=name,
                        file=uploaded_file or None, url=url or None)


class TaskAttachmentDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self):
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied
        task = _get_task_for_user(self.request.user, self.kwargs["task_id"])
        try:
            attachment = TaskAttachment.objects.get(id=self.kwargs["attachment_id"], task=task)
        except TaskAttachment.DoesNotExist:
            raise Http404
        if attachment.uploaded_by != self.request.user and task.project.creator != self.request.user:
            raise PermissionDenied("You cannot delete this attachment.")
        return attachment


class TaskChecklistListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskChecklistSerializer
    permission_classes = [IsAuthenticated]

    def _task(self):
        return _get_task_for_user(self.request.user, self.kwargs["task_id"])

    def get_queryset(self):
        return self._task().checklists.prefetch_related("items")

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        task = self._task()
        if task.project.creator != self.request.user:
            raise PermissionDenied("Only the project creator can add checklists.")
        serializer.save(task=task)


class TaskChecklistDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = TaskChecklistSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied
        task = _get_task_for_user(self.request.user, self.kwargs["task_id"])
        try:
            checklist = TaskChecklist.objects.get(id=self.kwargs["checklist_id"], task=task)
        except TaskChecklist.DoesNotExist:
            raise Http404
        if task.project.creator != self.request.user:
            raise PermissionDenied("Only the project creator can modify checklists.")
        return checklist


class TaskChecklistItemListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def _checklist(self):
        from django.http import Http404
        task = _get_task_for_user(self.request.user, self.kwargs["task_id"])
        try:
            return TaskChecklist.objects.get(id=self.kwargs["checklist_id"], task=task)
        except TaskChecklist.DoesNotExist:
            raise Http404

    def get_queryset(self):
        return self._checklist().items.all()

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        checklist = self._checklist()
        if checklist.task.project.creator != self.request.user:
            raise PermissionDenied("Only the project creator can add checklist items.")
        order = checklist.items.count()
        serializer.save(checklist=checklist, order=order)


class TaskChecklistItemDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = TaskChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied
        task = _get_task_for_user(self.request.user, self.kwargs["task_id"])
        try:
            checklist = TaskChecklist.objects.get(id=self.kwargs["checklist_id"], task=task)
            item = TaskChecklistItem.objects.get(id=self.kwargs["item_id"], checklist=checklist)
        except (TaskChecklist.DoesNotExist, TaskChecklistItem.DoesNotExist):
            raise Http404
        # Creator can do anything; talents/clients can only toggle is_checked
        is_patch = self.request.method == "PATCH"
        is_toggle_only = is_patch and set(self.request.data.keys()) <= {"is_checked"}
        if not is_toggle_only and task.project.creator != self.request.user:
            raise PermissionDenied("Only the project creator can edit or delete checklist items.")
        return item


class ProjectSampleListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSampleSerializer
    permission_classes = [IsAuthenticated, IsCreator]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        return ProjectSample.objects.filter(project_id=project_id)

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs["project_id"])
        serializer.save(project=project)


class ProjectSampleDeleteView(generics.DestroyAPIView):
    serializer_class = ProjectSampleSerializer
    permission_classes = [IsAuthenticated, IsCreator]
    queryset = ProjectSample.objects.all()


# Talent Tasks View - Get all tasks assigned to current talent
class TalentTasksListView(generics.ListAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Task.objects.filter(assignees=user).select_related('project').distinct()


class CreatorAnalyticsView(APIView):
    """
    GET /api/v2/creator/analytics/?range=6m
    Aggregated dashboard analytics for a creator:
      - completion: approved deliverables per month (real completion events)
      - clients: newly-acquired distinct clients per month
      - talent: per team member output (current-standing snapshot)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "creator":
            return Response(
                {"error": "Only creators can access analytics."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Range → time buckets (oldest → newest); granularity scales with window ──
        from datetime import date, timedelta
        RANGES = {
            "24h": ("hour", 24),
            "7d":  ("day", 7),
            "30d": ("day", 30),
            "3m":  ("month", 3),
            "12m": ("month", 12),
            "24m": ("month", 24),
        }
        sel = str(request.query_params.get("range", "30d"))
        gran, count = RANGES.get(sel, ("day", 30))

        raw_now = timezone.now()
        now = timezone.localtime(raw_now) if timezone.is_aware(raw_now) else raw_now

        keys, labels = [], {}
        if gran == "hour":
            base = now.replace(minute=0, second=0, microsecond=0)
            for i in range(count - 1, -1, -1):
                dt = base - timedelta(hours=i)
                k = dt.strftime("%Y-%m-%d %H")
                keys.append(k)
                labels[k] = f"{dt.hour % 12 or 12}{'am' if dt.hour < 12 else 'pm'}"
            range_start = base - timedelta(hours=count - 1)
        elif gran == "day":
            base = now.replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(count - 1, -1, -1):
                dt = base - timedelta(days=i)
                k = dt.strftime("%Y-%m-%d")
                keys.append(k)
                labels[k] = f"{dt.strftime('%b')} {dt.day}"
            range_start = base - timedelta(days=count - 1)
        else:  # month
            months = []
            y, m = now.year, now.month
            for _ in range(count):
                months.append((y, m))
                m -= 1
                if m == 0:
                    m, y = 12, y - 1
            months.reverse()
            for (yy, mm) in months:
                k = f"{yy:04d}-{mm:02d}"
                keys.append(k)
                labels[k] = date(yy, mm, 1).strftime("%b")
            range_start = now.replace(
                year=months[0][0], month=months[0][1], day=1,
                hour=0, minute=0, second=0, microsecond=0,
            )

        def bucket(dt):
            d = timezone.localtime(dt) if timezone.is_aware(dt) else dt
            if gran == "hour":
                return d.strftime("%Y-%m-%d %H")
            if gran == "day":
                return d.strftime("%Y-%m-%d")
            return f"{d.year:04d}-{d.month:02d}"

        # ── Completion: approved deliverables per month ──
        completion_counts = {k: 0 for k in keys}
        approved_dates = Deliverable.objects.filter(
            task__project__creator=user,
            status="approved",
            updated_at__gte=range_start,
        ).values_list("updated_at", flat=True)
        for dt in approved_dates:
            key = bucket(dt)
            if key in completion_counts:
                completion_counts[key] += 1
        completion = [{"month": k, "label": labels[k], "approved": completion_counts[k]} for k in keys]

        # ── Client acquisition: new distinct clients per month (by earliest membership) ──
        from django.db.models import Min
        client_counts = {k: 0 for k in keys}
        first_joins = (
            ProjectClientMembership.objects
            .filter(project__creator=user)
            .values("client")
            .annotate(first=Min("added_at"))
        )
        for row in first_joins:
            first = row["first"]
            if first is None or first < range_start:
                continue
            key = bucket(first)
            if key in client_counts:
                client_counts[key] += 1
        clients = [{"month": k, "label": labels[k], "new_clients": client_counts[k]} for k in keys]

        # ── Talent performance: per accepted team member (current snapshot) ──
        from notification.models import HireRequest
        team = HireRequest.objects.filter(
            creator=user, status="accepted"
        ).select_related("talent")
        talent = []
        for hr in team:
            t = hr.talent
            dels = Deliverable.objects.filter(task__project__creator=user, submitted_by=t)
            submitted = dels.count()
            approved = dels.filter(status="approved").count()
            pending = dels.filter(status="pending").count()
            tasks_completed = Task.objects.filter(
                project__creator=user, assignees=t, status="completed"
            ).count()
            talent.append({
                "user_id": str(t.id),
                "name": t.full_name or t.email,
                "approved": approved,
                "submitted": submitted,
                "approval_rate": round(approved / submitted * 100) if submitted else 0,
                "tasks_completed": tasks_completed,
                "pending": pending,
            })

        return Response({
            "range": sel,
            "completion": completion,
            "clients": clients,
            "talent": talent,
        })


# Deliverable Views
class DeliverableListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DeliverableCreateSerializer
        return DeliverableSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            return Deliverable.objects.filter(
                task__project__creator=user
            ).prefetch_related('files', 'links')
        else:
            return Deliverable.objects.filter(
                submitted_by=user
            ).prefetch_related('files', 'links')

    def perform_create(self, serializer):
        from .models import DeliverableFile, DeliverableLink
        deliverable = serializer.save()

        for f in self.request.FILES.getlist('files', []):
            DeliverableFile.objects.create(
                deliverable=deliverable,
                file=f,
                name=f.name,
                size=f.size,
                file_type=f.content_type,
            )

        for url in self.request.data.getlist('urls', []):
            if url and url.strip():
                DeliverableLink.objects.create(deliverable=deliverable, url=url.strip())

        creator = deliverable.task.project.creator
        submitter = self.request.user
        from notification.services import create_notification
        create_notification(
            user=creator,
            title="Deliverable Submitted",
            message=f"{submitter.full_name} submitted a deliverable for \"{deliverable.task.name}\".",
            notification_type="system",
        )


class DeliverableDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = DeliverableSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "creator":
            return Deliverable.objects.filter(
                task__project__creator=user
            ).prefetch_related('files', 'links')
        else:
            return Deliverable.objects.filter(
                submitted_by=user
            ).prefetch_related('files', 'links')


class DeliverableReviewView(generics.UpdateAPIView):
    """Creator can approve or request revision on deliverables"""
    serializer_class = DeliverableReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != "creator":
            return Deliverable.objects.none()
        return Deliverable.objects.filter(task__project__creator=user)


# Conversation Views
class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)


class ConversationCreateView(APIView):
    """Get or create a conversation with another user"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        other_user_id = request.data.get("user_id")
        if not other_user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        from account.models import User
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if conversation already exists
        conversation = Conversation.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()

        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, other_user)

        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data)


# Message Views
class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs.get("conversation_id")
        user = self.request.user

        # Verify user is part of conversation
        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Message.objects.none()

        # Get messages between the two participants
        other_user = conversation.participants.exclude(id=user.id).first()
        if not other_user:
            return Message.objects.none()

        return Message.objects.filter(
            Q(sender=user, recipient=other_user) |
            Q(sender=other_user, recipient=user)
        ).order_by("created_at")


class MessageCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        user = request.user
        content = request.data.get("content")

        if not content:
            return Response({"error": "content is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Verify user is part of conversation
        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

        other_user = conversation.participants.exclude(id=user.id).first()
        if not other_user:
            return Response({"error": "Invalid conversation"}, status=status.HTTP_400_BAD_REQUEST)

        # Create message
        message = Message.objects.create(
            sender=user,
            recipient=other_user,
            content=content
        )

        # Update conversation
        conversation.last_message = message
        conversation.save()

        if other_user.role == "assistant":
            # Message sent TO the OnSwift Assistant: relay/ack instead of
            # notifying the (unmonitored) service account.
            try:
                from assistant.services import handle_message_to_assistant
                handle_message_to_assistant(sender=user, content=content)
            except Exception:
                import logging
                logging.getLogger(__name__).exception("Assistant reply handling failed")
        else:
            # Notify recipient
            from notification.services import create_notification
            create_notification(
                user=other_user,
                title="New Message",
                message=f"{user.full_name} sent you a message.",
                notification_type="system",
            )

        serializer = MessageSerializer(message, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        user = request.user

        try:
            conversation = Conversation.objects.get(id=conversation_id, participants=user)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

        # Mark all messages from other user as read
        other_user = conversation.participants.exclude(id=user.id).first()
        Message.objects.filter(
            sender=other_user,
            recipient=user,
            is_read=False
        ).update(is_read=True)

        return Response({"status": "ok"})


# ============================================
# Group Chat Views
# ============================================

class GroupListCreateView(generics.ListCreateAPIView):
    """List user's groups or create a new group"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return GroupCreateSerializer
        return GroupSerializer

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(memberships__user=user).distinct()


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a group"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return GroupUpdateSerializer
        return GroupSerializer

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(memberships__user=user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only admins can update/delete
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            try:
                membership = obj.memberships.get(user=request.user)
                if membership.role != "admin":
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only group admins can modify the group.")
            except GroupMembership.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You are not a member of this group.")


class GroupMembersView(APIView):
    """List members or add members to a group"""
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        """List group members"""
        try:
            group = Group.objects.get(id=group_id, memberships__user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        memberships = group.memberships.select_related('user')
        serializer = GroupMemberSerializer(memberships, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, group_id):
        """Add members to a group"""
        try:
            group = Group.objects.get(id=group_id)
            membership = group.memberships.get(user=request.user)
            if membership.role != "admin":
                return Response({"error": "Only admins can add members"}, status=status.HTTP_403_FORBIDDEN)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_403_FORBIDDEN)

        serializer = GroupAddMembersSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from account.models import User
        added = []
        for member_id in serializer.validated_data['member_ids']:
            try:
                user = User.objects.get(id=member_id)
                # Check if already a member
                if not group.memberships.filter(user=user).exists():
                    GroupMembership.objects.create(
                        group=group,
                        user=user,
                        role="member"
                    )
                    added.append(str(member_id))
            except User.DoesNotExist:
                continue

        return Response({"added": added}, status=status.HTTP_201_CREATED)


class GroupRemoveMemberView(APIView):
    """Remove a member from a group"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, group_id, user_id):
        try:
            group = Group.objects.get(id=group_id)
            requester_membership = group.memberships.get(user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_403_FORBIDDEN)

        # Only admins can remove others, but anyone can leave
        if str(request.user.id) != str(user_id) and requester_membership.role != "admin":
            return Response({"error": "Only admins can remove other members"}, status=status.HTTP_403_FORBIDDEN)

        try:
            membership_to_remove = group.memberships.get(user_id=user_id)
            
            # Prevent removing the last admin
            if membership_to_remove.role == "admin":
                admin_count = group.memberships.filter(role="admin").count()
                if admin_count <= 1:
                    return Response(
                        {"error": "Cannot remove the last admin. Promote another member first."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            membership_to_remove.delete()
            return Response({"status": "removed"}, status=status.HTTP_200_OK)
        except GroupMembership.DoesNotExist:
            return Response({"error": "User is not a member of this group"}, status=status.HTTP_404_NOT_FOUND)


class GroupLeaveView(APIView):
    """Leave a group"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
            membership = group.memberships.get(user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        except GroupMembership.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=status.HTTP_404_NOT_FOUND)

        # Prevent last admin from leaving
        if membership.role == "admin":
            admin_count = group.memberships.filter(role="admin").count()
            if admin_count <= 1 and group.memberships.count() > 1:
                return Response(
                    {"error": "You are the last admin. Promote another member first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        membership.delete()

        # If no members left, delete the group
        if group.memberships.count() == 0:
            group.delete()

        return Response({"status": "left"})


class GroupMessagesView(generics.ListAPIView):
    """List messages in a group"""
    serializer_class = GroupMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs.get('group_id')
        user = self.request.user

        # Verify user is a member
        try:
            Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return GroupMessage.objects.none()

        return GroupMessage.objects.filter(group_id=group_id).order_by('created_at')


class GroupMessageCreateView(APIView):
    """Send a message to a group"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user
        content = request.data.get('content')
        mention_ids = request.data.get('mention_ids', [])

        if not content:
            return Response({"error": "content is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Verify user is a member
        try:
            group = Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = GroupMessageCreateSerializer(
            data={'content': content, 'mention_ids': mention_ids},
            context={'request': request, 'group': group}
        )

        if serializer.is_valid():
            message = serializer.save()
            return Response(
                GroupMessageSerializer(message, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupMessagesMarkReadView(APIView):
    """Mark all messages in a group as read"""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        user = request.user

        try:
            group = Group.objects.get(id=group_id, memberships__user=user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get all unread messages
        unread_messages = group.messages.exclude(
            read_statuses__user=user
        )

        # Create read status for each
        for message in unread_messages:
            GroupMessageReadStatus.objects.get_or_create(
                message=message,
                user=user
            )

        return Response({"status": "ok"})


class AvailableMembersView(APIView):
    """Get available team members that can be added to a group"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'creator':
            return Response({"error": "Only creators can access this endpoint"}, status=status.HTTP_403_FORBIDDEN)

        # Get accepted team members from HireRequest
        from notification.models import HireRequest
        
        accepted_hires = HireRequest.objects.filter(
            creator=user,
            status="accepted"
        ).select_related('talent', 'talent__talentprofile')

        members = []
        for hire in accepted_hires:
            talent = hire.talent
            avatar = None
            try:
                if talent.talentprofile.avatar:
                    avatar = request.build_absolute_uri(talent.talentprofile.avatar.url)
            except AttributeError:
                pass

            role = "Talent"
            try:
                role = talent.talentprofile.professional_title or "Talent"
            except AttributeError:
                pass

            members.append({
                'userId': str(talent.id),
                'name': talent.full_name,
                'email': talent.email,
                'role': role,
                'avatar': avatar,
            })

        return Response(members)


# Google Calendar Views
class GoogleCalendarStatusView(APIView):
    """Check if user has connected Google Calendar"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            GoogleCalendarToken.objects.get(user=request.user)
            synced_count = CalendarSyncedTask.objects.filter(user=request.user).count()
            return Response({
                'is_connected': True,
                'synced_tasks_count': synced_count,
            })
        except GoogleCalendarToken.DoesNotExist:
            return Response({
                'is_connected': False,
                'synced_tasks_count': 0,
            })


class GoogleCalendarConnectView(generics.CreateAPIView):
    """Store Google OAuth tokens after frontend OAuth flow"""
    permission_classes = [IsAuthenticated]
    serializer_class = GoogleCalendarConnectSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'message': 'Google Calendar connected successfully',
            'is_connected': True
        }, status=status.HTTP_201_CREATED)


class GoogleCalendarDisconnectView(APIView):
    """Disconnect Google Calendar"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        GoogleCalendarToken.objects.filter(user=request.user).delete()
        CalendarSyncedTask.objects.filter(user=request.user).delete()
        return Response({
            'message': 'Google Calendar disconnected',
            'is_connected': False
        }, status=status.HTTP_200_OK)


class SyncTaskToCalendarView(APIView):
    """Sync a single task to Google Calendar"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = TaskSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        task_id = serializer.validated_data['task_id']
        task = Task.objects.get(id=task_id)
        
        event_id = google_calendar.create_calendar_event(request.user, task)
        
        if event_id:
            return Response({
                'message': 'Task synced to Google Calendar',
                'google_event_id': event_id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'error': 'Failed to sync task. Make sure Google Calendar is connected and the task has a deadline.'
            }, status=status.HTTP_400_BAD_REQUEST)


class UnsyncTaskFromCalendarView(APIView):
    """Remove a task from Google Calendar"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, task_id, *args, **kwargs):
        try:
            task = Task.objects.get(id=task_id)
            success = google_calendar.delete_calendar_event(request.user, task)
            
            if success:
                return Response({
                    'message': 'Task removed from Google Calendar'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Failed to remove task from calendar'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Task.DoesNotExist:
            return Response({
                'error': 'Task not found'
            }, status=status.HTTP_404_NOT_FOUND)


class SyncAllTasksView(APIView):
    """Sync all tasks to Google Calendar"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        result = google_calendar.sync_all_tasks(request.user)
        
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'message': f"Synced {result['success']} tasks, {result['failed']} failed",
            **result
        }, status=status.HTTP_200_OK)


class SyncedTasksListView(generics.ListAPIView):
    """List all synced tasks for the current user"""
    permission_classes = [IsAuthenticated]
    serializer_class = CalendarSyncedTaskSerializer

    def get_queryset(self):
        return CalendarSyncedTask.objects.filter(user=self.request.user)



