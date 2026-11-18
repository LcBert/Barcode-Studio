from rest_framework import serializers

from .gs1 import GS1_AIS, build_gs1_code, generate_gs1_barcode, validate_gs1_element
from .models import BarcodeFolder, SavedBarcode


class BarcodeFolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarcodeFolder
        fields = [
            "id",
            "name",
            "parent",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Folder name cannot be empty.")
        return cleaned

    def validate(self, attrs):
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        name = attrs.get("name", getattr(self.instance, "name", ""))

        if self.instance and parent:
            curr = parent
            visited = {self.instance.pk}
            while curr is not None:
                if curr.pk in visited:
                    raise serializers.ValidationError(
                        {"parent": "Cannot move a folder inside itself or one of its subfolders."}
                    )
                visited.add(curr.pk)
                curr = curr.parent

        dup_qs = BarcodeFolder.objects.filter(parent=parent, name__iexact=name)
        if self.instance:
            dup_qs = dup_qs.exclude(pk=self.instance.pk)
        if dup_qs.exists():
            raise serializers.ValidationError(
                {"name": "A folder with this name already exists in the selected parent folder."}
            )
        return attrs


class GS1ElementSerializer(serializers.Serializer):
    ai = serializers.CharField(max_length=6, allow_blank=True, required=False, default="")
    value = serializers.CharField(max_length=120)

    def validate(self, attrs):
        ai = attrs.get("ai", "").strip()
        value = attrs.get("value", "").strip()
        try:
            attrs["value"] = validate_gs1_element(ai, value)
            attrs["ai"] = ai
        except ValueError as exc:
            raise serializers.ValidationError({"value": str(exc)}) from exc
        return attrs


class BarcodeGenerateRequestSerializer(serializers.Serializer):
    elements = GS1ElementSerializer(many=True, allow_empty=False)
    module_width = serializers.FloatField(default=0.4, min_value=0.1, max_value=2.0)
    module_height = serializers.FloatField(default=26.0, min_value=5.0, max_value=60.0)
    font_size = serializers.IntegerField(default=12, min_value=6, max_value=28)
    quiet_zone = serializers.FloatField(default=6.5, min_value=1.0, max_value=30.0)


class SavedBarcodeSerializer(serializers.ModelSerializer):
    elements = GS1ElementSerializer(many=True)
    svg = serializers.SerializerMethodField()

    class Meta:
        model = SavedBarcode
        fields = [
            "id",
            "name",
            "description",
            "folder",
            "sort_order",
            "elements",
            "raw_code",
            "human_readable",
            "svg",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "raw_code", "human_readable", "svg", "created_at", "updated_at"]

    def get_svg(self, obj) -> str:
        try:
            res = generate_gs1_barcode(obj.elements, module_width=0.35, module_height=20.0)
            return res.get("svg", "")
        except Exception:
            return ""

    def create(self, validated_data):
        elements = validated_data.get("elements", [])
        raw_code, human_readable = build_gs1_code(elements)
        validated_data["raw_code"] = raw_code
        validated_data["human_readable"] = human_readable
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "elements" in validated_data:
            elements = validated_data.get("elements", [])
            raw_code, human_readable = build_gs1_code(elements)
            validated_data["raw_code"] = raw_code
            validated_data["human_readable"] = human_readable
        return super().update(instance, validated_data)
