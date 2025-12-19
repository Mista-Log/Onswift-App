from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Project, Task, ProjectSample
from .serializers import ProjectSerializer, TaskSerializer
from .permissions import IsCreator
from rest_framework import permissions

from .serializers import ProjectSampleSerializer

# Project Views
class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # User only sees their own projects
        return Project.objects.filter(creator=self.request.user)

    def perform_create(self, serializer):
        # Automatically assign creator
        serializer.save(creator=self.request.user)



class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreator]

    def get_queryset(self):
        return Project.objects.filter(creator=self.request.user)


# Task Views
class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project = Project.objects.get(
            id=self.kwargs["project_id"],
            creator=self.request.user
        )
        return project.tasks.all()

    def perform_create(self, serializer):
        project = Project.objects.get(
            id=self.kwargs["project_id"],
            creator=self.request.user
        )
        serializer.save(project=project)



class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsCreator]
    queryset = Task.objects.all()


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
