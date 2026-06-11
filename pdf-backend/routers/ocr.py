from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from services import file_service, ocr_service

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}


@router.post("")
async def run_ocr(
    file: UploadFile = File(...),
    format: str = Form(default="txt", description="Output format: 'txt' or 'md'"),
):
    if format not in ("txt", "md"):
        raise HTTPException(status_code=400, detail="format must be 'txt' or 'md'")

    content_type = file.content_type or ""
    if content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Supported: PDF, PNG, JPEG, WEBP",
        )

    tmp_dir = file_service.make_temp_dir()
    try:
        input_path = file_service.safe_input_path(tmp_dir, file.filename, "input")
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)

        pages = ocr_service.ocr_file_pages(input_path, content_type)
        file_service.cleanup(tmp_dir)
        return JSONResponse({"pages": pages, "total": len(pages)})
    except ValueError as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
