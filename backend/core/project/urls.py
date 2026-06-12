from django.urls import path
from .views import (
    ProjectListCreateView,
    ProjectDetailView,
    ProjectCompleteView,
    ProjectArchiveView,
    TaskListCreateView,
    TaskDetailView,
    TaskCommentListCreateView,
    TaskCommentDeleteView,
    TaskAttachmentListCreateView,
    TaskAttachmentDeleteView,
    TaskChecklistListCreateView,
    TaskChecklistDetailView,
    TaskChecklistItemListCreateView,
    TaskChecklistItemDetailView,
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
    # Group Chat Views
    GroupListCreateView,
    GroupDetailView,
    GroupMembersView,
    GroupRemoveMemberView,
    GroupLeaveView,
    GroupMessagesView,
    GroupMessageCreateView,
    GroupMessagesMarkReadView,
    AvailableMembersView,
    # Google Calendar Views
    GoogleCalendarStatusView,
    GoogleCalendarConnectView,
    GoogleCalendarDisconnectView,
    SyncTaskToCalendarView,
    UnsyncTaskFromCalendarView,
    SyncAllTasksView,
    SyncedTasksListView,
)

urlpatterns = [
    # Projects
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<uuid:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<uuid:project_id>/complete/", ProjectCompleteView.as_view(), name="project-complete"),
    path("projects/<uuid:project_id>/archive/", ProjectArchiveView.as_view(), name="project-archive"),
    path("projects/<uuid:project_id>/tasks/", TaskListCreateView.as_view(), name="task-list-create"),
    path("projects/<uuid:project_id>/samples/", ProjectSampleListCreateView.as_view(), name="project-sample-list-create"),
    path("project-samples/<uuid:pk>/delete/", ProjectSampleDeleteView.as_view(), name="project-sample-delete"),

    # Tasks
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("my-tasks/", TalentTasksListView.as_view(), name="talent-tasks"),

    # Task Comments
    path("tasks/<uuid:task_id>/comments/", TaskCommentListCreateView.as_view(), name="task-comment-list"),
    path("tasks/<uuid:task_id>/comments/<uuid:comment_id>/", TaskCommentDeleteView.as_view(), name="task-comment-delete"),

    # Task Attachments
    path("tasks/<uuid:task_id>/attachments/", TaskAttachmentListCreateView.as_view(), name="task-attachment-list"),
    path("tasks/<uuid:task_id>/attachments/<uuid:attachment_id>/", TaskAttachmentDeleteView.as_view(), name="task-attachment-delete"),

    # Task Checklists
    path("tasks/<uuid:task_id>/checklists/", TaskChecklistListCreateView.as_view(), name="task-checklist-list"),
    path("tasks/<uuid:task_id>/checklists/<uuid:checklist_id>/", TaskChecklistDetailView.as_view(), name="task-checklist-detail"),
    path("tasks/<uuid:task_id>/checklists/<uuid:checklist_id>/items/", TaskChecklistItemListCreateView.as_view(), name="task-checklist-item-list"),
    path("tasks/<uuid:task_id>/checklists/<uuid:checklist_id>/items/<uuid:item_id>/", TaskChecklistItemDetailView.as_view(), name="task-checklist-item-detail"),

    # Deliverables
    path("deliverables/", DeliverableListCreateView.as_view(), name="deliverable-list-create"),
    path("deliverables/<uuid:pk>/", DeliverableDetailView.as_view(), name="deliverable-detail"),
    path("deliverables/<uuid:pk>/review/", DeliverableReviewView.as_view(), name="deliverable-review"),

    # Conversations & Messages (1-on-1)
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/start/", ConversationCreateView.as_view(), name="conversation-create"),
    path("conversations/<uuid:conversation_id>/messages/", MessageListView.as_view(), name="message-list"),
    path("conversations/<uuid:conversation_id>/messages/send/", MessageCreateView.as_view(), name="message-create"),
    path("conversations/<uuid:conversation_id>/messages/read/", MessageMarkReadView.as_view(), name="message-mark-read"),

    # Group Chat
    path("groups/", GroupListCreateView.as_view(), name="group-list-create"),
    path("groups/available-members/", AvailableMembersView.as_view(), name="available-members"),
    path("groups/<uuid:pk>/", GroupDetailView.as_view(), name="group-detail"),
    path("groups/<uuid:group_id>/members/", GroupMembersView.as_view(), name="group-members"),
    path("groups/<uuid:group_id>/members/<uuid:user_id>/", GroupRemoveMemberView.as_view(), name="group-remove-member"),
    path("groups/<uuid:group_id>/leave/", GroupLeaveView.as_view(), name="group-leave"),
    path("groups/<uuid:group_id>/messages/", GroupMessagesView.as_view(), name="group-messages"),
    path("groups/<uuid:group_id>/messages/send/", GroupMessageCreateView.as_view(), name="group-message-create"),
    path("groups/<uuid:group_id>/messages/read/", GroupMessagesMarkReadView.as_view(), name="group-messages-read"),

    # Google Calendar Integration
    path("calendar/status/", GoogleCalendarStatusView.as_view(), name="calendar-status"),
    path("calendar/connect/", GoogleCalendarConnectView.as_view(), name="calendar-connect"),
    path("calendar/disconnect/", GoogleCalendarDisconnectView.as_view(), name="calendar-disconnect"),
    path("calendar/sync/", SyncTaskToCalendarView.as_view(), name="calendar-sync-task"),
    path("calendar/sync-all/", SyncAllTasksView.as_view(), name="calendar-sync-all"),
    path("calendar/unsync/<uuid:task_id>/", UnsyncTaskFromCalendarView.as_view(), name="calendar-unsync"),
    path("calendar/synced/", SyncedTasksListView.as_view(), name="calendar-synced-list"),
]
