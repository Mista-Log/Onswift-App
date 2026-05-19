from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from .models import CRMSheet, CRMColumn, CRMRow, CRMAccess
from .serializers import (
    CRMSheetListSerializer,
    CRMSheetDetailSerializer,
    CRMColumnSerializer,
    CRMRowSerializer,
    CRMAccessSerializer,
)


def _owned_sheet(user, sheet_id):
    return get_object_or_404(CRMSheet, id=sheet_id, owner=user)


# ── Sheets ────────────────────────────────────────────────────────────────────

class CRMSheetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMSheetListSerializer

    def get_queryset(self):
        return CRMSheet.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role != "creator":
            raise PermissionDenied("Only creators can create CRM sheets.")
        serializer.save(owner=self.request.user)


class CRMSheetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMSheetDetailSerializer

    def get_queryset(self):
        return CRMSheet.objects.filter(owner=self.request.user)

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method in ("PUT", "PATCH", "DELETE") and request.user.role != "creator":
            raise PermissionDenied("Only creators can modify CRM sheets.")


# ── Columns ───────────────────────────────────────────────────────────────────

class CRMColumnListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMColumnSerializer

    def _sheet(self):
        return _owned_sheet(self.request.user, self.kwargs["sheet_id"])

    def get_queryset(self):
        return CRMColumn.objects.filter(sheet=self._sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._sheet())


class CRMColumnDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMColumnSerializer

    def get_queryset(self):
        sheet = _owned_sheet(self.request.user, self.kwargs["sheet_id"])
        return CRMColumn.objects.filter(sheet=sheet)


# ── Rows ──────────────────────────────────────────────────────────────────────

class CRMRowListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMRowSerializer

    def _sheet(self):
        return _owned_sheet(self.request.user, self.kwargs["sheet_id"])

    def get_queryset(self):
        return CRMRow.objects.filter(sheet=self._sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._sheet())


class CRMRowDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMRowSerializer

    def get_queryset(self):
        sheet = _owned_sheet(self.request.user, self.kwargs["sheet_id"])
        return CRMRow.objects.filter(sheet=sheet)


# ── Access ────────────────────────────────────────────────────────────────────

class CRMAccessListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMAccessSerializer

    def _sheet(self):
        return _owned_sheet(self.request.user, self.kwargs["sheet_id"])

    def get_queryset(self):
        return CRMAccess.objects.filter(sheet=self._sheet())

    def perform_create(self, serializer):
        serializer.save(sheet=self._sheet())


class CRMAccessDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CRMAccessSerializer

    def get_queryset(self):
        sheet = _owned_sheet(self.request.user, self.kwargs["sheet_id"])
        return CRMAccess.objects.filter(sheet=sheet)
