from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import login
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from .serializers import ProfileUpdateSerializer
from .serializers import SignupSerializer, LoginSerializer


class SignupView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "Signup successful",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_201_CREATED,
        )



class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)

        login(request, user)

        return Response(
            {
                "message": "Login successful",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            instance=request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        response_data = {
            "message": "Profile updated successfully",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            },
        }

        # Attach profile data
        if user.role == "talent" and hasattr(user, "talentprofile"):
            response_data["profile"] = {
                "professional_title": user.talentprofile.professional_title,
                "skills": user.talentprofile.skills,
                "primary_skill": user.talentprofile.primary_skill,
                "hourly_rate": user.talentprofile.hourly_rate,
            }

        if user.role == "creator" and hasattr(user, "creatorprofile"):
            response_data["profile"] = {
                "company_name": user.creatorprofile.company_name,
                "bio": user.creatorprofile.bio,
                "website": user.creatorprofile.website,
                "industry": user.creatorprofile.industry,
                "location": user.creatorprofile.location,
            }

        return Response(response_data, status=status.HTTP_200_OK)
