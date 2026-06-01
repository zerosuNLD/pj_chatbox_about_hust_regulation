# 🎓 HUST Q&A — Trợ Lý Ảo Quy Chế Đào Tạo ĐHBK Hà Nội

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.136%2B-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/LangGraph-ReAct_Agent-blueviolet" />
  <img src="https://img.shields.io/badge/GraphRAG-Knowledge_Graph-orange" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

Hệ thống **Trợ lý Ảo thông minh** chuyên giải đáp câu hỏi về **Quy chế Đào tạo của Đại học Bách Khoa Hà Nội (HUST)**. Dự án tích hợp công nghệ **GraphRAG** (đồ thị tri thức) với **LangGraph ReAct Agent** và bộ nhớ hội thoại dài hạn để cung cấp câu trả lời chính xác, có trích dẫn nguồn.

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| 🔍 **Hybrid Search** | Kết hợp local search + global search trên đồ thị tri thức GraphRAG |
| 🧠 **ReAct Agent** | LangGraph agent tự động lập kế hoạch và tra cứu nhiều bước |
| 💾 **Bộ nhớ ngắn hạn** | Lưu lịch sử hội thoại qua `AsyncSqliteSaver` của LangGraph |
| 📌 **Bộ nhớ dài hạn** | Ghi nhớ thông tin người dùng (tên, ngành, lớp,...) vào SQLite |
| ⚡ **SSE Streaming** | Hiển thị luồng suy nghĩ (Thought Chain) real-time trên giao diện |
| 📚 **Trích dẫn nguồn** | Tự động đính kèm điều khoản quy chế làm nguồn tham chiếu |
| 🛡️ **Human-in-the-loop** | Xác nhận trước khi lưu thông tin cá nhân vào bộ nhớ dài hạn |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                  │
│   React + TypeScript + TailwindCSS + SSE streaming       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│                    Backend (FastAPI)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           LangGraph ReAct Agent                   │   │
│  │  ┌─────────────┐  ┌──────────────────────────┐  │   │
│  │  │  Short-term  │  │      GraphRAG Tools       │  │   │
│  │  │   Memory     │  │  local_search_hybrid      │  │   │
│  │  │  (SQLite)    │  │  global_search_hybrid     │  │   │
│  │  └─────────────┘  │  save_user_memory          │  │   │
│  │  ┌─────────────┐  └──────────────────────────┘  │   │
│  │  │  Long-term   │                                 │   │
│  │  │   Memory     │  ┌──────────────────────────┐  │   │
│  │  │  (SQLite)    │  │  Knowledge Graph (FAISS + │  │   │
│  │  └─────────────┘  │  NetworkX GraphML)         │  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Cấu trúc thư mục

```
hust-qa/
├── backend/                    # FastAPI + LangGraph backend
│   ├── server.py               # Entry point: FastAPI app + SSE endpoints
│   ├── standard_graph.py       # LangGraph ReAct agent workflow
│   ├── graphrag_tools.py       # Công cụ GraphRAG (local/global search)
│   ├── graphrag_workflow.py    # Pipeline xây dựng knowledge graph
│   ├── requirements.txt        # Python dependencies
│   ├── settings.yaml           # Cấu hình GraphRAG
│   ├── .env.example            # Template biến môi trường (copy → .env)
│   ├── input/                  # Tài liệu quy chế đầu vào (*.txt)
│   ├── prompts/                # System prompts cho agent
│   └── memories/               # Bộ nhớ dài hạn người dùng (.md files)
│
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   └── components/         # React components
│   ├── package.json
│   └── .env.local.example      # Template biến môi trường frontend
│
├── .gitignore
└── README.md
```

---

## 🐳 Cài đặt nhanh với Docker (Khuyến nghị)

> Cách đơn giản nhất — chỉ cần **Docker Desktop** và **API keys**, không cần cài Python hay Node.js.

### Yêu cầu
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài và đang chạy

### 3 bước để chạy

```bash
# Bước 1: Clone dự án
git clone https://github.com/zerosuNLD/pj_chatbox_about_hust_regulation.git
cd pj_chatbox_about_hust_regulation

# Bước 2: Tạo file .env và điền API keys
cp backend/.env.example backend/.env
# Mở backend/.env, điền GROQ_API_KEY và DEEPSEEK_API_KEY

# Bước 3: Build và chạy
docker compose up --build
```

✅ Mở trình duyệt tại **`http://localhost:3000`**

> **Lần đầu chạy**: Docker build ~3-5 phút (tải dependencies), sau đó backend tự động build FAISS search index (~30-60 giây). Các lần chạy sau chỉ mất vài giây.

### Dừng ứng dụng
```bash
docker compose down
```

### Reset hoàn toàn (bao gồm xóa FAISS index cache)
```bash
docker compose down -v
```

---

## 🚀 Hướng dẫn cài đặt & Chạy (Thủ công)

### Yêu cầu hệ thống

| Công nghệ | Phiên bản tối thiểu |
|-----------|---------------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Git | 2.x |

---

### ⚙️ Bước 1: Clone dự án

```bash
git clone https://github.com/<your-username>/hust-qa.git
cd hust-qa
```

---

### 🐍 Bước 2: Cài đặt & Chạy Backend

#### 2.1 Di chuyển vào thư mục backend

```bash
cd backend
```

#### 2.2 Tạo virtual environment (khuyến nghị)

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

#### 2.3 Cài đặt các thư viện Python

```bash
pip install -r requirements.txt
```

> **Lưu ý:** Quá trình cài đặt `faiss-cpu` và `sentence-transformers` có thể mất vài phút.

#### 2.4 Cấu hình biến môi trường

Sao chép file template và điền API keys:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Mở file `.env` và điền thông tin:

```env
# Bắt buộc: Groq API (đăng ký miễn phí tại https://console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Tùy chọn: DeepSeek API (https://platform.deepseek.com)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# GraphRAG API Key (Cloudflare AI / OpenAI compatible)
GRAPHRAG_API_KEY=your_graphrag_api_key_here
```

#### 2.5 (Lần đầu) Xây dựng Knowledge Graph

Nếu chưa có thư mục `backend/output/` (chứa đồ thị tri thức), cần chạy pipeline GraphRAG:

```bash
python graphrag_workflow.py
```

> ⏳ Bước này có thể mất **15–30 phút** tùy kích thước tài liệu. Chỉ cần chạy **một lần**.

#### 2.6 Khởi chạy server Backend

```bash
python server.py
```

✅ Server backend sẽ chạy tại: **`http://localhost:8000`**

Kiểm tra trạng thái:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

---

### 🌐 Bước 3: Cài đặt & Chạy Frontend

Mở terminal mới, di chuyển vào thư mục frontend:

```bash
cd frontend
```

#### 3.1 Cài đặt dependencies

```bash
npm install
```

#### 3.2 Cấu hình biến môi trường

```bash
# Windows
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local

# macOS / Linux
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

Hoặc tạo file `.env.local` thủ công:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3.3 Khởi chạy Frontend

```bash
npm run dev
```

✅ Mở trình duyệt tại: **`http://localhost:3000`**

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/health` | Kiểm tra trạng thái server |
| `POST` | `/ask` | Gửi câu hỏi, nhận phản hồi SSE streaming |
| `POST` | `/resume` | Tiếp tục sau Human-in-the-loop interrupt |

### Ví dụ gọi API `/ask`

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Điều kiện tốt nghiệp đại học tại HUST là gì?",
    "thread_id": "user-123-session-1",
    "user_id": "user-123"
  }'
```

### SSE Event Types

| Event | Mô tả |
|-------|-------|
| `thought` | Bước suy luận của agent (tool call, tra cứu,...) |
| `answer` | Token câu trả lời cuối cùng (streaming) |
| `answer_retract` | Thu hồi câu trả lời tạm (khi phát hiện cần gọi thêm tool) |
| `sources` | Danh sách nguồn trích dẫn |
| `clarify` | Yêu cầu xác nhận từ người dùng (HITL) |
| `done` | Kết thúc stream |
| `error` | Lỗi xảy ra |

---

## 🛠️ Công nghệ sử dụng

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** — REST API framework
- **[LangGraph](https://langchain-ai.github.io/langgraph/)** — ReAct Agent workflow
- **[GraphRAG](https://microsoft.github.io/graphrag/)** — Knowledge graph retrieval
- **[LangChain](https://python.langchain.com/)** — LLM integration (Groq, DeepSeek)
- **[FAISS](https://faiss.ai/)** — Vector similarity search
- **[SQLite](https://www.sqlite.org/)** — Checkpoints & long-term memory
- **[sentence-transformers](https://www.sbert.net/)** — Text embeddings

### Frontend
- **[Next.js 14](https://nextjs.org/)** — React framework (App Router)
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[TailwindCSS](https://tailwindcss.com/)** — Styling
- **[react-markdown](https://github.com/remarkjs/react-markdown)** — Markdown rendering

---

## 🔧 Xử lý lỗi thường gặp

### ❌ `ModuleNotFoundError: No module named 'dotenv'`
```bash
pip install python-dotenv
```

### ❌ SQLite I/O error trên WSL
Server tự động phát hiện WSL và chuyển checkpoints sang `/tmp/`. Nếu vẫn lỗi:
```bash
export TMPDIR=/tmp
python server.py
```

### ❌ Frontend không kết nối được backend
Kiểm tra file `frontend/.env.local` có đúng `NEXT_PUBLIC_API_URL=http://localhost:8000`.
Đảm bảo backend đang chạy và CORS đã được bật (mặc định `allow_origins=["*"]`).

### ❌ GraphRAG output không tìm thấy
Cần chạy lại pipeline:
```bash
cd backend
python graphrag_workflow.py
```

---

## 📄 License

Dự án được phân phối theo giấy phép **MIT**. Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<p align="center">Made with ❤️ for HUST students</p>
