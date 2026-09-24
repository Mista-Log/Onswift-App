import uuid

from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PersonalTask, Project


def linkable_projects(user):
    """Projects a user may attach a personal task to."""
    if user.role == "creator":
        return Project.objects.filter(creator=user)
    if user.role == "talent":
        # Talents follow the same opt-in rule as project tasks: the creator must
        # have enabled task creation on a project the talent already works in.
        return Project.objects.filter(
            allow_talent_task_creation=True, tasks__assignees=user
        ).distinct()
    return Project.objects.none()


def can_create_personal_tasks(user):
    if user.role == "creator":
        return True
    return user.role == "talent" and linkable_projects(user).exists()


class PersonalTaskSerializer(serializers.ModelSerializer):
    linked_project_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Project.objects.all(),
        source="linked_projects",
        write_only=True,
        required=False,
    )
    linked_projects = serializers.SerializerMethodField()
    is_personal = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTask
        fields = [
            "id", "name", "description", "status", "deadline",
            "linked_project_ids", "linked_projects", "is_personal",
            "completed_at", "created_at",
        ]
        read_only_fields = ["completed_at", "created_at"]

    def get_linked_projects(self, obj):
        return [{"id": str(p.id), "name": p.name} for p in obj.linked_projects.all()]

    def get_is_personal(self, obj):
        return True

    def validate_linked_project_ids(self, projects):
        allowed = set(linkable_projects(self.context["request"].user).values_list("id", flat=True))
        if any(p.id not in allowed for p in projects):
            raise serializers.ValidationError("You can only link projects you have access to.")
        return projects

    def create(self, validated_data):
        projects = validated_data.pop("linked_projects", [])
        if validated_data.get("status") == "completed":
            validated_data["completed_at"] = timezone.now()
        task = super().create(validated_data)
        task.linked_projects.set(projects)
        return task

    def update(self, instance, validated_data):
        projects = validated_data.pop("linked_projects", None)
        new_status = validated_data.get("status")
        if new_status == "completed" and instance.status != "completed":
            validated_data["completed_at"] = timezone.now()
        elif new_status and new_status != "completed":
            validated_data["completed_at"] = None
        task = super().update(instance, validated_data)
        if projects is not None:
            task.linked_projects.set(projects)
        return task


class PersonalTaskListCreateView(generics.ListCreateAPIView):
    serializer_class = PersonalTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PersonalTask.objects.filter(owner=self.request.user).prefetch_related("linked_projects")
        project_id = self.request.query_params.get("project")
        if project_id:
            try:
                uuid.UUID(project_id)
            except ValueError:
                return qs.none()
            qs = qs.filter(linked_projects__id=project_id)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not can_create_personal_tasks(user):
            raise PermissionDenied(
                "Personal tasks aren't available yet. Ask the project creator to allow task creation."
            )
        serializer.save(owner=user)


class PersonalTaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PersonalTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PersonalTask.objects.filter(owner=self.request.user).prefetch_related("linked_projects")


class PersonalTaskEligibilityView(APIView):
    """GET /personal-tasks/eligibility/ -> whether the user may add personal tasks, and which projects they can link."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "allowed": can_create_personal_tasks(request.user),
            "projects": [
                {"id": str(p.id), "name": p.name} for p in linkable_projects(request.user)
            ],
        })
