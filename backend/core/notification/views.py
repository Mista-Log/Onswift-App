from django.shortcuts import render, get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import (
    HireRequestCreateSerializer,
    HireRequestRespondSerializer,
    NotificationSerializer,
    HireRequestSerializer,
    TeamMemberSerializer,
    InviteTokenCreateSerializer,
    InviteTokenValidateSerializer
)
from .models import HireRequest, InviteToken




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


class CreatorTeamListView(generics.ListAPIView):
    """Get all accepted team members for a creator"""
    serializer_class = TeamMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return HireRequest.objects.filter(
            creator=self.request.user,
            status="accepted"
        ).select_related('talent', 'talent__talentprofile')


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


class InviteTokenCreateView(generics.CreateAPIView):
    """Generate an invite token for onboarding talents"""
    serializer_class = InviteTokenCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


class InviteTokenValidateView(generics.RetrieveAPIView):
    """Validate an invite token (public endpoint)"""
    serializer_class = InviteTokenValidateSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'token'
    queryset = InviteToken.objects.all()

    def retrieve(self, request, *args, **kwargs):
        token = kwargs.get('token')
        try:
            invite = InviteToken.objects.get(token=token)
            serializer = self.get_serializer(invite)

            # Check if valid
            if not invite.is_valid():
                return Response(
                    {
                        "error": "This invite link has expired or has already been used.",
                        "is_valid": False
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response(serializer.data)
        except InviteToken.DoesNotExist:
            return Response(
                {
                    "error": "Invalid invite link.",
                    "is_valid": False
                },
                status=status.HTTP_404_NOT_FOUND
            )
