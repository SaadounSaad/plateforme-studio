import os
import zipfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from services import file_service, pdf_service

router = APIRouter(prefix="/api/split", tags=["split"])


@router.post("")
async def split_pdf(
    file: UploadFile = File(...),
    ranges: str = Form(..., description="Example: '1-3; 5-8; 12'"),
):
    tmp_dir = file_service.make_temp_dir()
    try:
        input_path = file_service.safe_input_path(tmp_dir, file.filename, "input.pdf")
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)

        output_paths = pdf_service.split_pages(input_path, ranges, tmp_dir)

        if len(output_paths) == 1:
            return FileResponse(
                output_paths[0],
                media_type="application/pdf",
                filename="split_result.pdf",
                background=BackgroundTask(file_service.cleanup, tmp_dir),
            )

        zip_path = os.path.join(tmp_dir, "split_results.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            for p in output_paths:
                zf.write(p, os.path.basename(p))
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="split_results.zip",
            background=BackgroundTask(file_service.cleanup, tmp_dir),
        )
    except ValueError as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=500, detail=f"PDF split failed: {str(e)}")
