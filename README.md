# LLM Prototype — Group 07

**Course:** SOFTWARE ENGINEERING (14:332:452) Section 01 | Rutgers University–New Brunswick

**Authors:** Pravalika Chintakindi, Siddhartha Tamma, Ruchi Kapse, Emma Zafrir, Srinidhi Ganeshan, Eileen Rashduni

---

## Overview

PistachioAI is a web-based chat interface that sends every user prompt to **three locally-hosted LLMs simultaneously** via Ollama and displays the responses side-by-side. Users can compare answers, request an AI-synthesized summary, continue multi-turn conversations, bookmark chats, search history, and tune response length — all without an API key or internet connection.

---

## Features

| Feature | Description |
|---|---|
| Signup / Login / Logout | Session-based authentication with per-user data isolation |
| Multi-LLM responses | Every prompt is answered by Llama 3.2, TinyLlama, and Phi 3 in parallel |
| AI-generated titles | Conversation titles are generated automatically by the LLM |
| Summarize responses | One click synthesizes the three LLM answers into a single paragraph |
| Continue conversations | Follow-up messages extend the same conversation thread |
| Conversation history | All conversations are listed in the sidebar, newest first |
| Bookmarks | Save and revisit important conversations |
| Search | Full-text search across conversation titles, prompts, and responses |
| Response length control | Set a maximum word count for all LLM replies |
| Dark / light mode | UI theme toggle |
| Landing page | Public landing page redirects unauthenticated visitors |

---

## Tech Stack

**Backend**
- Node.js >= 18 (uses built-in `fetch`)
- Express.js 5
- Express Session (server-side sessions)

**Frontend**
- Vanilla HTML, CSS, JavaScript (no framework)

**LLM Runtime**
- Ollama — runs entirely on your machine, no API key required

**Testing**
- Jasmine — unit tests (`spec/appSpec.js`)
- Cucumber — BDD acceptance tests (`../testing-deliverables/features/`)
- Puppeteer — end-to-end browser tests (`../testing-deliverables/tests/puppeteer/`)

---

## Project Structure

```
Group07_SWE_Project-main/
├── server.js               # Express server, all API routes, and business logic
├── llmService.js           # Ollama HTTP integration — swap models here
├── package.json
├── spec/
│   ├── appSpec.js          # 19 Jasmine unit tests
│   └── support/
│       └── jasmine.json    # Test runner configuration
└── public/
    ├── landing.html        # Public landing page (unauthenticated)
    ├── index.html          # Main chat UI (authenticated)
    ├── app.js              # All frontend logic
    └── style.css           # Styles and theme variables
```

---

## Prerequisites

- **Node.js 18 or newer** — check with `node --version`
- **Ollama** — download from https://ollama.com/download

If you are on Node 17 or older, either upgrade Node or install `node-fetch`:
```bash
npm install node-fetch
```
Then add this line to the top of `llmService.js`:
```js
const fetch = require("node-fetch");
```

---

## Setup and Installation

**1. Clone the repository**
```bash
git clone https://github.com/ezafrir/Group07_SWE_Project.git
cd Group07_SWE_Project-main/Group07_SWE_Project-main
```

**2. Install dependencies**
```bash
npm install
```

**3. Install Ollama and pull all three models**

Download and install Ollama from https://ollama.com/download, then pull each model:
```bash
ollama pull llama3.2
ollama pull tinyllama
ollama pull phi3
```

You only need to pull models once. Confirm what is installed with:
```bash
ollama list
```

**4. Start Ollama**
```bash
ollama serve
```

Ollama runs at `http://localhost:11434` by default. Leave this terminal open.

**5. Start the app**
```bash
npm start
```

**6. Open in browser**

Navigate to http://localhost:3000

---

## Changing the LLM Model

The three models are defined at the top of `server.js`:

```js
const LLM_PERSONAS = [
  { name: "Llama 3.2", model: "llama3.2"  },
  { name: "TinyLlama", model: "tinyllama" },
  { name: "Phi 3",     model: "phi3"      }
];
```

Replace any `model` value with any model name from `ollama list`. Restart the server after editing.

---

## Data Storage

All data (users, conversations, bookmarks, settings) is stored **in memory** on the server. It is reset every time the server restarts. There is no database.

---

## REST API Reference

All routes under `/api/` that are marked **Auth required** will return `401 Unauthorized` if the user is not logged in.

### Auth

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/me` | No | Returns current session user or `{ loggedIn: false }` |
| POST | `/api/signup` | No | Create a new account. Body: `{ username, email, password }` |
| POST | `/api/login` | No | Log in. Body: `{ email, password }` |
| POST | `/api/logout` | No | Destroy the current session |

### Conversations

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/conversations` | Yes | List all conversations for the logged-in user |
| GET | `/api/conversations/:id` | Yes | Get a single conversation by ID |
| POST | `/api/conversations` | Yes | Send a new prompt; creates a conversation. Body: `{ prompt, shorten }` |
| POST | `/api/conversations/:id/messages` | Yes | Add a follow-up message to an existing conversation. Body: `{ prompt, shorten }` |
| DELETE | `/api/conversations/:id` | Yes | Delete a conversation |
| POST | `/api/conversations/:id/summary` | Yes | Generate an AI summary of the latest multi-LLM responses |

### Bookmarks

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/bookmarks` | Yes | List all bookmarked conversations for the logged-in user |
| POST | `/api/bookmarks/:id` | Yes | Bookmark a conversation |
| DELETE | `/api/bookmarks/:id` | Yes | Remove a bookmark |

### Search

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/search?q=query` | Yes | Search conversations by title, prompt text, or response text |

### Settings

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/settings` | Yes | Get current settings (response word limit) |
| PUT | `/api/settings/response-length` | Yes | Update the word limit. Body: `{ responseLength }` |

---

## Running Tests

### Unit Tests — Jasmine

Jasmine tests live in `spec/appSpec.js`. They use a **mock LLM service** so Ollama does not need to be running.

```bash
npx jasmine
```

Expected output: `19 specs, 0 failures`

**What is tested:**

| Test group | Specs |
|---|---|
| `shortenResponse` | Truncates to word limit; returns full text when already short |
| `conversation features` | Create conversation, bookmark, unbookmark, delete, null-return for missing IDs, userId isolation, prompt stored exactly, timestamps, response length |
| `multi-LLM response features` | Returns exactly 3 responses, each with non-empty model name and content, correct model order (Llama 3.2 → TinyLlama → Phi 3), assistant message has `responses` array, shortening applied to all 3, `addMessageToConversation` appends multi-LLM turn |

### BDD Acceptance Tests — Cucumber

Cucumber feature files cover 12 user-facing scenarios. Run from the `testing-deliverables` directory:

```bash
cd ../testing-deliverables
npm install
npm run test:cucumber
```

Feature files:
- `signup.feature`
- `login_logout.feature`
- `landing.feature`
- `prompt.feature`
- `ai_response.feature`
- `multi_llm_response.feature`
- `save_history.feature`
- `view_past_conversations.feature`
- `continue_conversations.feature`
- `bookmarks.feature`
- `search_conversations.feature`
- `dark_light_mode.feature`

### End-to-End Tests — Puppeteer

Puppeteer tests drive a real browser against the running application. **The server must be running** before executing these.

```bash
# Terminal 1 — start the app
npm start

# Terminal 2 — run E2E tests
cd ../testing-deliverables
npm run test:e2e
```

### Run All Tests (Cucumber + Puppeteer)

```bash
cd ../testing-deliverables
npm run test:all
```

---

## Troubleshooting

**The app returns "LLM service error"**

Ollama is not running or the model is not installed.
1. Run `ollama serve` in a separate terminal.
2. Run `ollama list` to confirm the required models are installed.
3. Pull any missing model: `ollama pull llama3.2`

**Port 3000 is already in use**

Another process is using port 3000. Either stop that process or change `const PORT = 3000` in `server.js` to another port.

**`fetch is not defined` error**

You are using Node 17 or older. Install `node-fetch` and update `llmService.js` as described in the Prerequisites section, or upgrade to Node 18+.

**Session not persisting after server restart**

Sessions are stored in memory. All login state is lost when the server restarts — log in again.


