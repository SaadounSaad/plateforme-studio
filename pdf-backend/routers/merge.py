import os

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from services import file_service, pdf_service

router = APIRouter(prefix="/api/merge", tags=["merge"])


@router.post("")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(
            status_code=400, detail="At least 2 PDF files are required to merge"
        )

    tmp_dir = file_service.make_temp_dir()
    try:
        input_paths: list[str] = []
        for i, upload in enumerate(files):
            safe = os.path.basename(upload.filename or f"input_{i}.pdf")
            path = file_service.safe_input_path(tmp_dir, f"{i}_{safe}", f"input_{i}.pdf")
            content = await upload.read()
            with open(path, "wb") as f:
                f.write(content)
            input_paths.append(path)

        output_path = os.path.join(tmp_dir, "merged.pdf")
        pdf_service.merge_pdfs(input_paths, output_path)

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename="merged.pdf",
            background=BackgroundTask(file_service.cleanup, tmp_dir),
        )
    except ValueError as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        file_service.cleanup(tmp_dir)
        raise HTTPException(status_code=500, detail=f"PDF merge failed: {str(e)}")
