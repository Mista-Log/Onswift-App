from rest_framework import serializers
from .models import HireRequest, Notification
from .services import create_notification
from django.utils import timezone


class HireRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = ["talent", "message"]

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role != "creator":
            raise serializers.ValidationError("Only creators can send hire requests.")
        if attrs["talent"].role != "talent":
            raise serializers.ValidationError("You can only hire talents.")
        return attrs

    def create(self, validated_data):
        creator = self.context["request"].user
        hire_request = HireRequest.objects.create(
            creator=creator,
            **validated_data
        )

        # Notify talent
        create_notification(
            user=hire_request.talent,
            title="New Hire Request",
            message=f"{creator.full_name} wants to hire you.",
            notification_type="hire",
            hire_request=hire_request,
        )

        return hire_request


class HireRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = "__all__" 


class HireRequestRespondSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ["accepted", "rejected"]:
            raise serializers.ValidationError("Invalid status")
        return value

    def update(self, instance, validated_data):
        instance.status = validated_data["status"]
        instance.responded_at = timezone.now()
        instance.save()

        # Notify creator
        create_notification(
            user=instance.creator,
            title="Hire Request Update",
            message=f"{instance.talent.full_name} {instance.status} your hire request.",
            notification_type="hire",
            hire_request=instance,
        )

        return instance

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"