import os
import sys
import argparse
import subprocess
import zipfile
from pathlib import Path

def run_command(cmd, shell=True):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=shell)
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)

def zip_backend(zip_path, source_dir):
    print(f"Nén mã nguồn vào {zip_path}...")
    exclude_dirs = {'__pycache__', 'venv', '.venv', 'env', '.env', 'data', 'cache'}
    exclude_exts = {'.pyc', '.zip', '.pdf'}

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Lọc bỏ thư mục không cần thiết
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if any(file.endswith(ext) for ext in exclude_exts):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    print("Nén xong!")

def main():
    parser = argparse.ArgumentParser(description="Deploy Backend to Vast.ai GPU instance")
    parser.add_argument("--host", required=True, help="Vast.ai SSH Host (VD: ssh4.vast.ai)")
    parser.add_argument("--port", required=True, help="Vast.ai SSH Port (VD: 12345)")
    parser.add_argument("--user", default="root", help="SSH Username (mặc định: root)")
    parser.add_argument("--key", help="Đường dẫn đến SSH private key (tuỳ chọn)")
    
    args = parser.parse_args()
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    zip_filename = "backend_deploy.zip"
    zip_filepath = os.path.join(current_dir, zip_filename)
    
    # 1. Nén code
    zip_backend(zip_filepath, current_dir)
    
    remote_target = f"{args.user}@{args.host}:/workspace"
    ssh_target = f"{args.user}@{args.host}"
    
    key_arg = f"-i {args.key} " if args.key else ""
    port_arg_scp = f"-P {args.port}"
    port_arg_ssh = f"-p {args.port}"
    
    print("\n🚀 Bắt đầu quá trình deploy backend lên Vast.ai...")
    
    # 2. Upload file ZIP
    print("\n📦 Đang upload mã nguồn (file ZIP) lên server...")
    scp_cmd = ["scp", "-o", "StrictHostKeyChecking=no"]
    if args.key:
        scp_cmd.extend(["-i", args.key])
    scp_cmd.extend(["-P", args.port, zip_filepath, f"{remote_target}/"])
    
    print(f"Running: {' '.join(scp_cmd)}")
    subprocess.run(scp_cmd)
    
    # Xoá file zip ở local cho sạch
    os.remove(zip_filepath)
    
    # 3. Giải nén, cài đặt thư viện và chạy Server
    print("\n⚙️ Đang giải nén, cài đặt thư viện và khởi động server...")
    
    remote_script = """
set -e
cd /workspace

echo "=== Cài đặt Ollama ==="
curl -fsSL https://ollama.com/install.sh | sh

echo "=== Khởi động Ollama ngầm ==="
nohup ollama serve > /workspace/ollama.log 2>&1 &

echo "=== Giải nén mã nguồn ==="
apt-get update -y && apt-get install -y unzip curl
mkdir -p backend
unzip -o backend_deploy.zip -d backend
rm backend_deploy.zip

cd backend
echo "=== Cài đặt thư viện Python ==="
pip install -r requirements.txt
pip install uvicorn fastapi python-multipart

echo "=== Đợi Ollama khởi động ==="
sleep 5

echo "=== Tải model qwen3:8b (Quá trình này có thể mất vài phút) ==="
ollama pull qwen3:8b

echo "=== Khởi động Uvicorn server ==="
# Phải đứng ở /workspace để python hiểu backend là một package
cd /workspace
uvicorn backend.main:app --host 0.0.0.0 --port 8000
    """
    
    ssh_cmd = ["ssh", "-o", "StrictHostKeyChecking=no"]
    if args.key:
        ssh_cmd.extend(["-i", args.key])
    ssh_cmd.extend(["-p", args.port, ssh_target, remote_script])
    
    print(f"Running SSH Commands...")
    subprocess.run(ssh_cmd)

if __name__ == "__main__":
    main()
