import pytest
import httpx
from httpx import AsyncClient, ASGITransport

from main import app


@pytest.mark.asyncio
async def test_split_missing_file_returns_422():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/split", data={"ranges": "1-2"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_split_missing_ranges_returns_422():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/split",
            files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_split_invalid_ranges_returns_400():
    """A valid-looking PDF with out-of-bounds range should return 400."""
    import io
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/split",
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
            data={"ranges": "99-100"},
        )
    assert response.status_code == 400
