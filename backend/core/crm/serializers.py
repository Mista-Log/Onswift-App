from rest_framework import serializers
from .models import CRMSheet, CRMColumn, CRMRow, CRMAccess


class CRMColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMColumn
        fields = ["id", "name", "field_type", "options", "order", "created_at"]
        read_only_fields = ["id", "created_at"]


class CRMRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMRow
        fields = ["id", "values", "order", "created_at"]
        read_only_fields = ["id", "created_at"]


class CRMAccessSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = CRMAccess
        fields = ["id", "user", "user_name", "user_email", "role", "created_at"]
        read_only_fields = ["id", "created_at"]


class CRMSheetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the card-grid list view."""
    column_count = serializers.IntegerField(source="columns.count", read_only=True)
    row_count = serializers.IntegerField(source="rows.count", read_only=True)
    column_names = serializers.SerializerMethodField()

    class Meta:
        model = CRMSheet
        fields = ["id", "name", "column_count", "row_count", "column_names", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_column_names(self, obj):
        return list(obj.columns.values_list("name", flat=True)[:6])


class CRMSheetDetailSerializer(serializers.ModelSerializer):
    """Full serializer — includes nested columns, rows, and access list."""
    columns = CRMColumnSerializer(many=True, read_only=True)
    rows = CRMRowSerializer(many=True, read_only=True)
    access_list = CRMAccessSerializer(many=True, read_only=True)

    class Meta:
        model = CRMSheet
        fields = ["id", "name", "columns", "rows", "access_list", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
