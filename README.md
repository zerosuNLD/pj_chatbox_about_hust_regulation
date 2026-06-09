# HUST Q&A — AI Assistant for HUST Academic Regulations

Main technologies: Python 3.10+, FastAPI 0.136+, Next.js 14, LangGraph ReAct Agent, GraphRAG Knowledge Graph, MIT License.

Build a chatbot for answering questions about HUST academic regulations 2026 (https://github.com/user-attachments/assets/96021338-6b36-4597-879d-e062aa868718)

---
## Approach

Data preprocessing: convert to Markdown, remove logos, remove footers, convert tables to corresponding text.

Represent the data as a knowledge graph (by extracting entities and relationships between entities, using the Leiden algorithm to split into communities, etc.).

Write retrieval tools on top of the knowledge graph (based on global search and local search algorithms), while also combining them with chunks retrieved by naive search (standard RAG style: retrieve the top-k most relevant sentences).

Build a ReAct agent equipped with tools for retrieving internal information, together with memory management using long-term memories and short-term memories (using the LangGraph library to build the agent).

Build the interface using Next.js as the frontend, while the agent is implemented with FastAPI.

Use SSE so that the thought stream and the final answer can be streamed to the user interface.

---
## System Architecture

### Agent

The user's question is combined with short-term memory and then passed to the agent.
The agent operates in a thought – action – observation loop with a max step of 8.
The agent is provided with 3 tools: get_user_memory, global_search_hybrid, local_search_hybrid.
<img width="1392" height="545" alt="image" src="https://github.com/user-attachments/assets/e7c4e6bf-a417-4579-9fb8-f10d93812131" />


### Knowledge graph
The knowledge graph is built using the micrograghrag library with the following settings:

AI model: deepseek-v4-flash  
Embedding model: bge-m3  
Chunking with size = 800, overlap = 100  
Entity types to extract: [organization, regulation, program, course, person, credit, degree, condition, deadline]

Knowledge graph after creation:
<img width="783" height="484" alt="image" src="https://github.com/user-attachments/assets/22cda981-8377-40fa-bbb8-d5c85de8b437" />  
Nodes: 625  
Edges: 1411  
Communities: 21 (created by the Leiden Algorithm)  

### Retrieval
There are 2 tools that the agent can use for search:

@tool: local_search_hybrid: information extraction based on a combination of Local Search and Naive Search  
@tool: global_search_hybrid: based on a combination of Global Search and Naive Search

Local Search: used when asking a specific question with a clear target — asking about a specific entity, clause, or regulation.  
<img width="1430" height="92" alt="image" src="https://github.com/user-attachments/assets/bf76d1bc-f39f-4fab-b7fd-d14ed4548acf" />

Global Search: used when asking general overview questions.  
<img width="1447" height="84" alt="image" src="https://github.com/user-attachments/assets/351d9a1e-c205-41fd-9174-f1000685e802" />

Naive Search:
<img width="1403" height="213" alt="image" src="https://github.com/user-attachments/assets/3d628fca-9517-4e7c-ae35-a064b88e5326" />

### Memories
Managed using short-term memory and long-term memory.

Short-term memory:
<img width="1443" height="106" alt="image" src="https://github.com/user-attachments/assets/3c1f39d2-0b98-4c34-94ac-bc8e0ef97bb0" />

Long-term memory:
<img width="1351" height="317" alt="image" src="https://github.com/user-attachments/assets/ee0a0db4-fb11-4692-96f8-35e3af85058d" />

---

## Project Structure

```text
hust-qa/
├── backend/                    # FastAPI + LangGraph backend
│   ├── server.py               # Entry point: FastAPI app + SSE endpoints
│   ├── standard_graph.py       # LangGraph ReAct agent workflow
│   ├── graphrag_tools.py       # GraphRAG tools (local/global search)
│   ├── graphrag_workflow.py    # Knowledge graph construction pipeline
│   ├── requirements.txt        # Python dependencies
│   ├── settings.yaml           # GraphRAG configuration
│   ├── .env.example            # Environment template (copy → .env)
│   ├── input/                  # Input regulation documents (*.txt)
│   ├── prompts/                # System prompts for the agent
│   └── memories/               # User long-term memory (.md files)
│
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   └── components/         # React components
│   ├── package.json
│   └── .env.local.example      # Frontend environment template
│
├── .gitignore
└── README.md
```

---

## Quick Setup with Docker (Recommended)

> The simplest way — only **Docker Desktop** and **API keys** are required, no need to install Python or Node.js.

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 3 steps to run

```bash
# Step 1: Clone the project
git clone https://github.com/zerosuNLD/pj_chatbox_about_hust_regulation.git
cd pj_chatbox_about_hust_regulation

# Step 2: Create the .env file and fill in API keys
cp backend/.env.example backend/.env
# Open backend/.env and set GROQ_API_KEY and DEEPSEEK_API_KEY

# Step 3: Build and run
docker compose up --build
```

Open your browser at **`http://localhost:3000`**

> **First run**: Docker build takes about 3–5 minutes (to download dependencies), then the backend automatically builds the FAISS search index (~30–60 seconds). Subsequent runs take only a few seconds.

### Stop the application
```bash
docker compose down
```

### Fully reset (including deleting FAISS index cache)
```bash
docker compose down -v
```

---

## Installation & Run Guide (Manual)

### System requirements

| Technology | Minimum version |
|-----------|------------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Git | 2.x |

---

### Step 1: Clone the project

```bash
git clone https://github.com/<your-username>/hust-qa.git
cd hust-qa
```

---

### Step 2: Install & Run the Backend

#### 2.1 Move into the backend directory

```bash
cd backend
```

#### 2.2 Create a virtual environment (recommended)

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

#### 2.3 Install Python libraries

```bash
pip install -r requirements.txt
```

> **Note:** Installing `faiss-cpu` and `sentence-transformers` may take a few minutes.

#### 2.4 Configure environment variables

Copy the template file and fill in the API keys:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open the `.env` file and fill in the information:

```env
# Required: Groq API (free registration at https://console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: DeepSeek API (https://platform.deepseek.com)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# GraphRAG API Key (Cloudflare AI / OpenAI compatible)
GRAPHRAG_API_KEY=your_graphrag_api_key_here
```

#### 2.5 (First time only) Build the Knowledge Graph

If the `backend/output/` directory does not exist (it contains the knowledge graph), run the GraphRAG pipeline:

```bash
python graphrag_workflow.py
```

> This step may take **15–30 minutes** depending on the document size. It only needs to be run **once**.

#### 2.6 Start the Backend Server

```bash
python server.py
```

The backend server will run at: **`http://localhost:8000`**

Check status:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

---

### Step 3: Install & Run the Frontend

Open a new terminal and move into the frontend directory:

```bash
cd frontend
```

#### 3.1 Install dependencies

```bash
npm install
```

#### 3.2 Configure environment variables

```bash
# Windows
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local

# macOS / Linux
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

Or create the `.env.local` file manually:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3.3 Start the Frontend

```bash
npm run dev
```

Open your browser at: **`http://localhost:3000`**

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Check server status |
| `POST` | `/ask` | Send a question and receive SSE streaming responses |
| `POST` | `/resume` | Continue after a Human-in-the-loop interrupt |

### Example of calling the `/ask` API

```bash
curl -X POST http://localhost:8000/ask   -H "Content-Type: application/json"   -d '{
    "question": "What are the graduation requirements at HUST?",
    "thread_id": "user-123-session-1",
    "user_id": "user-123"
  }'
```

### SSE Event Types

| Event | Description |
|-------|-------------|
| `thought` | Agent reasoning step (tool call, retrieval, etc.) |
| `answer` | Final answer token (streaming) |
| `answer_retract` | Retract temporary answer (when more tool calls are needed) |
| `sources` | List of cited sources |
| `clarify` | Ask the user for confirmation (HITL) |
| `done` | End of stream |
| `error` | An error occurred |

---

## Technologies Used

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

<p align="center">Made with ❤️ for HUST students</p>
