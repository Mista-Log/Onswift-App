from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import login
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from .serializers import ProfileUpdateSerializer, UserSettingsSerializer, AccountStatsSerializer, ProfileUpdateBasicSerializer
from .serializers import SignupSerializer, LoginSerializer
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import UserDetailSerializer
from .serializers import TalentProfileListSerializer

from .models import User, UserSettings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.conf import settings
from google.auth.transport import requests
from google.oauth2 import id_token
from .serializers import GoogleAuthSerializer
from .models import TalentProfile, CreatorProfile


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Signup successful",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_201_CREATED,
        )



class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )



class UpdateProfileView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user

        serializer = ProfileUpdateSerializer(instance=user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response_data = {
            "message": "Profile updated successfully",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            },
            "profile": {
                "profile_picture": request.build_absolute_uri(user.profile_picture.url)
                if user.profile_picture else None
            }
        }

        if user.role == "talent":
            talent_profile = getattr(user, "talentprofile", None)
            if talent_profile:
                response_data["profile"].update({
                    "professional_title": talent_profile.professional_title,
                    "skills": talent_profile.skills,
                    "primary_skill": talent_profile.primary_skill,
                    "hourly_rate": str(talent_profile.hourly_rate) if talent_profile.hourly_rate else None,
                })

        if user.role == "creator":
            creator_profile = getattr(user, "creatorprofile", None)
            if creator_profile:
                response_data["profile"].update({
                    "company_name": creator_profile.company_name,
                    "bio": creator_profile.bio,
                    "website": creator_profile.website,
                    "industry": creator_profile.industry,
                    "location": creator_profile.location,
                    "social_links": creator_profile.social_links,
                })

        return Response(response_data, status=status.HTTP_200_OK)

    

class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user, context={"request": request})
        return Response(serializer.data)
    



class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def options(self, request, *args, **kwargs):
        """Handle preflight OPTIONS requests for CORS"""
        return Response(status=status.HTTP_200_OK)

    def post(self, request):
        email = request.data.get("email")

        
        try:
            user = User.objects.get(email=email)
            
        except User.DoesNotExist:
            return Response(
                {"message": "If this email exists, a reset link has been sent."},
                status=status.HTTP_200_OK
            )
        
        token = PasswordResetTokenGenerator().make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"

        send_mail(
            subject="Reset Your Password",
            message=f"Click the link to reset your password: {reset_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )

        return Response(
            {"message": "Password reset link sent"},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]


    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except:
            return Response({"error": "Invalid link"}, status=400)

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response({"error": "Invalid or expired token"}, status=400)

        user.set_password(password)
        user.save()

        return Response({"message": "Password reset successful"})


class UserSettingsView(APIView):
    """Get and update user settings"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_settings, _ = UserSettings.objects.get_or_create(user=request.user)
        serializer = UserSettingsSerializer(user_settings)
        return Response(serializer.data)

    def patch(self, request):
        user_settings, _ = UserSettings.objects.get_or_create(user=request.user)
        serializer = UserSettingsSerializer(user_settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AccountStatsView(APIView):
    """Get account statistics"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Get member since date
        member_since = user.date_joined if hasattr(user, 'date_joined') else None
        
        # Calculate stats based on role
        if user.role == 'creator':
            from project.models import Project, Task
            from notification.models import HireRequest
            
            projects_count = Project.objects.filter(creator=user).count()
            team_members_count = HireRequest.objects.filter(
                creator=user, 
                status='accepted'
            ).count()
            completed_tasks_count = Task.objects.filter(
                project__creator=user,
                status='completed'
            ).count()
        else:
            # Talent
            from project.models import Task
            from notification.models import HireRequest

            projects_count = Task.objects.filter(
                assignee=user
            ).values('project').distinct().count()

            hire_requests = HireRequest.objects.filter(
                talent=user,
                status='accepted'
            ).select_related('creator')

            team_members_count = hire_requests.count()

            completed_tasks_count = Task.objects.filter(
                assignee=user,
                status='completed'
            ).count()

            first_hire = hire_requests.order_by('created_at').first()
            added_by = (first_hire.creator.full_name or first_hire.creator.email) if first_hire else None

            return Response({
                'member_since': member_since,
                'projects_count': projects_count,
                'team_members_count': team_members_count,
                'completed_tasks_count': completed_tasks_count,
                'added_by': added_by,
            })

        return Response({
            'member_since': member_since,
            'projects_count': projects_count,
            'team_members_count': team_members_count,
            'completed_tasks_count': completed_tasks_count,
        })


class UpdateBasicProfileView(APIView):
    """Update basic profile info (full name, email, bio)"""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ProfileUpdateBasicSerializer(
            instance=request.user, 
            data=request.data, 
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'message': 'Profile updated successfully',
            'user': {
                'full_name': request.user.full_name,
                'email': request.user.email,
            }
        })


class DeleteAccountView(APIView):
    """Delete user account"""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        
        # Optional: require password confirmation
        password = request.data.get('password')
        if password and not user.check_password(password):
            return Response(
                {'error': 'Incorrect password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete the user (cascades to related objects)
        user.delete()
        
        return Response(
            {'message': 'Account deleted successfully'},
            status=status.HTTP_200_OK
        )



class TalentProfileListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        talents = (
            User.objects
            .filter(role="talent")
            .select_related("talentprofile")
        )

        serializer = TalentProfileListSerializer(talents, many=True)
        return Response(serializer.data)



class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        full_name = serializer.validated_data["full_name"]
        role = serializer.validated_data.get("role", "talent")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "role": role,
            }
        )

        if created:
            if role == "talent":
                TalentProfile.objects.create(
                    user=user
                )

            elif role == "creator":
                CreatorProfile.objects.create(
                    user=user
                )

        # Update full name if empty
        if not user.full_name:
            user.full_name = full_name
            user.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Google authentication successful",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            }
        }, status=status.HTTP_200_OK)