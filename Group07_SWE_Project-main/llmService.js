// ============================================================
// llmService.js — UPDATED: Now supports 3 LLMs simultaneously.
//
// MODELS SUPPORTED:
//   1. llama3.2    — General-purpose assistant (via Ollama)
//   2. deepseek-r1 — Step-by-step reasoning & math (via Ollama)
//   3. gemma3      — Creative writing & summarization (via Ollama)
//
// HOW OLLAMA WORKS (no API key needed!):
//   Ollama runs entirely on your local machine.
//   1. Install Ollama: https://ollama.com/download
//   2. Pull all models:
//        ollama pull llama3.2
//        ollama pull deepseek-r1
//        ollama pull gemma3
//   3. Start Ollama:   ollama serve   (runs at http://localhost:11434)
//   4. Start this app: npm start
// ============================================================

const OLLAMA_BASE_URL = "http://localhost:11434";

// ── LLM registry ──────────────────────────────────────────────────────────────
// Each entry describes one model for both the backend and the frontend.
const LLM_REGISTRY = [
  {
    id:          "llama3.2",
    name:        "Llama 3.2",
    model:       "llama3.2",
    description: "Best for general questions, conversations, and everyday tasks.",
    shortDesc:   "General-purpose assistant"
  },
  {
    id:          "deepseek-r1",
    name:        "DeepSeek R1",
    model:       "deepseek-r1",
    description: "Best for complex reasoning, math problems, and step-by-step analysis.",
    shortDesc:   "Reasoning & math expert"
  },
  {
    id:          "gemma3",
    name:        "Gemma 3",
    model:       "gemma3",
    description: "Best for creative writing, summarization, and natural language tasks.",
    shortDesc:   "Creative writing & summaries"
  }
];

// ── Single-model call ─────────────────────────────────────────────────────────
async function callOllama(model, prompt) {
  const requestBody = {
    model,
    messages: [{ role: "user", content: prompt }],
    stream: false
  };

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(requestBody)
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. ` +
      `Make sure Ollama is installed and running ("ollama serve"). ` +
      `Original error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status} for model "${model}": ${errorText}. ` +
      `Check that the model is pulled (run: ollama pull ${model}).`
    );
  }

  const data = await response.json();
  return data.message.content;
}

// ── Legacy single-model helper (still used by title generation) ───────────────
async function generateLLMResponse(prompt) {
  return callOllama("llama3.2", prompt);
}

// ── Parallel multi-LLM call ───────────────────────────────────────────────────
// Queries all three LLMs simultaneously using Promise.all so that all run
// at the same time. Each failure is caught individually so one bad model
// never blocks the others.
//
// Returns an object keyed by LLM id:
// {
//   "llama3.2":    { id, status: "fulfilled", response: "…" },
//   "deepseek-r1": { id, status: "rejected",  error: "…"    },
//   "gemma3":      { id, status: "fulfilled", response: "…" }
// }
async function generateAllLLMResponses(prompt) {
  const promises = LLM_REGISTRY.map(llm =>
    callOllama(llm.model, prompt)
      .then(text => ({ id: llm.id, status: "fulfilled", response: text }))
      .catch(err => ({ id: llm.id, status: "rejected",  error: err.message }))
  );

  const results = await Promise.all(promises);

  const byId = {};
  results.forEach(r => { byId[r.id] = r; });
  return byId;
}

module.exports = {
  generateLLMResponse,
  generateAllLLMResponses,
  LLM_REGISTRY
};
