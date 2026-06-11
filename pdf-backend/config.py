from dotenv import load_dotenv
import os

load_dotenv()

MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100 MB
