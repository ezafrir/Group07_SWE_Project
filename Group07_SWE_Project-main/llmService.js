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





/*
// CHANGED: Ollama configuration — no API key required
const OLLAMA_BASE_URL = "http://localhost:11434"; // default Ollama address
const OLLAMA_MODEL    = "llama3.2";               // change to any pulled model

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





*/






// llmService.js additions
// Replaced hardcoded OLLAMA_MODEL to accept dynamic models

async function generateLLMResponse(prompt, modelName = "llama3.2", systemRole = "You are a helpful AI assistant.") {
  const requestBody = {
    model: modelName, 
    messages: [
      { role: "system", content: systemRole },
      { role: "user", content: prompt }
    ],
    stream: false 
  };

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(`Model "${modelName}" failed. Make sure it is pulled in Ollama.`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (err) {
    throw new Error(err.message);
  }
}

module.exports = generateLLMResponse;