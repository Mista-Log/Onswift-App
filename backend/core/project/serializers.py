from rest_framework import serializers
from .models import Project, Task
from .models import ProjectSample, TeamMember

class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True)
    class Meta:
        model = Task
        fields = ["id", "project", "name", "description", "assignee", "assignee_name", "status", "deadline", "created_at"]

class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ("id", "name", "avatar")

class ProjectSerializer(serializers.ModelSerializer):
    teamMembers = TeamMemberSerializer(
        many=True,
        source="team_members",
        required=False
    )
    creator = serializers.ReadOnlyField(source="creator.id")

    class Meta:
        model = Project
        fields = (
            "id",
            "creator",
            "name",
            "description",
            "due_date",
            "status",
            "teamMembers",
            "task_count",
            "completed_tasks",
            "created_at",
        )

    def create(self, validated_data):
        team_members_data = validated_data.pop("team_members", [])
        project = Project.objects.create(**validated_data)

        for member in team_members_data:
            TeamMember.objects.create(project=project, **member)

        return project


class ProjectSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectSample
        fields = [
            "id",
            "project",
            "name",
            "type",
            "file",
            "url",
            "description",
            "created_at",
        ]
        read_only_fields = ["project", "created_at"]

