const OLLAMA_URL  = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "llama3.2";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateLLMResponse(prompt, systemPrompt = null, model = DEFAULT_MODEL) {
  const body = { model, prompt, stream: false };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (err) {
      lastError = new Error(
        `Could not reach Ollama at ${OLLAMA_URL}. ` +
        "Make sure Ollama is running: ollama serve"
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      lastError = new Error(`Ollama returned HTTP ${response.status}: ${errorText}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastError;
    }

    const data = await response.json();
    return data.response;
  }

  throw lastError;
}

module.exports = generateLLMResponse;
