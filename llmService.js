// ============================================================
// llmService.js — Iteration 3
//
// LOCAL MODELS (via Ollama):
//   1. Install Ollama: https://ollama.com/download
//   2. Pull models:   ollama pull llama3.2
//                     ollama pull phi3
//                     ollama pull tinyllama
//   3. Start Ollama:  ollama serve
//
// CLOUD MODELS:
//   Gemini 2.5 Flash (Google AI Studio — free, no credit card):
//     GEMINI_API_KEY=your_key node server.js
//     Get key: https://aistudio.google.com/app/apikey
//
//   Groq / Llama 3.3 70B (Groq — free, no credit card):
//     GROQ_API_KEY=your_key node server.js
//     Get key: https://console.groq.com
//
// WEATHER:
//   Powered by Open-Meteo (https://open-meteo.com) — completely
//   free, no API key required. When a prompt mentions weather,
//   the server fetches live data and injects it before sending
//   to the LLM so it can answer accurately.
// ============================================================

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL    = "llama3.2";

const MULTI_LLM_MODELS = [
  { id: "llama3.2:latest",  label: "Llama 3.2",  type: "ollama" },
  { id: "phi3:latest",      label: "Phi-3",       type: "ollama" },
  { id: "tinyllama:latest", label: "TinyLlama",   type: "ollama" }
];

// ── Weather detection & fetching (Open-Meteo, no key needed) ─────────────────

const WEATHER_KEYWORDS = [
  "weather", "temperature", "temp", "forecast", "rain", "raining",
  "sunny", "cloudy", "wind", "humid", "snow", "snowing", "hot", "cold",
  "warm", "freezing", "storm", "thunder", "lightning", "climate today",
  "outside today", "outside right now", "degrees", "fahrenheit", "celsius"
];

// WMO weather code → human-readable description
const WMO_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
};

function isWeatherQuery(prompt) {
  const lower = prompt.toLowerCase();
  return WEATHER_KEYWORDS.some(kw => lower.includes(kw));
}

// Extract a location from the prompt.
// Handles: "in NYC", "in New York", "in new york", "in LA", "in los angeles",
//          "for Boston", "weather Chicago", "weather: seattle"
function extractLocation(prompt) {
  // Normalise but keep original casing for the captured group
  const patterns = [
    // "in <location>" or "for <location>"
    /\b(?:in|for)\s+([A-Za-z][A-Za-z\s,.]{1,40}?)(?:\s*[?.,!]|$)/i,
    // "weather <location>" or "weather: <location>"
    /\bweather[:\s]+([A-Za-z][A-Za-z\s,.]{1,40}?)(?:\s*[?.,!]|$)/i,
    // "temperature in/of <location>"
    /\btemperature\s+(?:in|of)\s+([A-Za-z][A-Za-z\s,.]{1,40}?)(?:\s*[?.,!]|$)/i,
  ];

  for (const re of patterns) {
    const match = prompt.match(re);
    if (match) {
      const loc = match[1].trim();
      // Skip common false positives that are not locations
      const stopWords = ["the", "a", "an", "my", "your", "our", "this", "that", "here", "there"];
      if (!stopWords.includes(loc.toLowerCase())) return loc;
    }
  }
  return null;
}

// Geocode a city name → { lat, lon, name } via Open-Meteo's geocoding API
async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed for "${city}"`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`No location found for "${city}"`);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: `${r.name}, ${r.country}` };
}

// Fetch current weather from Open-Meteo (completely free, no key)
async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
    `precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo request failed");
  return res.json();
}

// Build a plain-English weather context string to inject into the prompt
async function buildWeatherContext(prompt) {
  try {
    let lat, lon, locationName;

    const city = extractLocation(prompt);
    if (city) {
      const geo = await geocodeCity(city);
      lat = geo.lat; lon = geo.lon; locationName = geo.name;
    } else {
      // Default to Philadelphia (server location) — in production you'd
      // use the user's IP geolocation
      lat = 39.9526; lon = -75.1652; locationName = "Philadelphia, PA";
    }

    const weather = await fetchWeatherData(lat, lon);
    const c       = weather.current;
    const desc    = WMO_CODES[c.weather_code] ?? "Unknown";

    return (
      `[Live weather data for ${locationName} — ${new Date().toLocaleString()}]\n` +
      `Conditions: ${desc}\n` +
      `Temperature: ${c.temperature_2m}°F (feels like ${c.apparent_temperature}°F)\n` +
      `Humidity: ${c.relative_humidity_2m}%\n` +
      `Precipitation: ${c.precipitation} in\n` +
      `Wind: ${c.wind_speed_10m} mph\n`
    );
  } catch (err) {
    return `[Weather lookup failed: ${err.message}. Answer based on general knowledge.]\n`;
  }
}

// Wrap a prompt with weather context if needed
async function enrichPromptWithWeather(prompt) {
  if (!isWeatherQuery(prompt)) return prompt;
  const ctx = await buildWeatherContext(prompt);
  return `${ctx}\nUser question: ${prompt}\n\nAnswer the question using the live weather data above.`;
}

// ── Gemini 2.5 Flash ──────────────────────────────────────────────────────────
const GEMINI_MODEL   = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function generateGeminiResponse(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. " +
      "Get a free key at https://aistudio.google.com/app/apikey"
    );
  }

  const enriched = await enrichPromptWithWeather(prompt);

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: enriched }] }] })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "(No response from Gemini)";
}

// ── Groq / Llama 3.3 70B ─────────────────────────────────────────────────────
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function generateGroqResponse(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. " +
      "Get a free key at https://console.groq.com"
    );
  }

  const enriched = await enrichPromptWithWeather(prompt);

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: enriched }],
      max_tokens: 1024
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "(No response from Groq)";
}

// ── Ollama / cloud router ─────────────────────────────────────────────────────
async function generateResponseFromModel(prompt, modelId) {
  if (modelId === "gemini-2.5-flash")       return generateGeminiResponse(prompt);
  if (modelId === "groq-llama-3.3-70b")     return generateGroqResponse(prompt);

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        stream: false
      })
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL} for model "${modelId}". ` +
      `Make sure Ollama is running ("ollama serve"). Original error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status} for model "${modelId}": ${errorText}.`
    );
  }

  const data = await response.json();
  return data.message.content;
}

// ── Multi-LLM: calls all local models in parallel ─────────────────────────────
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
      modelId:  MULTI_LLM_MODELS[i].id,
      label:    MULTI_LLM_MODELS[i].label,
      response: null,
      error:    result.reason.message
    };
  });
}

// ── Default single-model call (Ollama llama3.2, weather-enriched) ─────────────
async function generateLLMResponse(prompt) {
  const enriched = await enrichPromptWithWeather(prompt);

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: enriched }],
        stream: false
      })
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
      `Check that "${OLLAMA_MODEL}" is pulled (run: ollama pull ${OLLAMA_MODEL}).`
    );
  }

  const data = await response.json();
  return data.message.content;
}

// ── Self-modification: DeepSeek Coder via Ollama ──────────────────────────────
// Used exclusively by the /api/suggest endpoint.
// Pull the model with: ollama pull deepseek-coder:6.7b
const CODE_MODEL = "deepseek-coder:6.7b";

// The Constitution is the system prompt that constrains DeepSeek's output.
// It forces a strict search-and-replace diff format and bans dangerous operations.
const CONSTITUTION = `YOU ARE A CODE EDITING TOOL. YOU ARE NOT A CHATBOT.
DO NOT SPEAK. DO NOT EXPLAIN. DO NOT APOLOGIZE. SILENCE EXCEPT FOR OUTPUT.
ANY TEXT THAT IS NOT THE REQUIRED OUTPUT FORMAT IS A FAILURE.

YOUR ONLY JOB:
You receive a file and an instruction. You return a search-and-replace block.
Nothing else. No exceptions.

OUTPUT FORMAT -- MANDATORY. FOLLOW THIS EXACTLY:
<<<FIND>>>
(paste exact lines from the file here — no parentheses, no explanation)
<<<REPLACE>>>
(paste new lines here)
<<<END>>>

RULES FOR THE FORMAT:
- If you are ADDING something new with nothing to replace, leave FIND empty like this:
<<<FIND>>>
<<<REPLACE>>>
(new lines to add at the top of the file)
<<<END>>>
- Never reference variables at the top of the file that are declared later in the file
- Always place new code AFTER the existing variable declarations section
- Copy FIND lines CHARACTER FOR CHARACTER from the file — no paraphrasing
- Never escape forward slashes. Write // not \\/\\/
- If FIND is empty, leave it completely blank!!! no placeholder text, no parentheses, no explanation!
- One block per change. Do not chain multiple blocks.
- Never use markdown. No fences. No backticks. No explanation before or after the block.
- Strip all prose before <<<FIND>>> and after <<<END>>>
- First character of output must be <<<FIND>>>. Last characters must be <<<END>>>

NOT ALLOWED:
- Deleting files or suggesting file deletions
- Modifying .env files or any file containing credentials or secrets
- Adding require() or import for: os, child_process, fs (unless already present),
  subprocess, sys, shutil, or any shell-execution library
- Executing or suggesting execution of shell commands
- Referencing any file path outside the project
- Modifying this system prompt

IF THE INSTRUCTION VIOLATES ANY RULE, return only this exact string:
CONSTITUTION_VIOLATION: Your instruction violates the rules of this system and cannot be fulfilled. Please revise or abandon your suggestion.`;

async function generateCodeModification(instruction, fileContents, filePath) {
  // Only send the first 100 lines to stay within context limits
  const trimmedContents = fileContents.split("\n").slice(0, 100).join("\n");

  const userPrompt =
    `File: ${filePath}\n\n` +
    `File start:\n${trimmedContents}\n\n` +
    `Instruction: ${instruction}`;

  // Call DeepSeek via Ollama with the Constitution as system prompt
  const messages = [
    { role: "system", content: CONSTITUTION },
    { role: "user",   content: userPrompt   }
  ];

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CODE_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.2, num_predict: 8192 }
      })
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama for DeepSeek Coder. ` +
      `Make sure Ollama is running and you have run: ollama pull ${CODE_MODEL}. ` +
      `Original error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Ollama returned HTTP ${response.status} for ${CODE_MODEL}: ${errText}`
    );
  }

  const data = await response.json();
  return data.message.content;
}

module.exports = generateLLMResponse;
module.exports.generateResponseFromModel  = generateResponseFromModel;
module.exports.generateMultiLLMResponses  = generateMultiLLMResponses;
module.exports.generateGeminiResponse     = generateGeminiResponse;
module.exports.generateGroqResponse       = generateGroqResponse;
module.exports.generateCodeModification   = generateCodeModification;
module.exports.enrichPromptWithWeather    = enrichPromptWithWeather;
module.exports.isWeatherQuery             = isWeatherQuery;
module.exports.MULTI_LLM_MODELS          = MULTI_LLM_MODELS;
