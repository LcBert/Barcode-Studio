"""
GS1-128 (formerly EAN-128) encoding, validation, and rendering utilities.
"""

from __future__ import annotations

import base64
import io
import re
from typing import Any

from barcode import get_barcode_class
from barcode.codex import Gs1_128
from barcode.writer import ImageWriter, SVGWriter


# Supported GS1 Application Identifiers specification
GS1_AIS: dict[str, dict[str, Any]] = {
    "00": {
        "ai": "00",
        "title": "SSCC (Serial Shipping Container Code)",
        "type": "numeric",
        "fixed_length": 18,
        "regex": r"^\d{18}$",
        "placeholder": "18 numeric digits",
        "example": "123456789012345678",
    },
    "01": {
        "ai": "01",
        "title": "GTIN (Global Trade Item Number)",
        "type": "numeric",
        "fixed_length": 14,
        "regex": r"^\d{14}$",
        "placeholder": "14 numeric digits",
        "example": "08412345678905",
    },
    "02": {
        "ai": "02",
        "title": "GTIN of Contained Trade Items",
        "type": "numeric",
        "fixed_length": 14,
        "regex": r"^\d{14}$",
        "placeholder": "14 numeric digits",
        "example": "08412345678905",
    },
    "10": {
        "ai": "10",
        "title": "Batch or Lot Number",
        "type": "alphanumeric",
        "max_length": 20,
        "regex": r"^[A-Za-z0-9\-_./]{1,20}$",
        "placeholder": "Up to 20 alphanumeric chars",
        "example": "BATCH-2026-X1",
    },
    "11": {
        "ai": "11",
        "title": "Production Date (YYMMDD)",
        "type": "date",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "YYMMDD (e.g. 261102)",
        "example": "261102",
    },
    "12": {
        "ai": "12",
        "title": "Due Date (YYMMDD)",
        "type": "date",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "YYMMDD",
        "example": "261231",
    },
    "13": {
        "ai": "13",
        "title": "Packaging Date (YYMMDD)",
        "type": "date",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "YYMMDD",
        "example": "261102",
    },
    "15": {
        "ai": "15",
        "title": "Best Before Date (YYMMDD)",
        "type": "date",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "YYMMDD",
        "example": "270630",
    },
    "17": {
        "ai": "17",
        "title": "Expiration Date (YYMMDD)",
        "type": "date",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "YYMMDD (e.g. 271231)",
        "example": "271231",
    },
    "20": {
        "ai": "20",
        "title": "Internal Product Variant",
        "type": "numeric",
        "fixed_length": 2,
        "regex": r"^\d{2}$",
        "placeholder": "2 digits",
        "example": "01",
    },
    "21": {
        "ai": "21",
        "title": "Serial Number",
        "type": "alphanumeric",
        "max_length": 20,
        "regex": r"^[A-Za-z0-9\-_./]{1,20}$",
        "placeholder": "Up to 20 alphanumeric chars",
        "example": "SN987654321",
    },
    "240": {
        "ai": "240",
        "title": "Additional Product Identification",
        "type": "alphanumeric",
        "max_length": 30,
        "regex": r"^[A-Za-z0-9\-_./]{1,30}$",
        "placeholder": "Up to 30 alphanumeric chars",
        "example": "PRD-REF-9942",
    },
    "30": {
        "ai": "30",
        "title": "Variable Count / Quantity",
        "type": "numeric",
        "max_length": 8,
        "regex": r"^\d{1,8}$",
        "placeholder": "1-8 digits",
        "example": "150",
    },
    "37": {
        "ai": "37",
        "title": "Count of Trade Items",
        "type": "numeric",
        "max_length": 8,
        "regex": r"^\d{1,8}$",
        "placeholder": "1-8 digits",
        "example": "24",
    },
    "3100": {
        "ai": "3100",
        "title": "Net Weight (kg, 0 dec)",
        "type": "numeric",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "6 digits",
        "example": "000150",
    },
    "3102": {
        "ai": "3102",
        "title": "Net Weight (kg, 2 dec)",
        "type": "numeric",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "6 digits (e.g. 001250 = 12.50kg)",
        "example": "001250",
    },
    "3103": {
        "ai": "3103",
        "title": "Net Weight (kg, 3 dec)",
        "type": "numeric",
        "fixed_length": 6,
        "regex": r"^\d{6}$",
        "placeholder": "6 digits (e.g. 001250 = 1.250kg)",
        "example": "001250",
    },
    "400": {
        "ai": "400",
        "title": "Customer Purchase Order Number",
        "type": "alphanumeric",
        "max_length": 30,
        "regex": r"^[A-Za-z0-9\-_./]{1,30}$",
        "placeholder": "Up to 30 alphanumeric chars",
        "example": "PO-994821",
    },
    "420": {
        "ai": "420",
        "title": "Ship-to / Deliver-to Postal Code",
        "type": "alphanumeric",
        "max_length": 20,
        "regex": r"^[A-Za-z0-9\-_]{1,20}$",
        "placeholder": "Up to 20 chars",
        "example": "20100",
    },
    "421": {
        "ai": "421",
        "title": "Ship-to Postal Code with ISO Country",
        "type": "alphanumeric",
        "max_length": 12,
        "regex": r"^\d{3}[A-Za-z0-9]{1,9}$",
        "placeholder": "3 digits ISO country + postal code",
        "example": "38020100",
    },
    "90": {
        "ai": "90",
        "title": "Mutually Agreed Internal Data",
        "type": "alphanumeric",
        "max_length": 30,
        "regex": r"^[A-Za-z0-9\-_./]{1,30}$",
        "placeholder": "Up to 30 alphanumeric chars",
        "example": "INTERNAL-DATA",
    },
    "91": {
        "ai": "91",
        "title": "Company Internal 91",
        "type": "alphanumeric",
        "max_length": 30,
        "regex": r"^[A-Za-z0-9\-_./]{1,30}$",
        "placeholder": "Up to 30 chars",
        "example": "DEPT-A1",
    },
    "": {
        "ai": "",
        "title": "Codice Libero (Senza AI / Code 128)",
        "type": "alphanumeric",
        "max_length": 80,
        "regex": r"^[\x20-\x7E]{1,80}$",
        "placeholder": "Testo o codice alfanumerico libero",
        "example": "CODICE-123456",
    },
}


def is_fixed_length_ai(ai: str) -> bool:
    info = GS1_AIS.get(ai)
    return bool(info and "fixed_length" in info)


def validate_gs1_element(ai: str, value: str) -> str:
    """
    Validates a single element (with or without AI). Returns cleaned value or raises ValueError.
    """
    cleaned_value = str(value).strip()
    if not cleaned_value:
        if ai:
            raise ValueError(f"Value for AI ({ai}) cannot be empty")
        raise ValueError("Value cannot be empty")

    spec = GS1_AIS.get(ai)
    if spec:
        if "fixed_length" in spec and len(cleaned_value) != spec["fixed_length"]:
            raise ValueError(
                f"AI ({ai}) requires exactly {spec['fixed_length']} characters (got {len(cleaned_value)})"
            )
        if "max_length" in spec and len(cleaned_value) > spec["max_length"]:
            limit_msg = f"AI ({ai})" if ai else "Code without AI"
            raise ValueError(
                f"{limit_msg} maximum length is {spec['max_length']} characters (got {len(cleaned_value)})"
            )
        if "regex" in spec and not re.match(spec["regex"], cleaned_value):
            prefix = f"AI ({ai})" if ai else "Code without AI"
            raise ValueError(
                f"Value '{cleaned_value}' does not match format required for {prefix}: {spec['placeholder']}"
            )
    elif not ai:
        if len(cleaned_value) > 80:
            raise ValueError("Maximum length for code without AI is 80 characters")
        if not re.match(r"^[\x20-\x7E]{1,80}$", cleaned_value):
            raise ValueError("Value contains unsupported characters (must be standard ASCII characters)")
    return cleaned_value


def build_gs1_code(elements: list[dict[str, str]]) -> tuple[str, str]:
    """
    Constructs the raw barcode encoded string (with FNC1 delimiters when appropriate)
    and the human-readable string.
    """
    if not elements:
        raise ValueError("At least one element is required")

    encoded_parts: list[str] = []
    human_readable_parts: list[str] = []

    has_any_ai = any(bool(elem.get("ai", "").strip()) for elem in elements)
    total = len(elements)
    for idx, elem in enumerate(elements):
        ai = str(elem.get("ai", "")).strip()
        raw_val = str(elem.get("value", "")).strip()
        cleaned_val = validate_gs1_element(ai, raw_val)

        if ai:
            human_readable_parts.append(f"({ai}){cleaned_val}")
            encoded_parts.append(ai)
            encoded_parts.append(cleaned_val)

            # GS1 standard rule:
            # If an AI is variable length and NOT the last element in the barcode symbol,
            # an FNC1 delimiter is required to signal where this field ends.
            is_last = idx == total - 1
            if not is_last and not is_fixed_length_ai(ai):
                encoded_parts.append(Gs1_128.FNC1_CHAR)
        else:
            human_readable_parts.append(cleaned_val)
            encoded_parts.append(cleaned_val)
            is_last = idx == total - 1
            if not is_last and has_any_ai:
                encoded_parts.append(Gs1_128.FNC1_CHAR)

    raw_code = "".join(encoded_parts)
    human_readable = "".join(human_readable_parts)
    return raw_code, human_readable


def generate_gs1_barcode(
    elements: list[dict[str, str]],
    module_width: float = 0.35,
    module_height: float = 22.0,
    font_size: int = 12,
    quiet_zone: float = 6.5,
) -> dict[str, Any]:
    """
    Generates both SVG and PNG outputs of barcode (GS1-128 or Code 128 if no AI).
    """
    raw_code, human_readable = build_gs1_code(elements)

    has_any_ai = any(bool(elem.get("ai", "").strip()) for elem in elements)
    barcode_cls = get_barcode_class("gs1_128" if has_any_ai else "code128")

    writer_options = {
        "module_width": module_width,
        "module_height": module_height,
        "font_size": font_size,
        "text_distance": 5.0,
        "quiet_zone": quiet_zone,
        "text": human_readable,
    }

    # Generate SVG
    svg_barcode = barcode_cls(raw_code, writer=SVGWriter())
    svg_buffer = io.BytesIO()
    svg_barcode.write(svg_buffer, options=writer_options, text=human_readable)
    raw_svg = svg_buffer.getvalue().decode("utf-8")

    # Clean SVG: normalize units, scale font, and position text cleanly below bars
    clean_svg = re.sub(r"(\d+\.\d+)mm", r"\1", raw_svg)
    dim_match = re.search(r'width="([\d\.]+)"\s+height="([\d\.]+)"', clean_svg)
    if dim_match:
        w_val = float(dim_match.group(1))
        avail_w = max(w_val - (2 * quiet_zone), 10.0)
        char_count = max(len(human_readable), 1)
        safe_font_size = min(font_size * 0.3528, avail_w / (char_count * 0.58))
        safe_font_size = max(safe_font_size, 1.8)

        bars_bottom = 1.0 + module_height
        text_y = bars_bottom + safe_font_size + 1.2
        new_total_height = text_y + (safe_font_size * 0.5)

        def fix_text_elem(match):
            attrs = match.group(1)
            attrs = re.sub(r'y="[\d\.]+"', f'y="{text_y:.3f}"', attrs)
            style_str = (
                f"fill:black;font-size:{safe_font_size:.3f};"
                "font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:600;text-anchor:middle;"
            )
            attrs = re.sub(r'style="[^"]*"', f'style="{style_str}"', attrs)
            return f"<text{attrs}>"

        clean_svg = re.sub(r"<text([^>]+)>", fix_text_elem, clean_svg)
        viewbox_attr = f'viewBox="0 0 {w_val:.3f} {new_total_height:.3f}" preserveAspectRatio="xMidYMid meet"'
        clean_svg = re.sub(r'width="[\d\.]+"', 'width="100%"', clean_svg, count=1)
        clean_svg = re.sub(r'height="[\d\.]+"', 'height="100%"', clean_svg, count=1)
        svg_content = re.sub(r"<svg([^>]*)>", rf"<svg\1 {viewbox_attr}>", clean_svg, count=1)
    else:
        svg_content = clean_svg

    # Generate PNG
    png_writer = ImageWriter(format="PNG")
    png_barcode = barcode_cls(raw_code, writer=png_writer)
    png_buffer = io.BytesIO()
    png_barcode.write(png_buffer, options=writer_options, text=human_readable)
    png_bytes = png_buffer.getvalue()
    png_base64 = base64.b64encode(png_bytes).decode("ascii")

    return {
        "raw_code": raw_code,
        "human_readable": human_readable,
        "svg": svg_content,
        "png_base64": f"data:image/png;base64,{png_base64}",
        "png_bytes": png_bytes,
    }
