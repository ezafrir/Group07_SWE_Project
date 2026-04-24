// ============================================================
// llmService.js — CHANGED: Replaced hardcoded fake responses
//                 with real Ollama API calls.
//
// HOW OLLAMA WORKS (no API key needed!):
//   Ollama runs entirely on your local machine.
//   1. Install Ollama: https://ollama.com/download
//   2. Pull a model:   ollama pull llama3.2
//   3. Start Ollama:   ollama serve   (runs at http://localhost:11434)
//   4. Start this app: npm start
//
// CHANGING THE MODEL:
//   Edit OLLAMA_MODEL below to any model you have pulled.
//   Run `ollama list` in your terminal to see available models.
//
// IF YOU WANT TO USE A REMOTE OLLAMA SERVER INSTEAD:
//   Change OLLAMA_BASE_URL to your server's address, e.g.:
//   const OLLAMA_BASE_URL = "http://my-server:11434";
// ============================================================

// CHANGED: Ollama configuration — no API key required
const OLLAMA_BASE_URL = "http://127.0.0.1:11434"; // default Ollama address
const OLLAMA_MODEL    = "llama3.2";               // change to any pulled model

// MULTI-LLM: The three models used for individual iteration feature
const MULTI_LLM_MODELS = [
  { id: "llama3.2:latest", label: "Llama 3.2" },
  { id: "phi3:latest",     label: "Phi-3"     },
  { id: "gemma3:latest",   label: "Gemma 3"   }
];

// MULTI-LLM: Calls a single model by name and returns its text response.
//            Exported for unit-testing individual model calls.
async function generateResponseFromModel(prompt, modelId) {
  const requestBody = {
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    stream: false
  };

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL} for model "${modelId}". ` +
      `Make sure Ollama is installed and running ("ollama serve"). ` +
      `Original error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status} for model "${modelId}": ${errorText}. ` +
      `Check that the model is pulled (run: ollama pull ${modelId}).`
    );
  }

  const data = await response.json();
  return data.message.content;
}

// MULTI-LLM: Calls all three models in parallel and returns an array of
//            { modelId, label, response, error } objects — one per model.
//            A failed model sets error instead of response so the other
//            results are still returned to the client.
async function generateMultiLLMResponses(prompt) {
  const results = await Promise.allSettled(
    MULTI_LLM_MODELS.map(async ({ id, label }) => {
      const text = await generateResponseFromModel(prompt, id);
      return { modelId: id, label, response: text, error: null };
    })
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      modelId: MULTI_LLM_MODELS[i].id,
      label:   MULTI_LLM_MODELS[i].label,
      response: null,
      error:   result.reason.message
    };
  });
}

// CHANGED: Function is now async because it calls the Ollama API
async function generateLLMResponse(prompt) {
  // CHANGED: Build the request body for Ollama's /api/chat endpoint.
  //          We use the chat endpoint so conversation history can be
  //          added here in the future if desired.
  const requestBody = {
    model: OLLAMA_MODEL,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    stream: false // CHANGED: stream:false so we get one complete JSON response
  };

  // CHANGED: Call the Ollama API running locally
  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // NOTE: No Authorization header needed — Ollama has no API key by default.
        //       If you add auth to your Ollama server later, add:
        //         "Authorization": "Bearer YOUR_TOKEN"
      },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    // CHANGED: Friendly error if Ollama isn't running
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. ` +
      `Make sure Ollama is installed and running ("ollama serve"). ` +
      `Original error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status}: ${errorText}. ` +
      `Check that the model "${OLLAMA_MODEL}" is pulled (run: ollama pull ${OLLAMA_MODEL}).`
    );
  }

  // CHANGED: Parse the JSON and extract the assistant's reply
  const data = await response.json();
  return data.message.content; // Ollama chat response structure
}

module.exports = generateLLMResponse;
module.exports.generateResponseFromModel  = generateResponseFromModel;
module.exports.generateMultiLLMResponses  = generateMultiLLMResponses;
module.exports.MULTI_LLM_MODELS           = MULTI_LLM_MODELS;
