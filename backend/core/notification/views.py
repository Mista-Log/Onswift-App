from django.shortcuts import render
from rest_framework import generics, permissions
from .serializers import HireRequestCreateSerializer, HireRequestRespondSerializer, NotificationSerializer, HireRequestSerializer
from .models import HireRequest




class HireRequestCreateView(generics.CreateAPIView):
    serializer_class = HireRequestCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class HireRequestRespondView(generics.UpdateAPIView):
    serializer_class = HireRequestRespondSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return HireRequest.objects.filter(
            talent=self.request.user,
            status="pending"
        )

class ReceivedHireRequestListView(generics.ListAPIView):
    serializer_class = HireRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return HireRequest.objects.filter(
            talent=self.request.user,
            status="pending"
        )


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.notifications.all()


class NotificationReadView(generics.UpdateAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.notifications.all()

    def perform_update(self, serializer):
        serializer.save(is_read=True)
