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
from core.exceptions import storage_error_guard
from django.utils import timezone
from .otp import (
    generate_and_send_otp,
    is_email_verified,
    has_live_otp,
    resend_wait_seconds,
    verify_otp,
    OTP_OK,
    OTP_INVALID,
    OTP_EXPIRED,
    OTP_LOCKED,
)
from .throttles import LoginEmailThrottle
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import logging

logger = logging.getLogger(__name__)


class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_signup"

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
                    "email_verified": is_email_verified(user),
                    "onboarding_completed": user.onboarding_completed,
                },
            },
            status=status.HTTP_201_CREATED,
        )



class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, LoginEmailThrottle]
    throttle_scope = "auth_login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        # An unverified user is signed in with a restricted token (the API only
        # lets them reach the verification endpoints). Make sure they have a
        # live code waiting rather than relying on them to hit Resend.
        if (
            settings.EMAIL_VERIFICATION_REQUIRED
            and not user.email_verified
            and not has_live_otp(user)
            and resend_wait_seconds(user) == 0
        ):
            generate_and_send_otp(user)

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
                    "email_verified": is_email_verified(user),
                    "onboarding_completed": user.onboarding_completed,
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
        with storage_error_guard():
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
                    "bio": talent_profile.bio,
                    "availability": talent_profile.availability,
                    "portfolio_links": talent_profile.portfolio_links,
                    "social_links": talent_profile.social_links,
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_request"

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

        # Same response whether or not the email exists, and whether or not the
        # send worked, so this endpoint can't be used to probe for accounts.
        try:
            send_mail(
                subject="Reset Your Password",
                message=f"Click the link to reset your password: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
        except Exception:
            logger.exception("Failed to send password reset email to %s", user.email)

        return Response(
            {"message": "If this email exists, a reset link has been sent."},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"


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

        if not password:
            return Response({"error": "Password is required."}, status=400)
        try:
            validate_password(password, user)
        except DjangoValidationError as e:
            return Response({"error": " ".join(e.messages)}, status=400)

        user.set_password(password)
        # Following the emailed link proves the user controls this address.
        user.email_verified = True
        user.otp_code = None
        user.otp_expires_at = None
        user.otp_attempts = 0
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
                assignees=user
            ).values('project').distinct().count()

            hire_requests = HireRequest.objects.filter(
                talent=user,
                status='accepted'
            ).select_related('creator')

            team_members_count = hire_requests.count()

            completed_tasks_count = Task.objects.filter(
                assignees=user,
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_google"

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        full_name = serializer.validated_data["full_name"]
        role = serializer.validated_data.get("role")

        try:
            user = User.objects.get(email=email)
            created = False
            if not user.email_verified:
                # Google just proved ownership of this address. An unverified
                # password account on it may have been pre-registered by someone
                # else, so verify it AND drop that password (the owner can set a
                # new one via password reset).
                user.email_verified = True
                user.set_unusable_password()
                user.otp_code = None
                user.otp_expires_at = None
                user.otp_attempts = 0
                user.save(update_fields=[
                    "email_verified", "password", "otp_code", "otp_expires_at", "otp_attempts",
                ])
        except User.DoesNotExist:
            if not role:
                # Brand-new Google identity, no role chosen yet — don't create an
                # account. The frontend asks for a role and re-POSTs with it.
                return Response({"new_user": True, "email": email, "full_name": full_name})

            user = User.objects.create(
                email=email,
                full_name=full_name,
                role=role,
                email_verified=True,
                onboarding_completed=False,
            )
            created = True

            if role == "talent":
                TalentProfile.objects.create(
                    user=user
                )

            elif role == "creator":
                CreatorProfile.objects.create(
                    user=user
                )

            from assistant.services import send_signup_welcome
            send_signup_welcome(user)

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
                "email_verified": is_email_verified(user),
                "onboarding_completed": user.onboarding_completed,
            }
        }, status=status.HTTP_200_OK)


class VerifyOtpView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        result = verify_otp(request.user, request.data.get("code"))

        if result == OTP_OK:
            return Response({"message": "Email verified"}, status=status.HTTP_200_OK)
        if result == OTP_LOCKED:
            return Response(
                {"error": "Too many incorrect attempts. Request a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if result == OTP_EXPIRED:
            return Response({"error": "Code expired. Request a new one."}, status=400)
        if result == OTP_INVALID:
            return Response({"error": "Incorrect code."}, status=400)
        return Response({"error": "No verification code pending. Request a new one."}, status=400)


class ResendOtpView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_resend"

    def post(self, request):
        wait = resend_wait_seconds(request.user)
        if wait:
            return Response(
                {"error": f"Please wait {wait} seconds before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if not generate_and_send_otp(request.user):
            return Response(
                {"error": "We couldn't send the code right now. Please try again shortly."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"message": "Verification code sent"}, status=status.HTTP_200_OK)


class CompleteOnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.onboarding_completed = True
        user.save(update_fields=["onboarding_completed"])
        return Response({"message": "Onboarding complete"}, status=status.HTTP_200_OK)