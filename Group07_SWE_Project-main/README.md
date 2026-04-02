# LLM Prototype — Group 07

## Setup

```bash
npm install
npm start
```

Open http://localhost:3000

---

## Ollama Integration (CHANGED)

This project now uses **Ollama** to generate real AI responses locally.  
**No API key is required.** Ollama runs entirely on your machine.

### Step 1 — Install Ollama

Download from https://ollama.com/download and install it.

### Step 2 — Pull a model

```bash
ollama pull llama3.2
```

You can use any model. Run `ollama list` to see what you have installed.  
To change the model, edit `OLLAMA_MODEL` at the top of `llmService.js`.

### Step 3 — Start Ollama

```bash
ollama serve
```

Ollama runs at `http://localhost:11434` by default.

### Step 4 — Start the app

```bash
npm start
```

---

## Node.js Version

Node **18 or newer** is required.  
`llmService.js` uses the built-in `fetch` API which was added in Node 18.

If you must use an older Node version, install `node-fetch`:
```bash
npm install node-fetch
```
Then add this line at the top of `llmService.js`:
```js
const fetch = require("node-fetch");
```

---

## Files Changed

| File | What changed |
|---|---|
| `llmService.js` | Replaced hardcoded fake responses with real Ollama API calls. Function is now `async`. |
| `server.js` | `createConversation` and `addMessageToConversation` are now `async`. The two POST route handlers that call them are `async` with `try/catch` for error handling. |
| `package.json` | Added `engines` field documenting the Node 18+ requirement. |
| `README.md` | Added Ollama setup instructions. |
