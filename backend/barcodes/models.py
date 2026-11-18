from django.db import models


class BarcodeFolder(models.Model):
    name = models.CharField(max_length=120, help_text="Folder name")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfolders",
        help_text="Optional parent folder for nested hierarchy",
    )
    sort_order = models.IntegerField(default=0, help_text="Custom manual display order")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name", "id"]

    def __str__(self) -> str:
        return self.name


class SavedBarcode(models.Model):
    name = models.CharField(max_length=120, unique=True, help_text="Unique name/label for this barcode configuration")
    description = models.TextField(blank=True, default="", help_text="Optional description or notes")
    folder = models.ForeignKey(
        BarcodeFolder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="barcodes",
        help_text="Optional folder containing this barcode",
    )
    sort_order = models.IntegerField(default=0, help_text="Custom manual display order")
    elements = models.JSONField(help_text="List of GS1 elements: [{'ai': '01', 'value': '...'}, ...]")
    raw_code = models.TextField(blank=True, default="")
    human_readable = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-updated_at", "id"]

    def __str__(self) -> str:
        return f"{self.name} - {self.human_readable or 'GS1-128'}"
