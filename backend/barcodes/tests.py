import json
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import SavedBarcode


class GS1BarcodeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_ais_catalog(self):
        url = reverse("gs1-ais")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ais = {item["ai"] for item in response.json()}
        self.assertIn("01", ais)
        self.assertIn("10", ais)
        self.assertIn("17", ais)
        self.assertIn("240", ais)

    def test_generate_barcode_with_ai_240(self):
        url = reverse("barcode-generate")
        payload = {
            "elements": [
                {"ai": "01", "value": "08412345678905"},
                {"ai": "240", "value": "PRD-XYZ-99"},
                {"ai": "10", "value": "BATCH-1"},
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("(240)PRD-XYZ-99", data["human_readable"])

    def test_generate_barcode_success(self):
        url = reverse("barcode-generate")
        payload = {
            "elements": [
                {"ai": "01", "value": "08412345678905"},
                {"ai": "17", "value": "261231"},
                {"ai": "10", "value": "LOT12345"},
                {"ai": "30", "value": "250"},
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("svg", data)
        self.assertIn("png_base64", data)
        self.assertIn("<svg", data["svg"])
        self.assertTrue(data["png_base64"].startswith("data:image/png;base64,"))
        self.assertEqual(
            data["human_readable"], "(01)08412345678905(17)261231(10)LOT12345(30)250"
        )

    def test_generate_barcode_without_ai(self):
        url = reverse("barcode-generate")
        payload = {
            "elements": [
                {"ai": "", "value": "ARTICLE-XYZ-9988"},
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["raw_code"], "ARTICLE-XYZ-9988")
        self.assertEqual(data["human_readable"], "ARTICLE-XYZ-9988")
        self.assertIn("<svg", data["svg"])
        self.assertTrue(data["png_base64"].startswith("data:image/png;base64,"))

    def test_generate_barcode_invalid_gtin_length(self):
        url = reverse("barcode-generate")
        payload = {
            "elements": [
                {"ai": "01", "value": "123"},  # Invalid: requires 14 digits
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_download_barcode_png(self):
        url = reverse("barcode-download") + "?export_format=png&filename=my_barcode"
        payload = {
            "elements": [
                {"ai": "01", "value": "08412345678905"},
                {"ai": "10", "value": "BATCH-1"},
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertIn('filename="my_barcode.png"', response["Content-Disposition"])

    def test_download_barcode_svg(self):
        url = reverse("barcode-download") + "?export_format=svg&filename=my_barcode"
        payload = {
            "elements": [
                {"ai": "01", "value": "08412345678905"},
                {"ai": "10", "value": "BATCH-1"},
            ]
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/svg+xml")
        self.assertIn('filename="my_barcode.svg"', response["Content-Disposition"])

    def test_saved_barcode_crud(self):
        list_url = reverse("saved-barcodes-list")
        create_payload = {
            "name": "Shipping Label Pallet A",
            "description": "Standard outbound shipping label",
            "elements": [
                {"ai": "01", "value": "08412345678905"},
                {"ai": "10", "value": "LOT-999"},
            ],
        }
        response = self.client.post(list_url, data=create_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_id = response.json()["id"]

        # Retrieve
        detail_url = reverse("saved-barcodes-detail", kwargs={"pk": created_id})
        detail_res = self.client.get(detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.json()["name"], "Shipping Label Pallet A")

        # Generate from saved
        gen_url = reverse("saved-barcodes-generate", kwargs={"pk": created_id})
        gen_res = self.client.post(gen_url)
        self.assertEqual(gen_res.status_code, status.HTTP_200_OK)
        self.assertIn("svg", gen_res.json())

        # Delete
        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(SavedBarcode.objects.count(), 0)

    def test_nested_folders_and_manual_reorder(self):
        folders_url = reverse("barcode-folders-list")

        # Create root folder
        res_root = self.client.post(folders_url, data={"name": "Magazzino Nord"}, format="json")
        self.assertEqual(res_root.status_code, status.HTTP_201_CREATED)
        root_id = res_root.json()["id"]

        # Create nested subfolder
        res_sub = self.client.post(
            folders_url, data={"name": "Corsia A", "parent": root_id}, format="json"
        )
        self.assertEqual(res_sub.status_code, status.HTTP_201_CREATED)
        sub_id = res_sub.json()["id"]

        # Prevent circular parent (moving root inside its own child)
        root_detail_url = reverse("barcode-folders-detail", kwargs={"pk": root_id})
        circular_res = self.client.patch(
            root_detail_url, data={"parent": sub_id}, format="json"
        )
        self.assertEqual(circular_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Create two barcodes inside subfolder
        barcodes_url = reverse("saved-barcodes-list")
        b1 = self.client.post(
            barcodes_url,
            data={
                "name": "Barcode 1",
                "folder": sub_id,
                "elements": [{"ai": "", "value": "CODE-001"}],
            },
            format="json",
        ).json()
        b2 = self.client.post(
            barcodes_url,
            data={
                "name": "Barcode 2",
                "folder": sub_id,
                "elements": [{"ai": "", "value": "CODE-002"}],
            },
            format="json",
        ).json()

        # Reorder barcodes manually (b2 before b1)
        reorder_url = reverse("saved-barcodes-reorder")
        reorder_res = self.client.post(
            reorder_url, data={"ordered_ids": [b2["id"], b1["id"]]}, format="json"
        )
        self.assertEqual(reorder_res.status_code, status.HTTP_200_OK)

        list_res = self.client.get(barcodes_url).json()
        self.assertEqual([item["id"] for item in list_res], [b2["id"], b1["id"]])

        # Delete subfolder: barcodes inside should move up to parent folder (root_id)
        sub_detail_url = reverse("barcode-folders-detail", kwargs={"pk": sub_id})
        self.client.delete(sub_detail_url)
        b1_refreshed = SavedBarcode.objects.get(pk=b1["id"])
        self.assertEqual(b1_refreshed.folder_id, root_id)
