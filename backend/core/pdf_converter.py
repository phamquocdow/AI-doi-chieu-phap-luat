import os
import shutil
import subprocess
import tempfile
from pathlib import Path

def _find_soffice_executable() -> str | None:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None

def _run_word_export_via_powershell(source_path: Path, destination_pdf: Path) -> None:
    escaped_source = str(source_path).replace("'", "''")
    escaped_destination = str(destination_pdf).replace("'", "''")
    script = f"""
$ErrorActionPreference = 'Stop'
$src = '{escaped_source}'
$dst = '{escaped_destination}'
$word = $null
$doc = $null
try {{
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open($src, $false, $true)
  $doc.ExportAsFixedFormat($dst, 17)
}} finally {{
  if ($doc -ne $null) {{ $doc.Close([ref]$false) | Out-Null }}
  if ($word -ne $null) {{ $word.Quit() | Out-Null }}
}}
"""
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-Command", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0 or not destination_pdf.exists():
        raise RuntimeError("Word COM export to PDF failed.")

def _run_libreoffice_export(source_path: Path, destination_pdf: Path) -> None:
    soffice = _find_soffice_executable()
    if not soffice:
        raise RuntimeError("LibreOffice executable not found.")

    with tempfile.TemporaryDirectory() as temp_dir:
        completed = subprocess.run(
            [
                soffice,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                temp_dir,
                str(source_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        generated_pdf = Path(temp_dir) / f"{source_path.stem}.pdf"
        if completed.returncode != 0 or not generated_pdf.exists():
            raise RuntimeError("LibreOffice export to PDF failed.")
        shutil.move(str(generated_pdf), destination_pdf)

def convert_to_pdf(source_path: Path, destination_pdf: Path) -> str:
    suffix = source_path.suffix.lower()
    if suffix == ".pdf":
        if source_path != destination_pdf:
            shutil.copy2(source_path, destination_pdf)
        return "passthrough"

    if suffix == ".docx":
        if os.name == "nt":
            try:
                _run_word_export_via_powershell(source_path, destination_pdf)
                return "ms_word_com"
            except Exception as e:
                pass

        try:
            _run_libreoffice_export(source_path, destination_pdf)
            return "libreoffice"
        except Exception as e:
            pass
            
    # Fallback to pure python conversion is hard without libraries. 
    # For now, just raise if we couldn't convert it.
    if not destination_pdf.exists():
        raise ValueError(f"Không thể chuyển đổi file {source_path.name} sang PDF trên máy chủ.")
    
    return "unknown"
