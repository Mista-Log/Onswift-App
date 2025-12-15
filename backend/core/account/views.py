from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import login
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from .serializers import ProfileUpdateSerializer
from .serializers import SignupSerializer, LoginSerializer
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import UserDetailSerializer

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

        serializer = ProfileUpdateSerializer(
            instance=user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # -----------------------------
        # Base user payload
        # -----------------------------
        response_data = {
            "message": "Profile updated successfully",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            },
            "profile": None,  # always present for frontend safety
        }

        # -----------------------------
        # Talent Profile Response
        # -----------------------------
        if user.role == "talent":
            talent_profile = getattr(user, "talentprofile", None)

            if talent_profile:
                response_data["profile"] = {
                    "professional_title": talent_profile.professional_title,
                    "skills": talent_profile.skills,
                    "primary_skill": talent_profile.primary_skill,
                    "hourly_rate": str(talent_profile.hourly_rate)
                    if talent_profile.hourly_rate else None,
                }

        # -----------------------------
        # Creator Profile Response
        # -----------------------------
        if user.role == "creator":
            creator_profile = getattr(user, "creatorprofile", None)

            if creator_profile:
                response_data["profile"] = {
                    "company_name": creator_profile.company_name,
                    "bio": creator_profile.bio,
                    "website": creator_profile.website,
                    "industry": creator_profile.industry,
                    "location": creator_profile.location,
                    "social_links": creator_profile.social_links,

                    # IMPORTANT: absolute avatar URL
                    "avatar": (
                        request.build_absolute_uri(creator_profile.avatar.url)
                        if creator_profile.avatar
                        else None
                    ),
                }

        return Response(response_data, status=status.HTTP_200_OK)
    

class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user, context={"request": request})
        return Response(serializer.data)