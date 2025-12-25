from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, TalentProfile, CreatorProfile


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    # Talent fields (optional)
    professional_title = serializers.CharField(required=False)
    skills = serializers.ListField(child=serializers.CharField(), required=False)
    primary_skill = serializers.CharField(required=False)
    hourly_rate = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )

    # Creator fields (optional)
    company_name = serializers.CharField(required=False)
    bio = serializers.CharField(required=False)
    website = serializers.URLField(required=False)
    industry = serializers.CharField(required=False)
    location = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = (
            "email",
            "full_name",
            "password",
            "role",

            # talent
            "professional_title",
            "skills",
            "primary_skill",
            "hourly_rate",

            # creator
            "company_name",
            "bio",
            "website",
            "industry",
            "location",
        )

    def create(self, validated_data):
        role = validated_data.get("role")

        talent_fields = {
            "professional_title": validated_data.pop("professional_title", None),
            "skills": validated_data.pop("skills", []),
            "primary_skill": validated_data.pop("primary_skill", None),
            "hourly_rate": validated_data.pop("hourly_rate", None),
        }

        creator_fields = {
            "company_name": validated_data.pop("company_name", ""),
            "bio": validated_data.pop("bio", ""),
            "website": validated_data.pop("website", ""),
            "industry": validated_data.pop("industry", ""),
            "location": validated_data.pop("location", ""),
        }

        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        if role == "talent":
            TalentProfile.objects.create(user=user, **talent_fields)

        elif role == "creator":
            CreatorProfile.objects.create(user=user, **creator_fields)

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(
            email=data.get("email"),
            password=data.get("password"),
        )

        if not user:
            raise serializers.ValidationError("Invalid email or password")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled")

        data["user"] = user
        return data

class ProfileUpdateSerializer(serializers.Serializer):
    # ---------- User ----------
    full_name = serializers.CharField(required=False)

    # ---------- Talent ----------
    professional_title = serializers.CharField(required=False)
    skills = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    primary_skill = serializers.CharField(required=False)
    hourly_rate = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )

    # ---------- Creator ----------
    avatar = serializers.ImageField(required=False)
    social_links = serializers.JSONField(required=False)

    company_name = serializers.CharField(required=False)
    bio = serializers.CharField(required=False)
    website = serializers.URLField(required=False)
    industry = serializers.CharField(required=False)
    location = serializers.CharField(required=False)

    def update(self, user, validated_data):
        # -------- Update User --------
        if "full_name" in validated_data:
            user.full_name = validated_data.pop("full_name")
            user.save(update_fields=["full_name"])

        # -------- Update Talent Profile --------
        if user.role == "talent":
            profile, _ = TalentProfile.objects.get_or_create(user=user)

            talent_fields = [
                "professional_title",
                "skills",
                "primary_skill",
                "hourly_rate",
            ]

            for field in talent_fields:
                if field in validated_data:
                    setattr(profile, field, validated_data[field])

            profile.save()

        # -------- Update Creator Profile --------
        if user.role == "creator":
            profile, _ = CreatorProfile.objects.get_or_create(user=user)

            creator_fields = [
                "company_name",
                "bio",
                "website",
                "industry",
                "location",
                "avatar",
                "social_links",
            ]

            if "avatar" in validated_data and validated_data["avatar"] is not None:
                profile.avatar = validated_data["avatar"]


            for field in creator_fields:
                if field in validated_data:
                    setattr(profile, field, validated_data[field])

            profile.save()

        return user
    
class UserDetailSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "profile",
        ]

    def get_profile(self, obj):
        if obj.role == "talent":
            talent_profile = getattr(obj, "talentprofile", None)
            if talent_profile:
                return {
                    "professional_title": talent_profile.professional_title,
                    "skills": talent_profile.skills,
                    "primary_skill": talent_profile.primary_skill,
                    "hourly_rate": str(talent_profile.hourly_rate) if talent_profile.hourly_rate else None,
                }
        elif obj.role == "creator":
            creator_profile = getattr(obj, "creatorprofile", None)
            if creator_profile:
                return {
                    "company_name": creator_profile.company_name,
                    "bio": creator_profile.bio,
                    "website": creator_profile.website,
                    "industry": creator_profile.industry,
                    "location": creator_profile.location,
                    "social_links": creator_profile.social_links,
                    "avatar": (
                        self.context["request"].build_absolute_uri(creator_profile.avatar.url)
                        if creator_profile.avatar
                        else None
                    ),
                }
        return None
