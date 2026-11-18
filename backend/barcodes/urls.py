from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BarcodeDownloadView,
    BarcodeFolderViewSet,
    BarcodeGenerateView,
    GS1AIListView,
    SavedBarcodeViewSet,
)

router = DefaultRouter()
router.register(r"saved-barcodes", SavedBarcodeViewSet, basename="saved-barcodes")
router.register(r"folders", BarcodeFolderViewSet, basename="barcode-folders")

urlpatterns = [
    path("ais/", GS1AIListView.as_view(), name="gs1-ais"),
    path("generate/", BarcodeGenerateView.as_view(), name="barcode-generate"),
    path("download/", BarcodeDownloadView.as_view(), name="barcode-download"),
    path("", include(router.urls)),
]
