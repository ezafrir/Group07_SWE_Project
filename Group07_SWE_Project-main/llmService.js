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
// EXPORTS:
//   generateLLMResponse(prompt)
//     → Used for all normal chat. Routes to llama3.2.
//
//   generateCodeModification(instruction, fileContents, filePath)
//     → Used for self-modification requests. Routes to deepseek-coder
//       with the Constitution as a system prompt.
// ============================================================
 
// ── Model configuration ───────────────────────────────────────────────────────
// Both models run locally through Ollama — no API keys needed.
//
// CHAT MODEL (llama3.2):
//   Used for all normal conversation responses. Fast and lightweight.
//   Pull it with: ollama pull llama3.2
//
// CODE MODEL (deepseek-coder):
//   Used exclusively for self-modification requests (/api/suggest).
//   DeepSeek Coder is purpose-built for reading and writing code, which
//   makes it significantly more reliable than a general model for that task.
//   Pull it with: ollama pull deepseek-coder
//
// WHY TWO MODELS?
//   A general chat model is optimised for conversation — it produces fluent,
//   helpful prose. A code model is optimised for producing syntactically valid,
//   structured output. Using the right tool for each job gives better results
//   and keeps the chat model fast for everyday use.

const OLLAMA_BASE_URL = "http://localhost:11434"; // default Ollama address
const CHAT_MODEL    = "llama3.2";               // normal conversations
const CODE_MODEL = "deepseek-coder"; //for self-modification           // code modification requests
// Core fetch helper::::
// Both exported functions below share this helper to avoid repeating the same fetch/error-handling logic.
// The DRY principle from class!!!
//
// systemPrompt is how we pass the Constitution to DeepSeek 
// the system role carries instructions that the model treats as hard rules, separate from the user's actual request. 
// this is to hopefully avoid accidental (hopefully not purposeful) prompt injections!!!!

async function callOllama(model, userPrompt, systemPrompt = null) {
  const messages = [];
 
  // If a system prompt exists, prepend it as a "system" role message.
  // The system role is specifically designed for instructions, it carries
  // more weight than if you buried the rules inside the user message, which would also need to be every message.
  // which might give us issues with context collection. 

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
 
  messages.push({ role: "user", content: userPrompt });
 
  const requestBody = {
    model,
    messages,
    stream: false // stream:false gives us one complete JSON response
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
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. ` +
      `Make sure Ollama is installed and running ("ollama serve"). ` +
      `Original error: ${err.message}`
    );
  }
 
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status}: ${errorText}. ` +
      `Check that the model "${model}" is pulled (run: ollama pull ${model}).`
    );
  }
 
  const data = await response.json();
  return data.message.content;
}




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
