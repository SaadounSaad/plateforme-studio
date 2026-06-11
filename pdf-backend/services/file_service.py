import os
import tempfile
import shutil


def make_temp_dir() -> str:
    return tempfile.mkdtemp()


def cleanup(tmp_dir: str) -> None:
    shutil.rmtree(tmp_dir, ignore_errors=True)


def safe_input_path(tmp_dir: str, filename: str | None, default: str) -> str:
    """Build a path for a user-supplied upload name, defeating path traversal.

    Keeps only the basename (drops any ../ or absolute path) and verifies the
    resolved path stays inside tmp_dir.
    """
    base = os.path.basename(filename or default) or default
    path = os.path.join(tmp_dir, base)
    root = os.path.realpath(tmp_dir)
    if not os.path.realpath(path).startswith(root + os.sep):
        raise ValueError("invalid filename")
    return path
