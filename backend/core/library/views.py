"""
Library views — Creator-only Document Library with full CRUD,
versioning, sharing, tagging, and activity logging.
"""
from rest_framework.views import APIView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta

from .models import Folder, Document, DocumentVersion, DocumentActivity, DocumentShareLink
from .serializers import (
    FolderSerializer,
    FolderCreateSerializer,
    FolderRenameSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
    DocumentUpdateSerializer,
    DocumentReuploadSerializer,
    DocumentVersionSerializer,
    DocumentActivitySerializer,
    DocumentShareLinkSerializer,
    DocumentShareLinkCreateSerializer,
)


class IsCreatorRole(permissions.BasePermission):
    """Only allow users with role='creator'."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "creator"


# ── Folder CRUD ───────────────────────────────────────────────────────

class FolderListView(APIView):
    """
    GET /api/v6/folders/
    Returns folder tree for the authenticated creator.
    Query params: ?parent_id=<uuid> (filter by parent, null for root)
                  ?type=<CLIENT|TEMPLATE|INTERNAL>
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request):
        qs = Folder.objects.filter(creator=request.user)

        parent_id = request.query_params.get("parent_id")
        if parent_id == "null" or parent_id == "":
            qs = qs.filter(parent_folder__isnull=True)
        elif parent_id:
            qs = qs.filter(parent_folder_id=parent_id)

        folder_type = request.query_params.get("type")
        if folder_type:
            qs = qs.filter(folder_type=folder_type.upper())

        return Response(FolderSerializer(qs, many=True).data)


class FolderCreateView(APIView):
    """
    POST /api/v6/folders/
    Create a new folder.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def post(self, request):
        serializer = FolderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Verify parent folder ownership
        parent = None
        if data.get("parent_folder_id"):
            try:
                parent = Folder.objects.get(
                    id=data["parent_folder_id"],
                    creator=request.user,
                )
            except Folder.DoesNotExist:
                return Response(
                    {"error": "Parent folder not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        folder = Folder.objects.create(
            creator=request.user,
            parent_folder=parent,
            name=data["name"],
            folder_type=data.get("folder_type", "INTERNAL"),
            client_id=data.get("client_id"),
        )

        return Response(
            FolderSerializer(folder).data,
            status=status.HTTP_201_CREATED,
        )


class FolderDetailView(APIView):
    """
    GET    /api/v6/folders/<id>/  — Retrieve folder with contents
    PATCH  /api/v6/folders/<id>/  — Rename folder
    DELETE /api/v6/folders/<id>/  — Delete folder (and all contents)
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request, pk):
        try:
            folder = Folder.objects.get(id=pk, creator=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)

        subfolders = Folder.objects.filter(parent_folder=folder, creator=request.user)
        documents = Document.objects.filter(folder=folder, creator=request.user, is_deleted=False)

        return Response({
            "folder": FolderSerializer(folder).data,
            "subfolders": FolderSerializer(subfolders, many=True).data,
            "documents": DocumentSerializer(documents, many=True).data,
        })

    def patch(self, request, pk):
        try:
            folder = Folder.objects.get(id=pk, creator=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = FolderRenameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        folder.name = serializer.validated_data["name"]
        folder.save(update_fields=["name"])

        return Response(FolderSerializer(folder).data)

    def delete(self, request, pk):
        try:
            folder = Folder.objects.get(id=pk, creator=request.user)
        except Folder.DoesNotExist:
            return Response({"error": "Folder not found"}, status=status.HTTP_404_NOT_FOUND)

        folder.delete()
        return Response({"message": "Folder deleted"}, status=status.HTTP_200_OK)


# ── Document CRUD ─────────────────────────────────────────────────────

class DocumentUploadView(APIView):
    """
    POST /api/v6/documents/
    Upload a file to a folder. If a file with the same name exists in
    the folder, the old file is archived as a version and the new file
    replaces it (version increment).
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Verify folder ownership
        try:
            folder = Folder.objects.get(id=data["folder_id"], creator=request.user)
        except Folder.DoesNotExist:
            return Response(
                {"error": "Folder not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        uploaded_file = data["file"]
        file_name = uploaded_file.name
        file_type = uploaded_file.content_type or ""
        size_kb = uploaded_file.size / 1024

        # Check for existing file with same name → version it
        existing = Document.objects.filter(
            folder=folder,
            creator=request.user,
            name=file_name,
            is_deleted=False,
        ).first()

        if existing:
            # Archive current version
            DocumentVersion.objects.create(
                document=existing,
                version_number=existing.version,
                file=existing.file,
                file_type=existing.file_type,
                size_kb=existing.size_kb,
                uploaded_by=request.user,
            )

            # Update document with new file
            existing.file = uploaded_file
            existing.file_type = file_type
            existing.size_kb = size_kb
            existing.version += 1
            existing.tags = data.get("tags", existing.tags)
            if data.get("color_label"):
                existing.color_label = data["color_label"]
            existing.save()

            doc = existing
        else:
            # Create new document
            doc = Document.objects.create(
                creator=request.user,
                folder=folder,
                client=folder.client,
                name=file_name,
                file=uploaded_file,
                file_type=file_type,
                size_kb=size_kb,
                tags=data.get("tags", []),
                color_label=data.get("color_label", ""),
            )

        # Log activity
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="UPLOADED",
        )

        return Response(
            DocumentSerializer(doc).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentListView(APIView):
    """
    GET /api/v6/documents/
    List documents, optionally filtered by folder.
    Always scoped to the authenticated creator. Excludes soft-deleted.
    Query params: ?folder_id=<uuid>
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request):
        qs = Document.objects.filter(
            creator=request.user,
            is_deleted=False,
        ).select_related("folder")

        folder_id = request.query_params.get("folder_id")
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        return Response(DocumentSerializer(qs, many=True).data)


class DocumentDetailView(APIView):
    """
    GET    /api/v6/documents/<id>/  — Retrieve document detail + log view
    PATCH  /api/v6/documents/<id>/  — Update metadata (name, tags, color_label, is_locked)
    DELETE /api/v6/documents/<id>/  — Soft-delete document
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        # Log view activity
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="VIEWED",
        )

        return Response(DocumentSerializer(doc).data)

    def patch(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        if doc.is_locked:
            return Response(
                {"error": "Document is locked. Unlock it before making changes."},
                status=status.HTTP_423_LOCKED,
            )

        serializer = DocumentUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field in ["name", "tags", "color_label", "is_locked"]:
            if field in data:
                setattr(doc, field, data[field])

        # Allow manual date override
        if "created_at" in data:
            doc.created_at = data["created_at"]

        doc.save()

        # Log edit activity
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="EDITED",
        )

        return Response(DocumentSerializer(doc).data)

    def delete(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        doc.soft_delete()

        # Log deletion
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="DELETED",
        )

        return Response({"message": "Document moved to trash"})


class DocumentReuploadView(APIView):
    """
    POST /api/v6/documents/<id>/reupload/
    Upload a new version of an existing document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        if doc.is_locked:
            return Response(
                {"error": "Document is locked."},
                status=status.HTTP_423_LOCKED,
            )

        serializer = DocumentReuploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]

        # Archive current version
        DocumentVersion.objects.create(
            document=doc,
            version_number=doc.version,
            file=doc.file,
            file_type=doc.file_type,
            size_kb=doc.size_kb,
            uploaded_by=request.user,
        )

        # Update document
        doc.file = uploaded_file
        doc.file_type = uploaded_file.content_type or ""
        doc.size_kb = uploaded_file.size / 1024
        doc.version += 1
        doc.save()

        # Log activity
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="UPLOADED",
        )

        return Response(DocumentSerializer(doc).data)


# ── Trash Management ──────────────────────────────────────────────────

class DocumentTrashListView(APIView):
    """
    GET /api/v6/documents/trash/
    List soft-deleted documents (recoverable for 30 days).
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request):
        cutoff = timezone.now() - timedelta(days=30)
        docs = Document.objects.filter(
            creator=request.user,
            is_deleted=True,
            deleted_at__gte=cutoff,
        )
        return Response(DocumentSerializer(docs, many=True).data)


class DocumentRestoreView(APIView):
    """
    POST /api/v6/documents/<id>/restore/
    Restore a soft-deleted document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def post(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user, is_deleted=True)
        except Document.DoesNotExist:
            return Response({"error": "Document not found in trash"}, status=status.HTTP_404_NOT_FOUND)

        doc.restore()

        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="RESTORED",
        )

        return Response(DocumentSerializer(doc).data)


class DocumentPermanentDeleteView(APIView):
    """
    DELETE /api/v6/documents/<id>/permanent/
    Permanently delete a document from trash.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def delete(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user, is_deleted=True)
        except Document.DoesNotExist:
            return Response({"error": "Document not found in trash"}, status=status.HTTP_404_NOT_FOUND)

        doc.delete()  # Cascade deletes versions and activities too
        return Response({"message": "Document permanently deleted"})


# ── Version History ───────────────────────────────────────────────────

class DocumentVersionListView(APIView):
    """
    GET /api/v6/documents/<id>/versions/
    List all previous versions of a document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        versions = DocumentVersion.objects.filter(document=doc)
        return Response(DocumentVersionSerializer(versions, many=True).data)


# ── Activity Log ──────────────────────────────────────────────────────

class DocumentActivityListView(APIView):
    """
    GET /api/v6/documents/<id>/activity/
    Activity log for a specific document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        activities = DocumentActivity.objects.filter(document=doc)
        return Response(DocumentActivitySerializer(activities, many=True).data)


# ── Search ────────────────────────────────────────────────────────────

class DocumentSearchView(APIView):
    """
    GET /api/v6/search/?q=<query>
    Full-text search across file names and tags.
    Scoped to the authenticated creator only. Max 50 results.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"results": []})

        results = Document.objects.filter(
            creator=request.user,
            is_deleted=False,
        ).filter(
            Q(name__icontains=query) | Q(tags__icontains=query)
        ).select_related("folder")[:50]

        return Response({
            "results": DocumentSerializer(results, many=True).data,
            "count": len(results),
        })


# ── Share Links ───────────────────────────────────────────────────────

class DocumentShareLinkCreateView(APIView):
    """
    POST /api/v6/documents/<id>/share/
    Generate a time-limited sharing link for a document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def post(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = DocumentShareLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        link = DocumentShareLink.objects.create(
            document=doc,
            permission=serializer.validated_data["permission"],
            expires_at=serializer.validated_data["expires_at"],
            created_by=request.user,
        )

        # Log activity
        DocumentActivity.objects.create(
            document=doc,
            actor=request.user,
            actor_role=request.user.role,
            action="SHARED",
        )

        return Response(
            DocumentShareLinkSerializer(link, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentShareLinkListView(APIView):
    """
    GET /api/v6/documents/<id>/share/
    List all share links for a document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def get(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        links = DocumentShareLink.objects.filter(document=doc)
        return Response(
            DocumentShareLinkSerializer(links, many=True, context={"request": request}).data
        )


class SharedDocumentPublicView(APIView):
    """
    GET /api/v6/shared/<slug>/
    Public endpoint — returns document info for a valid share link.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        try:
            link = DocumentShareLink.objects.select_related("document").get(slug=slug)
        except DocumentShareLink.DoesNotExist:
            return Response(
                {"error": "Share link not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return Response(
                {"error": "This share link has expired"},
                status=status.HTTP_410_GONE,
            )

        doc = link.document
        return Response({
            "name": doc.name,
            "file": doc.file.url if doc.file else None,
            "file_type": doc.file_type,
            "size_kb": doc.size_kb,
            "permission": link.permission,
            "expires_at": link.expires_at,
        })


# ── Lock Toggle ───────────────────────────────────────────────────────

class DocumentLockToggleView(APIView):
    """
    POST /api/v6/documents/<id>/lock/
    Toggle the lock state of a document.
    """
    permission_classes = [permissions.IsAuthenticated, IsCreatorRole]

    def post(self, request, pk):
        try:
            doc = Document.objects.get(id=pk, creator=request.user)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        doc.is_locked = not doc.is_locked
        doc.save(update_fields=["is_locked"])

        return Response({
            "is_locked": doc.is_locked,
            "message": f"Document {'locked' if doc.is_locked else 'unlocked'}",
        })
