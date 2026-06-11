import pytest
from httpx import AsyncClient, ASGITransport

from main import app


@pytest.mark.asyncio
async def test_merge_single_file_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/merge",
            files=[("files", ("a.pdf", b"%PDF-1.4", "application/pdf"))],
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_merge_no_files_returns_422():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/merge")
    assert response.status_code == 422
