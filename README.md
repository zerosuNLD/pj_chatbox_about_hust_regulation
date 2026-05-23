# HUST Q&A 2026 - Trợ lý Ảo Quy chế Đào tạo Đại học Bách Khoa Hà Nội

Hệ thống Trợ lý Ảo thông minh chuyên hỗ trợ giải đáp các câu hỏi liên quan đến **Quy chế Đào tạo của Đại học Bách Khoa Hà Nội (HUST) năm 2026**. Dự án tích hợp công nghệ **GraphRAG** kết hợp với **LangGraph (ReAct Agent)** và cơ sở dữ liệu **SQLite** để cung cấp câu trả lời chính xác dựa trên tài liệu quy chế, đồng thời có khả năng ghi nhớ thông tin ngắn hạn và dài hạn của người dùng.

---

## 📁 Cấu trúc thư mục dự án

Dự án được tổ chức theo cấu trúc Monorepo chia làm 2 phần chính:

```text
├── frontend/          # Mã nguồn ứng dụng Web Frontend (Next.js, React, TypeScript, TailwindCSS)
├── backend/           # Mã nguồn API Backend (FastAPI, LangGraph, Python)
├── .gitignore         # File cấu hình bỏ qua các tệp không cần thiết khi đẩy lên Git
└── README.md          # Hướng dẫn sử dụng và giới thiệu dự án (File này)
```

---

## ✨ Các tính năng nổi bật

1. **Tra cứu quy chế đào tạo chính xác:**
   * Sử dụng cơ chế tìm kiếm lai (hybrid search) tích hợp đồ thị kiến thức (Knowledge Graph) qua **GraphRAG** (`local_search_hybrid` và `global_search_hybrid`).
   * Đảm bảo câu trả lời luôn trung thực với nguồn tài liệu quy chế, tự động trích dẫn nguồn cụ thể ở cuối câu trả lời.

2. **Quản lý Bộ nhớ thông minh (Memory Management):**
   * **Bộ nhớ ngắn hạn (Short-term memory):** Lưu trữ lịch sử cuộc hội thoại hiện tại bằng `AsyncSqliteSaver` của LangGraph (lưu trữ trong `backend/checkpoints.db`).
   * **Bộ nhớ dài hạn (Long-term memory):** Trích xuất và lưu trữ thông tin cá nhân của người dùng (tên, ngành học, lớp, các sở thích/yêu cầu lâu dài) qua bảng SQLite `user_memories` (lưu trữ trong `backend/long_term_memory.db`).

3. **Giao diện thân thiện & Luồng Stream SSE:**
   * Trò chuyện theo thời gian thực sử dụng Server-Sent Events (SSE) để hiển thị luồng suy nghĩ (Thought Chain) của Agent trước khi đưa ra câu trả lời cuối cùng.
   * Phong cách trả lời lịch sự, chuyên nghiệp và ngắn gọn.

---

## 🚀 Hướng dẫn cài đặt và chạy ứng dụng

### 1. Cài đặt & Chạy Backend

Di chuyển vào thư mục `backend`:
```bash
cd backend
```

#### Cài đặt thư viện:
Yêu cầu Python 3.10 trở lên. Tiến hành cài đặt các thư viện cần thiết:
```bash
pip install -r requirements.txt
```

#### Cấu hình biến môi trường (`.env`):
Tạo file `.env` trong thư mục `backend` và điền đầy đủ các API key cần thiết:
```env
GROQ_API_KEY=your_groq_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

#### Chạy server FastAPI:
```bash
python server.py
```
Server backend sẽ chạy tại địa chỉ `http://localhost:8000`.

---

### 2. Cài đặt & Chạy Frontend

Di chuyển vào thư mục `frontend`:
```bash
cd ../frontend
```

#### Cài đặt thư viện:
Yêu cầu Node.js 18 trở lên. Sử dụng npm để cài đặt các package:
```bash
npm install
```

#### Cấu hình biến môi trường (`.env.local`):
Tạo file `.env.local` trong thư mục `frontend`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Khởi chạy dự án ở chế độ Development:
```bash
npm run dev
```
Mở trình duyệt truy cập `http://localhost:3000` để bắt đầu trò chuyện với trợ lý ảo.
