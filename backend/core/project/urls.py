from django.urls import path
from .views import (
    ProjectListCreateView,
    ProjectDetailView,
    TaskListCreateView,
    TaskDetailView,
    ProjectSampleDeleteView,
    ProjectSampleListCreateView,
    TalentTasksListView,
    DeliverableListCreateView,
    DeliverableDetailView,
    DeliverableReviewView,
    ConversationListView,
    ConversationCreateView,
    MessageListView,
    MessageCreateView,
    MessageMarkReadView,
)

urlpatterns = [
    # Projects
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<uuid:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<uuid:project_id>/tasks/", TaskListCreateView.as_view(), name="task-list-create"),
    path("projects/<uuid:project_id>/samples/", ProjectSampleListCreateView.as_view(), name="project-sample-list-create"),
    path("project-samples/<uuid:pk>/delete/", ProjectSampleDeleteView.as_view(), name="project-sample-delete"),

    # Tasks
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("my-tasks/", TalentTasksListView.as_view(), name="talent-tasks"),

    # Deliverables
    path("deliverables/", DeliverableListCreateView.as_view(), name="deliverable-list-create"),
    path("deliverables/<uuid:pk>/", DeliverableDetailView.as_view(), name="deliverable-detail"),
    path("deliverables/<uuid:pk>/review/", DeliverableReviewView.as_view(), name="deliverable-review"),

    # Conversations & Messages
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/start/", ConversationCreateView.as_view(), name="conversation-create"),
    path("conversations/<uuid:conversation_id>/messages/", MessageListView.as_view(), name="message-list"),
    path("conversations/<uuid:conversation_id>/messages/send/", MessageCreateView.as_view(), name="message-create"),
    path("conversations/<uuid:conversation_id>/messages/read/", MessageMarkReadView.as_view(), name="message-mark-read"),
]
