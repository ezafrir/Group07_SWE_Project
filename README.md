# PistachioAI — Group 07 — Iteration 3

## Quick Start

```bash
npm install
ollama serve          # in a separate terminal
node server.js
```

Open http://localhost:3000

---

## Requirements

- **Node.js 18+** — uses the built-in `fetch` API
- **Ollama** — runs local LLM models on your machine

---

## Ollama Setup (Local Models)

### 1. Install Ollama

Download from https://ollama.com/download and install it.

### 2. Pull the required models

```bash
# Main chat model
ollama pull llama3.2

# Multi-model comparison panel
ollama pull phi3
ollama pull tinyllama

# Self-modification feature (see section below)
ollama pull deepseek-coder:1.3b     # low RAM machines (8 GB)
ollama pull deepseek-coder:6.7b     # recommended (16 GB+)
```

### 3. Start Ollama

```bash
ollama serve
```

Ollama runs at `http://localhost:11434` by default. Keep this terminal open.

---

## Cloud Models (Optional)

Two free cloud models are supported. Neither requires a credit card.

### Gemini 2.5 Flash (Google AI Studio)

Get a free key at https://aistudio.google.com/app/apikey

```bash
GEMINI_API_KEY=your_key node server.js
```

### Groq — Llama 3.3 70B

Get a free key at https://console.groq.com

```bash
GROQ_API_KEY=your_key node server.js
```

### Running with both cloud models

```bash
GEMINI_API_KEY=your_gemini_key GROQ_API_KEY=your_groq_key node server.js
```

On Windows:

```cmd
set GEMINI_API_KEY=your_gemini_key
set GROQ_API_KEY=your_groq_key
node server.js
```

---

## Features

| Feature | Description |
|---|---|
| Local models | Chat with Llama 3.2, Phi-3, TinyLlama via Ollama |
| Cloud models | Gemini 2.5 Flash and Groq/Llama 3.3 70B (free tier) |
| Weather | Ask about weather in any city — powered by Open-Meteo (no key needed) |
| Multi-model panel | Compare responses from all local models side by side |
| Summarize All | AI-generated summary of all model responses |
| Compare All | AI-generated comparison of differences between models |
| Rename conversation | Click ✏️ next to any chat in the sidebar |
| Export conversation | Click ⬇ next to any chat to download as a .txt file |
| Delete single chat | Click ✕ next to any chat in the sidebar |
| Delete all chats | Click 🗑 Delete All Chats at the bottom of the sidebar |
| Bookmark | Pin important conversations for quick access |
| Search | Search all conversations by keyword |
| Suggest a Change | Use AI to modify the UI with natural language (see below) |

---

## Suggest a Change Feature

The **✦ Suggest a Change** button in the top bar lets you modify the app's own source files using natural language, powered by DeepSeek Coder.

### Setup

Pull DeepSeek Coder before using this feature:

```bash
ollama pull deepseek-coder:6.7b     # recommended
# or if you have limited RAM (8 GB):
ollama pull deepseek-coder:1.3b
```

If you previously pulled 6.7b and need to free up space:

```bash
ollama rm deepseek-coder:6.7b
ollama pull deepseek-coder:1.3b
```

### How to use it

1. Click **✦ Suggest a Change** in the top bar
2. Select the file you want to modify from the dropdown
3. Type your instruction and click **Apply Change**
4. The original file is automatically backed up to `.llm_backups/` before any changes are made
5. Reload the page to see your changes

### Writing effective instructions

The model works best with **specific, line-level instructions**. The more precisely you describe the change, the more reliably it works.

**✅ Good instructions — specific and line-level:**
```
Change the value of --active-chat-bg in the light theme from #EBF5E6 to #FFA500
Change the font-size in .brand-name from 17px to 20px
Change the string "Sending…" in sendBtn.textContent to "Loading…"
Change the text of the New Chat button from ＋ New Chat to ✦ New Chat
Change background-color of .send-btn from var(--primary) to #E67E22
```

**❌ Bad instructions — too vague:**
```
Make the background orange
Make the sidebar look better
Change the color scheme
```

### Which file to pick

| You want to change | Select this file |
|---|---|
| Colors, fonts, spacing, layout | `public/style.css` |
| Button text, page structure, modals | `public/index.html` |
| Button behavior, JS logic, strings | `public/app.js` |

### Safety

- Only `public/` files can be modified — server files are protected
- The original file is always backed up before any write
- JavaScript files are syntax-checked before being saved
- Instructions that request dangerous operations (deleting data, shell commands, etc.) are rejected with a `CONSTITUTION_VIOLATION` error

---

## Running Tests

### Unit tests (Jasmine)

```bash
npm test
```

Does not require Ollama — all LLM calls are mocked.

### End-to-end tests (Puppeteer)

```bash
cd testing-deliverables
npm install
npm run test:e2e
```

Does not require Ollama — all LLM calls are mocked automatically.

### Acceptance tests (Cucumber)

```bash
cd testing-deliverables
npm run test:cucumber
```

Requires Ollama running and the server started at `localhost:3000`.

---

## Project Structure

```
Group07_SWE_Project-main/
├── server.js              — Express server, API routes, self-modification logic
├── llmService.js          — LLM integrations (Ollama, Gemini, Groq, weather)
├── package.json
├── public/
│   ├── index.html         — Main app UI
│   ├── app.js             — Frontend logic
│   ├── style.css          — Styles
│   ├── landing.html       — Login / signup page
│   └── landing.js         — Login / signup logic
├── spec/
│   ├── appSpec.js         — Jasmine unit tests
│   └── e2eSpec.js         — Puppeteer e2e tests (source)
└── testing-deliverables/
    ├── features/          — Cucumber feature files
    │   └── step_definitions/
    │       └── steps.js   — Cucumber step definitions
    └── tests/puppeteer/
        └── e2e.test.js    — Puppeteer e2e tests (runnable)
```

---

## Troubleshooting

**"fetch failed" when using Suggest a Change**
Ollama is not running or is out of memory. Run `ollama serve` in a separate terminal. If you have 8 GB RAM, unload other models first:
```bash
curl http://localhost:11434/api/generate -d '{"model":"llama3.2","keep_alive":0}'
```

**"Cannot POST /api/suggest"**
You are running an old `server.js`. Make sure you are running the iteration 3 version.

**Gemini 429 error**
You have exceeded the free tier rate limit. Wait a minute and try again, or switch to Groq.

**"Could not find the target text in the file"**
Your instruction was too vague and the model hallucinated CSS/JS that doesn't exist in your file. Use a more specific instruction that includes the exact property name and current value (see examples above).
