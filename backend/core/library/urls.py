"""Library URL configuration."""
from django.urls import path
from .views import (
    # Folders
    FolderListView,
    FolderCreateView,
    FolderDetailView,
    # Documents
    DocumentUploadView,
    DocumentListView,
    DocumentDetailView,
    DocumentReuploadView,
    # Trash
    DocumentTrashListView,
    DocumentRestoreView,
    DocumentPermanentDeleteView,
    # Versioning
    DocumentVersionListView,
    # Activity
    DocumentActivityListView,
    # Search
    DocumentSearchView,
    # Sharing
    DocumentShareLinkCreateView,
    DocumentShareLinkListView,
    SharedDocumentPublicView,
    # Lock
    DocumentLockToggleView,
)

urlpatterns = [
    # Folders
    path("folders/", FolderListView.as_view(), name="library-folder-list"),
    path("folders/create/", FolderCreateView.as_view(), name="library-folder-create"),
    path("folders/<uuid:pk>/", FolderDetailView.as_view(), name="library-folder-detail"),

    # Documents
    path("documents/", DocumentListView.as_view(), name="library-document-list"),
    path("documents/upload/", DocumentUploadView.as_view(), name="library-document-upload"),
    path("documents/trash/", DocumentTrashListView.as_view(), name="library-trash"),
    path("documents/<uuid:pk>/", DocumentDetailView.as_view(), name="library-document-detail"),
    path("documents/<uuid:pk>/reupload/", DocumentReuploadView.as_view(), name="library-document-reupload"),
    path("documents/<uuid:pk>/restore/", DocumentRestoreView.as_view(), name="library-document-restore"),
    path("documents/<uuid:pk>/permanent/", DocumentPermanentDeleteView.as_view(), name="library-document-permanent-delete"),
    path("documents/<uuid:pk>/versions/", DocumentVersionListView.as_view(), name="library-document-versions"),
    path("documents/<uuid:pk>/activity/", DocumentActivityListView.as_view(), name="library-document-activity"),
    path("documents/<uuid:pk>/share/", DocumentShareLinkCreateView.as_view(), name="library-document-share-create"),
    path("documents/<uuid:pk>/shares/", DocumentShareLinkListView.as_view(), name="library-document-share-list"),
    path("documents/<uuid:pk>/lock/", DocumentLockToggleView.as_view(), name="library-document-lock"),

    # Search
    path("search/", DocumentSearchView.as_view(), name="library-search"),

    # Public shared document
    path("shared/<str:slug>/", SharedDocumentPublicView.as_view(), name="library-shared-document"),
]
