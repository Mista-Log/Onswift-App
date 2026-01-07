from django.urls import path
from .views import (
    ProjectListCreateView,
    ProjectDetailView,
    TaskListCreateView,
    TaskDetailView,
    ProjectSampleDeleteView, 
    ProjectSampleListCreateView,
)

urlpatterns = [
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<uuid:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<uuid:project_id>/tasks/", TaskListCreateView.as_view(), name="task-list-create"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("projects/<uuid:project_id>/samples/", ProjectSampleListCreateView.as_view(), name="project-sample-list-create",),
    path("project-samples/<uuid:pk>/delete/", ProjectSampleDeleteView.as_view(), name="project-sample-delete",),

]
