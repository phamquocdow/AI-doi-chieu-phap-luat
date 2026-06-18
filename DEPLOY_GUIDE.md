# Hướng Dẫn Triển Khai và Kết Nối Backend với Vast.ai

Tài liệu này hướng dẫn cách đưa Backend (chứa các model AI nặng) lên dịch vụ GPU Cloud của Vast.ai, và cách kết nối Frontend (đang chạy ở máy tính cá nhân của bạn) với Backend đó.

---

## 🚀 TRƯỜNG HỢP 1: CÀI ĐẶT TỪ ĐẦU (Dành cho máy mới thuê)

Phần này thực hiện khi bạn vừa thuê một máy chủ (Instance) mới tinh trên Vast.ai.

**LƯU Ý:** Đảm bảo rằng bạn đã thêm khóa SSH (ví dụ `id_ed25519.pub`) vào tài khoản Vast.ai **TRƯỚC KHI** bấm thuê máy. Khóa SSH nằm ở mục **Account -> SSH Keys**.

### Bước 1: Thuê máy chủ
1. Đăng nhập Vast.ai và chọn thuê một máy chủ có GPU.
2. Chọn Image hỗ trợ Python/Ubuntu cơ bản.
3. **Cực kỳ quan trọng:** Ở phần cấu hình Instance, bạn phải mở cổng (Port Forwarding) cho cổng `8000` (đây là cổng của Uvicorn).
4. Đợi máy chủ chuyển sang trạng thái **Running**, lấy thông tin **IP (Host)** và **Port SSH**.

### Bước 2: Chạy File Deploy Tự Động
Mở PowerShell ở máy tính cá nhân (di chuyển vào thư mục `c:\law2\backend`) và chạy lệnh sau (thay thông tin `<IP>` và `<PORT>` tương ứng):
```powershell
python deploy_vast.py --host <IP> --port <PORT> --key "C:\Users\Hung\.ssh\id_ed25519"
```
*(Script này sẽ tự động upload code, cài đặt Ollama, tải model `qwen3:8b` và khởi động server Uvicorn. Hãy kiên nhẫn đợi script chạy xong. Cứ để nguyên cửa sổ này để duy trì server).*

### Bước 3: Tạo đường hầm kết nối (Port Forwarding)
Mở **một cửa sổ PowerShell mới tinh** trên máy cá nhân và gõ lệnh:
```powershell
ssh -N -L 127.0.0.1:8000:127.0.0.1:8000 -p <PORT> root@<IP> -i "C:\Users\Hung\.ssh\id_ed25519" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3
```
*(Lệnh này chạy ngầm và không in ra gì, bạn cứ để cửa sổ này mở để duy trì kết nối).*

### Bước 4: Chạy Frontend
Đường hầm đã thông! Mở cửa sổ thứ 3, vào thư mục frontend và chạy:
```powershell
cd c:\law2\frontend
npm run dev
```

---

## 🔄 TRƯỜNG HỢP 2: KẾT NỐI LẠI (Dành cho máy vừa bật lại sau khi tạm dừng, hoặc mất kết nối)

Khi bạn bấm Pause máy để tiết kiệm tiền rồi Start lại, **Vast.ai sẽ đổi địa chỉ IP và Port SSH mới.** 
*(Trường hợp bạn chỉ bị rớt mạng/mất kết nối ngầm mà chưa Pause máy, IP và Port vẫn giữ nguyên).*

Dù là trường hợp nào, bạn đều cần kết nối lại và dọn dẹp Server cũ đang bị kẹt. **Code đã có sẵn trên máy nên KHÔNG CẦN CHẠY LẠI file `deploy_vast.py`**.

### Bước 1: SSH vào máy chủ
Mở PowerShell và đăng nhập thẳng vào máy chủ bằng lệnh SSH mới lấy được trên Vast.ai:
```powershell
ssh -p 40762 root@88.207.5.223 -i "C:\Users\Hung\.ssh\id_ed25519" -o StrictHostKeyChecking=no
```

### Bước 2: Tắt tiến trình cũ và khởi động lại Ollama + Backend
Khi đã vào được máy chủ (`root@...:/workspace$`), bạn cần "tiêu diệt" tiến trình Uvicorn cũ đang kẹt (để tránh lỗi khóa DB Qdrant), sau đó bật lại cả Ollama và Uvicorn:
```bash
# Tắt tiến trình bị kẹt
pkill -f uvicorn

# Bật lại Ollama (chạy ngầm)
nohup ollama serve > /workspace/ollama.log 2>&1 &

# Bật lại server Backend
cd /workspace
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*(Cứ để cửa sổ này chạy để duy trì server).*

### Bước 3: Tạo đường hầm kết nối (Port Forwarding)
Mở **một cửa sổ PowerShell mới** trên máy cá nhân và gõ lệnh:
```powershell
ssh -N -L 127.0.0.1:8000:127.0.0.1:8000 -p 40762 root@88.207.5.223 -i "C:\Users\Hung\.ssh\id_ed25519" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3
```
*(Cứ để cửa sổ này chạy ngầm).*

### Bước 4: Dùng Frontend
Đường hầm đã thông! Bật frontend ở một cửa sổ khác và sử dụng bình thường:
```powershell
cd c:\law2\frontend
npm run dev
```
