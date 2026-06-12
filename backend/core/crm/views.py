from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db.models import Q

from .models import CRMSheet, CRMColumn, CRMRow, CRMAccess
from .serializers import (
    CRMSheetListSerializer,
    CRMSheetDetailSerializer,
    CRMColumnSerializer,
    CRMRowSerializer,
    CRMAccessSerializer,
)

WRITE_ROLES = {"owner", "admin", "editor"}


def _get_user_role(user, sheet):
    """Return the user's role string for this sheet, or None if no access."""
    if sheet.owner == user:
        return "owner"
    access = CRMAccess.objects.filter(sheet=sheet, user=user).first()
    return access.role if access else None


def _get_accessible_sheet(user, sheet_id):
    """Return (sheet, role) or raise Http404 if the sheet doesn't exist or the user has no access."""
    sheet = get_object_or_404(CRMSheet, id=sheet_id)
    role = _get_user_role(user, sheet)
    if role is None:
        raise Http404
    return sheet, role


def _accessible_sheets_qs(user):
    shared_ids = CRMAccess.objects.filter(user=user).values_list("sheet_id", flat=True)
    return CRMSheet.objects.filter(Q(owner=user) | Q(id__in=shared_ids)).distinct()


# ── Sheets ────────────────────────────────────────────────────────────────────

class CRMSheetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMSheetListSerializer

    def get_queryset(self):
        return _accessible_sheets_qs(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class CRMSheetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMSheetDetailSerializer

    def get_queryset(self):
        return _accessible_sheets_qs(self.request.user)

    def get_object(self):
        obj = super().get_object()
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            if obj.owner != self.request.user:
                raise PermissionDenied("Only the sheet owner can modify it.")
        return obj


# ── Columns ───────────────────────────────────────────────────────────────────

class CRMColumnListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMColumnSerializer

    def _get_sheet(self):
        sheet, _ = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        return sheet

    def _get_writable_sheet(self):
        sheet, role = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        if role not in WRITE_ROLES:
            raise PermissionDenied("You have read-only access to this sheet.")
        return sheet

    def get_queryset(self):
        return CRMColumn.objects.filter(sheet=self._get_sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._get_writable_sheet())


class CRMColumnDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMColumnSerializer

    def get_queryset(self):
        sheet, _ = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        return CRMColumn.objects.filter(sheet=sheet)

    def _check_write(self):
        _, role = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        if role not in WRITE_ROLES:
            raise PermissionDenied("You have read-only access to this sheet.")

    def perform_update(self, serializer):
        self._check_write()
        serializer.save()

    def perform_destroy(self, instance):
        self._check_write()
        instance.delete()


# ── Rows ──────────────────────────────────────────────────────────────────────

class CRMRowListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMRowSerializer

    def _get_sheet(self):
        sheet, _ = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        return sheet

    def _get_writable_sheet(self):
        sheet, role = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        if role not in WRITE_ROLES:
            raise PermissionDenied("You have read-only access to this sheet.")
        return sheet

    def get_queryset(self):
        return CRMRow.objects.filter(sheet=self._get_sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._get_writable_sheet())


class CRMRowDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMRowSerializer

    def get_queryset(self):
        sheet, _ = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        return CRMRow.objects.filter(sheet=sheet)

    def _check_write(self):
        _, role = _get_accessible_sheet(self.request.user, self.kwargs["sheet_id"])
        if role not in WRITE_ROLES:
            raise PermissionDenied("You have read-only access to this sheet.")

    def perform_update(self, serializer):
        self._check_write()
        serializer.save()

    def perform_destroy(self, instance):
        self._check_write()
        instance.delete()


# ── Access (owner-only management) ────────────────────────────────────────────

class CRMAccessListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMAccessSerializer

    def _owned_sheet(self):
        return get_object_or_404(CRMSheet, id=self.kwargs["sheet_id"], owner=self.request.user)

    def get_queryset(self):
        return CRMAccess.objects.filter(sheet=self._owned_sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._owned_sheet())


class CRMAccessDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMAccessSerializer

    def get_queryset(self):
        sheet = get_object_or_404(CRMSheet, id=self.kwargs["sheet_id"], owner=self.request.user)
        return CRMAccess.objects.filter(sheet=sheet)


# ── Sharable Users ────────────────────────────────────────────────────────────

class CRMShareableUsersView(APIView):
    """Returns all users the creator can share a sheet with: hired talent + onboarded clients."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "creator":
            return Response([])

        from notification.models import HireRequest
        from onboarding.models import OnboardingInstance

        users = []
        seen_ids = set()

        # Accepted team members (talents)
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
                    "type": "team",
                })

        # Clients from completed onboarding submissions
        seen_client_ids = set()
        for inst in OnboardingInstance.objects.filter(
            template__creator=request.user,
            client__isnull=False,
        ).select_related("client"):
            c = inst.client
            if c.id not in seen_ids and c.id not in seen_client_ids:
                seen_client_ids.add(c.id)
                seen_ids.add(c.id)
                users.append({
                    "user_id": str(c.id),
                    "name": c.full_name or c.email,
                    "email": c.email,
                    "type": "client",
                })

        return Response(users)
