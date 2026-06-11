import os
from pypdf import PdfWriter, PdfReader


def _parse_ranges(ranges_str: str, page_count: int) -> list[tuple[int, int]]:
    """Parse a ranges string like '1-3; 5-8; 12' into 0-based (start, end) tuples."""
    segments = [s.strip() for s in ranges_str.replace(",", ";").split(";") if s.strip()]
    if not segments:
        raise ValueError("No valid ranges provided")
    result = []
    for seg in segments:
        if "-" in seg:
            parts = seg.split("-", 1)
            try:
                start, end = int(parts[0].strip()), int(parts[1].strip())
            except ValueError:
                raise ValueError(f"Invalid range segment: '{seg}'")
            if start < 1 or end < start or end > page_count:
                raise ValueError(
                    f"Range '{seg}' is out of bounds for a {page_count}-page document"
                )
            result.append((start - 1, end - 1))
        else:
            try:
                page = int(seg)
            except ValueError:
                raise ValueError(f"Invalid page number: '{seg}'")
            if page < 1 or page > page_count:
                raise ValueError(
                    f"Page {page} is out of bounds for a {page_count}-page document"
                )
            result.append((page - 1, page - 1))
    return result


def split_pages(input_path: str, ranges_str: str, output_dir: str) -> list[str]:
    """Split a PDF according to ranges_str (e.g. '1-3; 5-8; 12').

    Returns a list of output PDF paths, one per range segment.
    """
    reader = PdfReader(input_path)
    page_count = len(reader.pages)
    ranges = _parse_ranges(ranges_str, page_count)
    output_paths: list[str] = []
    for idx, (start, end) in enumerate(ranges):
        writer = PdfWriter()
        for page_idx in range(start, end + 1):
            writer.add_page(reader.pages[page_idx])
        out_path = os.path.join(output_dir, f"part_{idx + 1}.pdf")
        with open(out_path, "wb") as f:
            writer.write(f)
        output_paths.append(out_path)
    return output_paths


def merge_pdfs(input_paths: list[str], output_path: str) -> str:
    """Merge multiple PDFs in order into output_path. Returns output_path."""
    writer = PdfWriter()
    for path in input_paths:
        reader = PdfReader(path)
        for page in reader.pages:
            writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path
