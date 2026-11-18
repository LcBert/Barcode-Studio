from typing import Any
from django.db import transaction
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .gs1 import GS1_AIS, generate_gs1_barcode
from .models import BarcodeFolder, SavedBarcode
from .serializers import (
    BarcodeFolderSerializer,
    BarcodeGenerateRequestSerializer,
    SavedBarcodeSerializer,
)


def render_barcode_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Reusable barcode generation from validated serializer data."""
    return generate_gs1_barcode(
        elements=data["elements"],
        module_width=data.get("module_width", 0.4),
        module_height=data.get("module_height", 26.0),
        font_size=data.get("font_size", 12),
        quiet_zone=data.get("quiet_zone", 6.5),
    )


class GS1AIListView(APIView):
    """Returns the catalog of supported GS1 Application Identifiers."""

    def get(self, request: Request) -> Response:
        return Response(list(GS1_AIS.values()))


class BarcodeGenerateView(APIView):
    """Generates GS1-128 barcode SVG and Base64-encoded PNG."""

    def post(self, request: Request) -> Response:
        serializer = BarcodeGenerateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = render_barcode_payload(serializer.validated_data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "raw_code": result["raw_code"],
                "human_readable": result["human_readable"],
                "svg": result["svg"],
                "png_base64": result["png_base64"],
                "elements": serializer.validated_data["elements"],
            }
        )


class BarcodeDownloadView(APIView):
    """Directly downloads generated barcode as PNG or SVG file attachment."""

    format_kwarg = None

    def post(self, request: Request) -> HttpResponse:
        serializer = BarcodeGenerateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file_format = request.query_params.get("export_format", "png").lower()
        if file_format not in ("png", "svg"):
            file_format = "png"

        try:
            result = render_barcode_payload(serializer.validated_data)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        filename = "".join(
            c for c in request.query_params.get("filename", "gs1_128_barcode").strip()
            if c.isalnum() or c in ("-", "_")
        ) or "gs1_128_barcode"

        is_svg = file_format == "svg"
        content_type = "image/svg+xml" if is_svg else "image/png"
        payload = result["svg"] if is_svg else result["png_bytes"]

        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}.{file_format}"'
        return response


class BarcodeFolderViewSet(viewsets.ModelViewSet):
    """CRUD API for nested barcode folders and manual reordering."""

    queryset = BarcodeFolder.objects.all()
    serializer_class = BarcodeFolderSerializer

    def perform_destroy(self, instance: BarcodeFolder) -> None:
        descendant_ids = [instance.pk]
        queue = [instance.pk]
        while queue:
            current_ids = queue
            child_ids = list(
                BarcodeFolder.objects.filter(parent_id__in=current_ids).values_list("id", flat=True)
            )
            descendant_ids.extend(child_ids)
            queue = child_ids

        with transaction.atomic():
            SavedBarcode.objects.filter(folder_id__in=descendant_ids).update(folder=instance.parent)
            instance.delete()

    @action(detail=False, methods=["post"])
    def reorder(self, request: Request) -> Response:
        ordered_ids = request.data.get("ordered_ids", [])
        if not isinstance(ordered_ids, list):
            return Response(
                {"error": "ordered_ids must be a list of folder IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for idx, folder_id in enumerate(ordered_ids):
                BarcodeFolder.objects.filter(pk=folder_id).update(sort_order=idx)

        return Response({"status": "ok", "reordered": len(ordered_ids)})


class SavedBarcodeViewSet(viewsets.ModelViewSet):
    """CRUD API for saved reusable barcodes."""

    queryset = SavedBarcode.objects.all()
    serializer_class = SavedBarcodeSerializer

    @action(detail=True, methods=["post"])
    def duplicate(self, request: Request, pk=None) -> Response:
        obj = self.get_object()
        base_name = f"{obj.name} (Copia)"
        new_name = base_name
        counter = 2
        while SavedBarcode.objects.filter(name=new_name).exists():
            new_name = f"{obj.name} (Copia {counter})"
            counter += 1
        new_obj = SavedBarcode.objects.create(
            name=new_name,
            description=obj.description,
            folder=obj.folder,
            sort_order=obj.sort_order + 1,
            elements=obj.elements,
            raw_code=obj.raw_code,
            human_readable=obj.human_readable,
        )
        serializer = self.get_serializer(new_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def reorder(self, request: Request) -> Response:
        ordered_ids = request.data.get("ordered_ids", [])
        if not isinstance(ordered_ids, list):
            return Response(
                {"error": "ordered_ids must be a list of barcode IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for idx, barcode_id in enumerate(ordered_ids):
                SavedBarcode.objects.filter(pk=barcode_id).update(sort_order=idx)

        return Response({"status": "ok", "reordered": len(ordered_ids)})

    @action(detail=False, methods=["post"], url_path="move-to-folder")
    def move_to_folder(self, request: Request) -> Response:
        barcode_ids = request.data.get("barcode_ids", [])
        folder_id = request.data.get("folder_id", None)

        if not isinstance(barcode_ids, list) or not barcode_ids:
            return Response(
                {"error": "barcode_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_folder = None
        if folder_id is not None:
            try:
                target_folder = BarcodeFolder.objects.get(pk=folder_id)
            except BarcodeFolder.DoesNotExist:
                return Response(
                    {"error": "Target folder does not exist."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        updated = SavedBarcode.objects.filter(pk__in=barcode_ids).update(folder=target_folder)
        return Response(
            {
                "status": "ok",
                "moved": updated,
                "folder_id": target_folder.pk if target_folder else None,
            }
        )

    @action(detail=True, methods=["post"])
    def generate(self, request: Request, pk=None) -> Response:
        barcode_obj = self.get_object()
        result = generate_gs1_barcode(barcode_obj.elements)
        return Response(
            {
                "id": barcode_obj.id,
                "name": barcode_obj.name,
                "description": barcode_obj.description,
                "raw_code": result["raw_code"],
                "human_readable": result["human_readable"],
                "svg": result["svg"],
                "png_base64": result["png_base64"],
                "elements": barcode_obj.elements,
            }
        )
