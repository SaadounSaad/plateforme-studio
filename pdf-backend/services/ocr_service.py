import base64
import os

import httpx

from config import MISTRAL_API_KEY

OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr"
OCR_MODEL = "mistral-ocr-latest"


def file_to_data_uri(file_path: str, mime_type: str) -> str:
    with open(file_path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def _call_ocr_api(file_path: str, mime_type: str) -> list[dict]:
    """Call Mistral OCR API, return raw pages list."""
    if not MISTRAL_API_KEY:
        raise ValueError("MISTRAL_API_KEY not configured")

    data_uri = file_to_data_uri(file_path, mime_type)
    doc = (
        {"type": "document_url", "document_url": data_uri}
        if mime_type == "application/pdf"
        else {"type": "image_url", "image_url": data_uri}
    )

    response = httpx.post(
        OCR_ENDPOINT,
        headers={"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"},
        json={"model": OCR_MODEL, "document": doc, "extract_header": True, "extract_footer": True},
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json().get("pages", [])


def ocr_file_pages(file_path: str, mime_type: str) -> list[dict]:
    """Returns list of {markdown: str} dicts, one per page."""
    pages = _call_ocr_api(file_path, mime_type)
    return [{"markdown": p.get("markdown", "")} for p in pages]


def ocr_file(file_path: str, mime_type: str, output_format: str = "txt") -> str:
    """Returns extracted text as a single string (txt or md)."""
    pages = _call_ocr_api(file_path, mime_type)
    if output_format == "md":
        parts = [f"## Page {i + 1}\n\n{p.get('markdown', '')}" for i, p in enumerate(pages)]
        return "\n\n---\n\n".join(parts)
    return "\n\n".join(p.get("markdown", "") for p in pages)
