from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.contrib.auth import get_user_model

from .models import Doc, DocAccess
from .serializers import DocListSerializer, DocDetailSerializer, DocCreateSerializer, DocAccessSerializer

User = get_user_model()
ALLOWED_ROLES = {"creator", "talent"}


class IsDocUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ALLOWED_ROLES


class DocListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsDocUser]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DocCreateSerializer
        return DocListSerializer

    def get_queryset(self):
        user = self.request.user
        shared_ids = DocAccess.objects.filter(user=user).values_list("doc_id", flat=True)
        qs = Doc.objects.filter(Q(owner=user) | Q(id__in=shared_ids))
        if not self.request.query_params.get("all"):
            qs = qs.filter(parent=None)
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(owner=request.user)
        return Response(DocDetailSerializer(doc, context={"request": request}).data, status=status.HTTP_201_CREATED)


class DocDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsDocUser]
    serializer_class = DocDetailSerializer

    def get_object(self):
        doc = get_object_or_404(Doc, id=self.kwargs["pk"])
        user = self.request.user
        if doc.owner == user:
            return doc
        access = DocAccess.objects.filter(doc=doc, user=user).first()
        if not access:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this document.")
        if self.request.method == "DELETE":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the owner can delete this document.")
        if self.request.method in ("PATCH", "PUT") and access.role == "viewer":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Viewers cannot edit this document.")
        return doc

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class DocChildrenView(APIView):
    permission_classes = [IsDocUser]

    def get(self, request, pk):
        parent = get_object_or_404(Doc, id=pk, owner=request.user)
        children = parent.children.all()
        return Response(DocListSerializer(children, many=True).data)


# ── Sharable Users (talents hired by this creator) ────────────────────────────

class DocSharableUsersView(APIView):
    """GET /api/v8/sharable-users/ — talents the creator has on their team."""
    permission_classes = [IsDocUser]

    def get(self, request):
        if request.user.role != "creator":
            return Response([])

        from notification.models import HireRequest

        users = []
        seen_ids = set()

        for hr in HireRequest.objects.filter(
            creator=request.user, status="accepted"
        ).select_related("talent"):
            t = hr.talent
            if t.id not in seen_ids:
                seen_ids.add(t.id)
                users.append({
                    "user_id": str(t.id),
                    "name": t.full_name or t.email,
                    "email": t.email,
                })

        return Response(users)


# ── Doc Access / Sharing ──────────────────────────────────────────────────────

class DocAccessListView(APIView):
    """GET list of shared users; POST to share with a user by email."""
    permission_classes = [IsDocUser]

    def get(self, request, pk):
        doc = get_object_or_404(Doc, id=pk)
        if doc.owner != request.user:
            if not DocAccess.objects.filter(doc=doc, user=request.user).exists():
                return Response(status=status.HTTP_403_FORBIDDEN)
        access_list = doc.access_list.select_related("user").all()
        return Response(DocAccessSerializer(access_list, many=True).data)

    def post(self, request, pk):
        doc = get_object_or_404(Doc, id=pk, owner=request.user)
        email = request.data.get("email", "").strip().lower()
        role = request.data.get("role", "viewer")
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ("viewer", "editor"):
            return Response({"error": "Role must be 'viewer' or 'editor'."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"error": "No user found with that email."}, status=status.HTTP_404_NOT_FOUND)
        if target == request.user:
            return Response({"error": "Cannot share a doc with yourself."}, status=status.HTTP_400_BAD_REQUEST)
        access, created = DocAccess.objects.get_or_create(doc=doc, user=target, defaults={"role": role})
        if not created:
            access.role = role
            access.save(update_fields=["role"])
        return Response(DocAccessSerializer(access).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DocAccessDetailView(APIView):
    """PATCH to change role; DELETE to revoke access."""
    permission_classes = [IsDocUser]

    def patch(self, request, pk, access_id):
        doc = get_object_or_404(Doc, id=pk, owner=request.user)
        access = get_object_or_404(DocAccess, id=access_id, doc=doc)
        role = request.data.get("role")
        if role not in ("viewer", "editor"):
            return Response({"error": "Role must be 'viewer' or 'editor'."}, status=status.HTTP_400_BAD_REQUEST)
        access.role = role
        access.save(update_fields=["role"])
        return Response(DocAccessSerializer(access).data)

    def delete(self, request, pk, access_id):
        doc = get_object_or_404(Doc, id=pk, owner=request.user)
        access = get_object_or_404(DocAccess, id=access_id, doc=doc)
        access.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSearchView(APIView):
    """GET /api/v8/users/search/?q=... — used by the share picker."""
    permission_classes = [IsDocUser]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response([])
        users = User.objects.filter(
            Q(email__icontains=q) | Q(full_name__icontains=q),
            is_active=True,
        ).exclude(id=request.user.id)[:8]
        return Response([
            {"id": str(u.id), "email": u.email, "full_name": u.full_name or ""}
            for u in users
        ])


# ── Global Search ─────────────────────────────────────────────────────────────

class GlobalSearchView(APIView):
    """
    GET /api/v8/search/?q=<query>
    Searches Docs (title+content), Files (name+tags), Projects (name), Talents (name+email).
    Results scoped to what the requesting user can access.
    Returns: { docs, files, projects, talents }  — max 8 results per category.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return Response({"docs": [], "files": [], "projects": [], "talents": [], "crm": []})

        user = request.user

        # ── Docs ──────────────────────────────────────────────────────────────
        doc_qs = Doc.objects.filter(owner=user).filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        )[:8]
        docs = [
            {
                "type": "doc",
                "id": str(d.id),
                "title": d.title or "Untitled",
                "subtitle": "Page",
                "icon": d.icon or "📄",
                "route": f"/docs/{d.id}",
                "updated_at": d.updated_at.isoformat(),
            }
            for d in doc_qs
        ]

        # ── Files ─────────────────────────────────────────────────────────────
        files = []
        try:
            from library.models import Document
            if user.role == "creator":
                file_qs = Document.objects.filter(
                    creator=user, is_deleted=False
                ).filter(Q(name__icontains=query) | Q(tags__icontains=query))[:8]
            elif user.role == "client":
                file_qs = Document.objects.filter(
                    client=user, is_deleted=False
                ).filter(Q(name__icontains=query) | Q(tags__icontains=query))[:8]
            else:
                file_qs = []

            files = [
                {
                    "type": "file",
                    "id": str(f.id),
                    "title": f.name,
                    "subtitle": f.file_type or "File",
                    "icon": "📎",
                    "route": "/library",
                    "url": f.file.url if f.file else None,
                    "updated_at": f.updated_at.isoformat(),
                }
                for f in file_qs
            ]
        except Exception:
            pass

        # ── Projects ──────────────────────────────────────────────────────────
        projects = []
        try:
            from project.models import Project, ProjectClientMembership
            if user.role == "creator":
                proj_qs = Project.objects.filter(
                    creator=user, name__icontains=query
                )[:8]
            elif user.role == "client":
                proj_ids = ProjectClientMembership.objects.filter(
                    client=user
                ).values_list("project_id", flat=True)
                proj_qs = Project.objects.filter(
                    id__in=proj_ids, name__icontains=query
                )[:8]
            else:
                proj_qs = Project.objects.filter(
                    Q(creator=user) | Q(tasks__assigned_to=user)
                ).filter(name__icontains=query).distinct()[:8]

            projects = [
                {
                    "type": "project",
                    "id": str(p.id),
                    "title": p.name,
                    "subtitle": p.status.replace("-", " ").title(),
                    "icon": "🗂️",
                    "route": f"/projects/{p.id}",
                    "updated_at": p.created_at.isoformat(),
                }
                for p in proj_qs
            ]
        except Exception:
            pass

        # ── Talents ───────────────────────────────────────────────────────────
        talents = []
        try:
            if user.role in ("creator", "client"):
                talent_qs = User.objects.filter(
                    role="talent",
                    is_active=True,
                ).filter(
                    Q(full_name__icontains=query) | Q(email__icontains=query)
                )[:8]
                talents = [
                    {
                        "type": "talent",
                        "id": str(t.id),
                        "title": t.full_name or t.email,
                        "subtitle": t.email,
                        "icon": "👤",
                        "route": f"/talent/{t.id}",
                        "avatar": None,
                    }
                    for t in talent_qs
                ]
        except Exception:
            pass

        # ── CRM Sheets ────────────────────────────────────────────────────────
        crm_sheets = []
        try:
            from crm.models import CRMSheet, CRMAccess
            shared_ids = CRMAccess.objects.filter(user=user).values_list("sheet_id", flat=True)
            crm_qs = CRMSheet.objects.filter(
                Q(owner=user) | Q(id__in=shared_ids)
            ).filter(name__icontains=query).distinct()[:8]
            crm_sheets = [
                {
                    "type": "crm",
                    "id": str(s.id),
                    "title": s.name,
                    "subtitle": "CRM Sheet",
                    "icon": "🗃️",
                    "route": "/library/crm",
                    "updated_at": s.updated_at.isoformat(),
                }
                for s in crm_qs
            ]
        except Exception:
            pass

        return Response({
            "docs": docs,
            "files": files,
            "projects": projects,
            "talents": talents,
            "crm": crm_sheets,
        })
