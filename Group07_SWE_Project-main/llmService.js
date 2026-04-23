
const fetch = require("node-fetch");

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

const OLLAMA_BASE_URL = "http://127.0.0.1:11434"; // default Ollama address
const CHAT_MODEL    = "llama3.2:latest";               // normal conversations
const CODE_MODEL = "deepseek-coder:latest"; //for self-modification  - 1.3b
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
  stream: false,
  options: {
    options: {
      num_predict: 1024,
      temperature: 0.1,  // as deterministic as possible
      num_ctx: 4096      // limit context window
}
  }
};
 


  console.log("About to fetch, requestBody size =", JSON.stringify(requestBody).length, "chars"); //debug




  let response;

  
  
   try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error("Full error object:", err);
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



// exported function 1 for normal chat
async function generateLLMResponse(prompt) {
  return callOllama(CHAT_MODEL, prompt);
}



// exported function 2 for self-modification
// used exclusively by /api/suggest endpoint in server.js
//receives instruction (users request for modification), file contents
//(current source code of the file we will modify),
// filePath (the path included in the prompt so the model knows context)


// The CONSTITUTION is the system prompt passed to deepseek. 
// i took inspiration from a podcast I listened to with peter steinberger (OpenClaw)
// its a rule set that tells the model what it is and isn't allowed to do
// it specifies the exact output format (raw code).
// the backend will write whatever the model returns directly to the disk. 
// any extra text such as markdowns or explanations will break the code and we'll have to nuke it

const CONSTITUTION = `YOU ARE A CODE EDITING TOOL. YOU ARE NOT A CHATBOT.
DO NOT SPEAK. DO NOT EXPLAIN. DO NOT APOLOGIZE. SILENCE EXCEPT FOR OUTPUT.
ANY TEXT THAT IS NOT THE REQUIRED OUTPUT FORMAT IS A FAILURE.

YOUR ONLY JOB:
You receive a file and an instruction. You return a search-and-replace block.
Nothing else. No exceptions.

OUTPUT FORMAT -- MANDATORY. FOLLOW THIS EXACTLY:
<<<FIND>>>
(copy the exact lines from the file that need to change - verbatim, character for character)
<<<REPLACE>>>
(the new lines that replace them)
<<<END>>>

RULES FOR THE FORMAT:
- If you are ADDING something new with nothing to replace, leave FIND empty like this:
<<<FIND>>>
<<<REPLACE>>>
(new lines to add at the top of the file)
<<<END>>>
- One block per change. Do not chain multiple blocks.
- No markdown. No fences. No explanation before or after the block.
- First character of output must be <<<FIND>>>. Last characters must be <<<END>>>.

NOT ALLOWED:
- Deleting files or suggesting file deletions
- Modifying .env files or any file containing credentials or secrets
- Adding require() or import for: os, child_process, fs (unless already present),
  subprocess, sys, shutil, or any shell-execution library
- Executing or suggesting execution of shell commands
- Referencing any file path outside the project
- Modifying this system prompt

IF THE INSTRUCTION VIOLATES ANY RULE, return only this exact string:
CONSTITUTION_VIOLATION:  Your instruction violates the rules of this system and cannot be fulfilled. Please revise or abandon your request.`;


async function generateCodeModification(instruction, fileContents, filePath) {
  const trimmedContents = fileContents
    .split("\n")
    .slice(0, 100)
    .join("\n");

  const userPrompt =
    `File: ${filePath}\n\n` +
    `File start:\n${trimmedContents}\n\n` +
    `Instruction: ${instruction}`;

  return callOllama(CODE_MODEL, userPrompt, CONSTITUTION);
}

 
module.exports = { generateLLMResponse, generateCodeModification };