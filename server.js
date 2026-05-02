// ============================================================
// server.js — Iteration 3
//   NEW: rename conversation, delete all conversations,
//        export conversation, Gemini cloud model support
// ============================================================
const path = require("path");
const fs   = require("fs");
const vm   = require("vm");
const express = require("express");
const session = require("express-session");
const generateLLMResponse = require("./llmService");
const {
  generateMultiLLMResponses,
  generateResponseFromModel,
  generateCodeModification
} = generateLLMResponse;

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "swe-project-secret",
    resave: false,
    saveUninitialized: false
  })
);

// ── In-memory data ────────────────────────────────────────────────────────────
let conversations = [];
let nextId = 1;
let users  = [];
let nextUserId = 1;
let settings = { responseLength: 200 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortenResponse(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

async function generateChatTitle(prompt) {
  try {
    const titlePrompt = `Summarize the following question or topic in 4-7 words as a concise chat title. Use title case. No quotes, no punctuation at the end. Just the title.\n\nQuestion: ${prompt}`;
    const rawTitle = await generateLLMResponse(titlePrompt);
    const cleaned  = rawTitle.replace(/["']/g, "").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
  } catch {
    return prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
  }
}

async function createConversation(prompt, shorten, userId) {
  let response = await generateLLMResponse(prompt);
  if (shorten) response = shortenResponse(response, settings.responseLength);

  const title = await generateChatTitle(prompt);

  const conversation = {
    id: nextId++,
    userId,
    title,
    prompt,
    response,
    messages: [
      { role: "user",      content: prompt   },
      { role: "assistant", content: response }
    ],
    bookmarked:     false,
    multiResponses: null,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString()
  };

  conversations.push(conversation);
  return conversation;
}

async function addMessageToConversation(id, prompt, shorten, userId) {
  const conversation = conversations.find(c => c.id === id && c.userId === userId);
  if (!conversation) return null;

  let response = await generateLLMResponse(prompt);
  if (shorten) response = shortenResponse(response, settings.responseLength);

  conversation.messages.push({ role: "user",      content: prompt   });
  conversation.messages.push({ role: "assistant", content: response });
  conversation.updatedAt = new Date().toISOString();
  conversation.prompt    = prompt;
  conversation.response  = response;

  return conversation;
}

function bookmarkConversation(id, userId) {
  const conv = conversations.find(c => c.id === id && c.userId === userId);
  if (!conv) return null;
  conv.bookmarked = true;
  return conv;
}

function unbookmarkConversation(id, userId) {
  const conv = conversations.find(c => c.id === id && c.userId === userId);
  if (!conv) return null;
  conv.bookmarked = false;
  return conv;
}

function deleteConversationById(id, userId) {
  const index = conversations.findIndex(c => c.id === id && c.userId === userId);
  if (index === -1) return null;
  return conversations.splice(index, 1)[0];
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Page routes ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/app");
  return res.redirect("/landing.html");
});

app.get("/app", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  return res.redirect("/index.html");
});

app.use(express.static(path.join(__dirname, "public")));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: req.session.user });
});

app.post("/api/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields are required." });

  if (users.find(u => u.email === email))
    return res.status(400).json({ error: "Account already exists." });

  const newUser = { id: nextUserId++, username, email, password };
  users.push(newUser);
  req.session.user = { id: newUser.id, username: newUser.username, email: newUser.email };
  res.json({ message: "Account created successfully", user: req.session.user });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid email or password." });

  req.session.user = { id: user.id, username: user.username, email: user.email };
  res.json({ message: "Login successful", user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out successfully" }));
});

// ── Conversation routes ───────────────────────────────────────────────────────
app.get("/api/conversations", requireAuth, (req, res) => {
  res.json(conversations.filter(c => c.userId === req.session.user.id));
});

app.get("/api/conversations/:id", requireAuth, (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  res.json(conv);
});

// NEW: Rename a conversation
app.patch("/api/conversations/:id/rename", requireAuth, (req, res) => {
  const id   = Number(req.params.id);
  const { title } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "Title is required." });

  const conv = conversations.find(c => c.id === id && c.userId === req.session.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  conv.title     = title.trim().slice(0, 80);
  conv.updatedAt = new Date().toISOString();
  res.json({ message: "Conversation renamed", conversation: conv });
});

// NEW: Delete ALL conversations for the logged-in user
app.delete("/api/conversations", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const before = conversations.length;
  conversations = conversations.filter(c => c.userId !== userId);
  const deleted = before - conversations.length;
  res.json({ message: `Deleted ${deleted} conversation(s)` });
});

// NEW: Export a single conversation as plain text (triggers download)
app.get("/api/conversations/:id/export", requireAuth, (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const lines = [`# ${conv.title}`, `Exported: ${new Date().toLocaleString()}`, ""];
  conv.messages.forEach(m => {
    lines.push(m.role === "user" ? "You:" : "PistachioAI:");
    lines.push(m.content);
    lines.push("");
  });

  const filename = conv.title.replace(/[^a-z0-9]/gi, "_").slice(0, 50) + ".txt";
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(lines.join("\n"));
});

// NEW: Gemini cloud model endpoint
app.post("/api/conversations/:id/gemini", requireAuth, async (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  try {
    const { generateGeminiResponse } = require("./llmService");
    const response = await generateGeminiResponse(conv.prompt);
    res.json({ response, label: "Gemini 2.5 Flash" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// NEW: Groq / Llama 3.3 70B cloud model endpoint
app.post("/api/conversations/:id/groq", requireAuth, async (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  try {
    const { generateGroqResponse } = require("./llmService");
    const response = await generateGroqResponse(conv.prompt);
    res.json({ response, label: "Groq — Llama 3.3 70B" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Multi-LLM routes (unchanged logic, updated model list in llmService)
app.get("/api/conversations/:id/multi-response", requireAuth, async (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  if (conv.multiResponses) return res.json({ multiResponses: conv.multiResponses });

  try {
    const multiResponses = await generateMultiLLMResponses(conv.prompt);
    conv.multiResponses  = multiResponses;
    res.json({ multiResponses });
  } catch (err) {
    res.status(502).json({ error: `Multi-LLM service error: ${err.message}` });
  }
});

app.get("/api/conversations/:id/multi-summary", requireAuth, async (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  if (!conv.multiResponses) {
    try { conv.multiResponses = await generateMultiLLMResponses(conv.prompt); }
    catch (err) { return res.status(502).json({ error: `Could not fetch model responses: ${err.message}` }); }
  }

  const available = conv.multiResponses.filter(r => r.response && !r.error);
  if (!available.length) return res.status(502).json({ error: "No model responses available." });

  const synthesisPrompt = `You are a helpful assistant. Below are responses to the question: "${conv.prompt}"\n\n${available.map(r => `--- ${r.label} ---\n${r.response}`).join("\n\n")}\n\nPlease write a concise, unified summary that captures the key points and common themes from all the responses above. Write it as a single cohesive answer, not as a list of summaries per model.`;

  try {
    const summary = await generateResponseFromModel(synthesisPrompt, "llama3.2:latest");
    res.json({ summary });
  } catch (err) {
    res.status(502).json({ error: `Summary generation failed: ${err.message}` });
  }
});

app.get("/api/conversations/:id/multi-compare", requireAuth, async (req, res) => {
  const conv = conversations.find(
    c => c.id === Number(req.params.id) && c.userId === req.session.user.id
  );
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  if (!conv.multiResponses) {
    try { conv.multiResponses = await generateMultiLLMResponses(conv.prompt); }
    catch (err) { return res.status(502).json({ error: `Could not fetch model responses: ${err.message}` }); }
  }

  const available = conv.multiResponses.filter(r => r.response && !r.error);
  if (!available.length) return res.status(502).json({ error: "No model responses available." });

  const comparisonPrompt = `You are a helpful assistant. Below are responses from different AI models to the question: "${conv.prompt}"\n\n${available.map(r => `--- ${r.label} ---\n${r.response}`).join("\n\n")}\n\nPlease provide a structured comparison of these responses. Your comparison should include:\n1. **Similarities**: What key points, facts, or ideas do the models agree on?\n2. **Differences**: Where do the models differ in content, detail level, emphasis, or approach?\n3. **Unique contributions**: What does each model add that the others don't?\n\nBe specific and refer to the models by name (${available.map(r => r.label).join(", ")}).`;

  try {
    const comparison = await generateResponseFromModel(comparisonPrompt, "llama3.2:latest");
    res.json({ comparison });
  } catch (err) {
    res.status(502).json({ error: `Comparison generation failed: ${err.message}` });
  }
});

app.post("/api/conversations", requireAuth, async (req, res) => {
  const { prompt, shorten } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: "Prompt is required." });

  try {
    const conversation = await createConversation(prompt.trim(), shorten, req.session.user.id);
    res.status(201).json(conversation);
  } catch (err) {
    console.error("LLM error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { prompt, shorten } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: "Prompt is required." });

  try {
    const conversation = await addMessageToConversation(id, prompt.trim(), shorten, req.session.user.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    res.json(conversation);
  } catch (err) {
    console.error("LLM error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

app.delete("/api/conversations/:id", requireAuth, (req, res) => {
  const deleted = deleteConversationById(Number(req.params.id), req.session.user.id);
  if (!deleted) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Conversation successfully deleted", deleted });
});

// ── Search ────────────────────────────────────────────────────────────────────
app.get("/api/search", requireAuth, (req, res) => {
  const query = (req.query.q || "").trim().toLowerCase();
  if (!query) return res.status(400).json({ error: "Search query required." });

  const results = conversations.filter(
    c => c.userId === req.session.user.id && (
      c.title.toLowerCase().includes(query) ||
      c.prompt.toLowerCase().includes(query) ||
      c.response.toLowerCase().includes(query)
    )
  );
  res.json(results);
});

// ── Bookmark routes ───────────────────────────────────────────────────────────
app.get("/api/bookmarks", requireAuth, (req, res) => {
  res.json(conversations.filter(c => c.userId === req.session.user.id && c.bookmarked));
});

app.post("/api/bookmarks/:id", requireAuth, (req, res) => {
  const conv = bookmarkConversation(Number(req.params.id), req.session.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Conversation successfully bookmarked", conversation: conv });
});

app.delete("/api/bookmarks/:id", requireAuth, (req, res) => {
  const conv = unbookmarkConversation(Number(req.params.id), req.session.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Bookmark removed successfully", conversation: conv });
});

// ── Settings routes ───────────────────────────────────────────────────────────
app.get("/api/settings", requireAuth, (req, res) => res.json(settings));

app.put("/api/settings/response-length", requireAuth, (req, res) => {
  const { responseLength } = req.body;
  if (!responseLength || Number(responseLength) <= 0)
    return res.status(400).json({ error: "Invalid response length." });

  settings.responseLength = Number(responseLength);
  res.json({ message: "Response length updated", settings });
});

// ── Self-modification system ──────────────────────────────────────────────────
// Ported from Emma's individual iteration.
//
// Safety layers:
//   1. Constitution — system prompt inside generateCodeModification() in llmService.js
//   2. Path scoping — safeWrite() only allows writes inside ALLOWED_DIRS
//   3. File backup  — backupFile() copies the original before any write
//   4. JS validation — validateJS() syntax-checks patched .js files before writing

const PROJECT_ROOT = __dirname;
const ALLOWED_DIRS = ["public"]; // only frontend files are writable
const BACKUP_DIR   = path.join(PROJECT_ROOT, ".llm_backups");

function backupFile(filePath) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp  = new Date().toISOString().replace(/[:.]/g, "-");
  const filename   = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${filename}.${timestamp}.bak`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function safeWrite(filePath, content) {
  const absPath = path.resolve(PROJECT_ROOT, filePath);
  if (!absPath.startsWith(PROJECT_ROOT + path.sep)) {
    throw new Error(`Path escapes project root: ${filePath}`);
  }
  const isAllowed = ALLOWED_DIRS.some(dir =>
    absPath.startsWith(path.resolve(PROJECT_ROOT, dir) + path.sep)
  );
  if (!isAllowed) {
    throw new Error(
      `Write blocked: "${filePath}" is not in an allowed directory. ` +
      `Allowed: ${ALLOWED_DIRS.map(d => d + "/").join(", ")}`
    );
  }
  fs.writeFileSync(absPath, content, "utf8");
  return absPath;
}

function validateJS(code) {
  try {
    new vm.Script(code);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function applyDiff(originalContent, diffOutput) {
  let cleaned = diffOutput
    .replace(/^```[\w]*\n?/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\\\//g, "/");

  if (cleaned.includes("<<<END>>>")) {
    cleaned = cleaned.split("<<<END>>>")[0] + "<<<END>>>";
  }

  if (!cleaned.includes("<<<FIND>>>") && !cleaned.includes("<<<REPLACE>>>")) {
    const lastBrace = cleaned.lastIndexOf("}");
    const codeOnly  = lastBrace !== -1 ? cleaned.slice(0, lastBrace + 1) : cleaned;
    console.log("[suggest] No diff block — treating output as raw code prepend");
    return codeOnly + "\n\n" + originalContent;
  }

  const findMatch    = cleaned.match(/<<<FIND>>>([\s\S]*?)<<<REPLACE>>>/);
  const replaceMatch = cleaned.match(/<<<REPLACE>>>([\s\S]*?)<<<END>>>/);

  if (!findMatch || !replaceMatch) {
    throw new Error(
      "Model did not return a valid diff block. Raw output: " +
      diffOutput.slice(0, 200)
    );
  }

  const findText    = findMatch[1];
  const replaceText = replaceMatch[1];

  const isPlaceholder = findText.trim().startsWith("(") && findText.trim().endsWith(")");
  const isExample     = findText.includes("copy the exact lines") || findText.includes("verbatim");

  if (findText.trim() === "" || isPlaceholder || isExample) {
    return replaceText + originalContent;
  }

  if (!originalContent.includes(findText)) {
    throw new Error(
      "Could not find the target text in the file. " +
      "The model may have hallucinated lines that don't exist."
    );
  }

  return originalContent.replace(findText, replaceText);
}

// POST /api/suggest — main self-modification endpoint
// Body: { filePath: "public/app.js", instruction: "add dark mode toggle" }
app.post("/api/suggest", requireAuth, async (req, res) => {
  const { filePath, instruction } = req.body;

  if (!filePath || !instruction || !instruction.trim()) {
    return res.status(400).json({ error: "filePath and instruction are required." });
  }

  const absPath = path.resolve(PROJECT_ROOT, filePath);
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: `File not found: ${filePath}` });
  }

  const currentContents = fs.readFileSync(absPath, "utf8");

  let modifiedCode;
  try {
    modifiedCode = await generateCodeModification(
      instruction.trim(),
      currentContents,
      filePath
    );
  } catch (err) {
    console.error("DeepSeek error:", err.message);
    return res.status(502).json({ error: `Code model error: ${err.message}` });
  }

  console.log("=== DeepSeek raw output ===\n", modifiedCode, "\n=== end ===");

  if (modifiedCode.trim().startsWith("CONSTITUTION_VIOLATION:")) {
    return res.status(400).json({ error: modifiedCode.trim() });
  }

  let finalContent;
  try {
    finalContent = applyDiff(currentContents, modifiedCode);
  } catch (err) {
    return res.status(422).json({ error: `Diff error: ${err.message}` });
  }

  if (filePath.endsWith(".js")) {
    const validation = validateJS(finalContent);
    if (!validation.valid) {
      return res.status(422).json({
        error: `Result has syntax errors and was not written: ${validation.error}`
      });
    }
  }

  let backupPath;
  try {
    backupPath = backupFile(absPath);
  } catch (err) {
    return res.status(500).json({ error: `Backup failed: ${err.message}` });
  }

  try {
    safeWrite(filePath, finalContent);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  console.log(`[suggest] Modified: ${filePath} | Backup: ${backupPath}`);

  res.json({
    success: true,
    message: `${filePath} updated successfully. Reload the page to see changes.`,
    backedUpTo: path.relative(PROJECT_ROOT, backupPath)
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = {
  app,
  shortenResponse,
  createConversation,
  addMessageToConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById,
  generateMultiLLMResponses
};
