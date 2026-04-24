// ============================================================
// server.js — UPDATED: Added multi-LLM parallel query support.
//
// NEW ENDPOINTS:
//   POST /api/conversations/multi
//     Sends the prompt to all 3 LLMs simultaneously.
//     Returns { conversationId, llmResults: { llama3.2: {…}, … } }
//
//   POST /api/conversations/:id/messages/multi
//     Continues an existing conversation across all 3 LLMs simultaneously.
//
// ============================================================
const path    = require("path");
const express = require("express");
const session = require("express-session");

const {
  generateLLMResponse,
  generateAllLLMResponses,
  LLM_REGISTRY
} = require("./llmService");

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
let nextId        = 1;
let users         = [];
let nextUserId    = 1;
let settings      = { responseLength: 200 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortenResponse(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

async function generateChatTitle(prompt) {
  try {
    const titlePrompt =
      `Summarize the following question or topic in 4-7 words as a concise chat title. ` +
      `Use title case. No quotes, no punctuation at the end. Just the title.\n\nQuestion: ${prompt}`;
    const rawTitle = await generateLLMResponse(titlePrompt);
    const cleaned  = rawTitle.replace(/['"]/g, "").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
  } catch {
    return prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
  }
}

// ── Single-LLM conversation helpers (unchanged behaviour) ─────────────────────
async function createConversation(prompt, shorten, userId) {
  let response = await generateLLMResponse(prompt);
  if (shorten) response = shortenResponse(response, settings.responseLength);

  const title = await generateChatTitle(prompt);

  const conversation = {
    id:         nextId++,
    userId,
    title,
    prompt,
    response,
    messages: [
      { role: "user",      content: prompt   },
      { role: "assistant", content: response }
    ],
    // Multi-LLM results stored here when using the multi endpoints
    llmResults: null,
    bookmarked: false,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString()
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
  // Clear stale multi-LLM results when a new message is added
  conversation.llmResults = null;

  return conversation;
}

// ── Multi-LLM conversation helpers ────────────────────────────────────────────
async function createMultiConversation(prompt, shorten, userId) {
  // Fire all 3 LLMs at the same time
  const [llmResults, title] = await Promise.all([
    generateAllLLMResponses(prompt),
    generateChatTitle(prompt)
  ]);

  // Apply shorten to each successful response if requested
  if (shorten) {
    Object.values(llmResults).forEach(r => {
      if (r.status === "fulfilled") {
        r.response = shortenResponse(r.response, settings.responseLength);
      }
    });
  }

  // Use Llama 3.2's response as the "primary" response for legacy fields,
  // falling back to whichever model succeeded first.
  const primary =
    (llmResults["llama3.2"]?.status === "fulfilled" && llmResults["llama3.2"].response) ||
    Object.values(llmResults).find(r => r.status === "fulfilled")?.response ||
    "No response available.";

  const conversation = {
    id:         nextId++,
    userId,
    title,
    prompt,
    response:   primary,
    messages: [
      { role: "user",      content: prompt  },
      { role: "assistant", content: primary }
    ],
    llmResults,   // ← full per-model results stored here
    bookmarked: false,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString()
  };

  conversations.push(conversation);
  return conversation;
}

async function addMultiMessageToConversation(id, prompt, shorten, userId) {
  const conversation = conversations.find(c => c.id === id && c.userId === userId);
  if (!conversation) return null;

  const llmResults = await generateAllLLMResponses(prompt);

  if (shorten) {
    Object.values(llmResults).forEach(r => {
      if (r.status === "fulfilled") {
        r.response = shortenResponse(r.response, settings.responseLength);
      }
    });
  }

  const primary =
    (llmResults["llama3.2"]?.status === "fulfilled" && llmResults["llama3.2"].response) ||
    Object.values(llmResults).find(r => r.status === "fulfilled")?.response ||
    "No response available.";

  conversation.messages.push({ role: "user",      content: prompt  });
  conversation.messages.push({ role: "assistant", content: primary });
  conversation.llmResults = llmResults;
  conversation.updatedAt  = new Date().toISOString();
  conversation.prompt     = prompt;
  conversation.response   = primary;

  return conversation;
}

// ── Other helpers ─────────────────────────────────────────────────────────────
function bookmarkConversation(id, userId) {
  const c = conversations.find(c => c.id === id && c.userId === userId);
  if (!c) return null;
  c.bookmarked = true;
  return c;
}

function unbookmarkConversation(id, userId) {
  const c = conversations.find(c => c.id === id && c.userId === userId);
  if (!c) return null;
  c.bookmarked = false;
  return c;
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

// ── LLM registry endpoint ─────────────────────────────────────────────────────
// Frontend fetches this to build the dropdown.
app.get("/api/llms", (req, res) => {
  res.json(LLM_REGISTRY);
});

// ── Conversation routes (single-LLM, unchanged) ───────────────────────────────
app.get("/api/conversations", requireAuth, (req, res) => {
  res.json(conversations.filter(c => c.userId === req.session.user.id));
});

app.get("/api/conversations/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c  = conversations.find(c => c.id === id && c.userId === req.session.user.id);
  if (!c) return res.status(404).json({ error: "Conversation not found." });
  res.json(c);
});

// ── IMPORTANT: /multi must be declared BEFORE /:id routes so Express does not
//   treat the literal string "multi" as an :id parameter.

// Start a new conversation — queries all 3 LLMs simultaneously.
app.post("/api/conversations/multi", requireAuth, async (req, res) => {
  const { prompt, shorten } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required." });
  try {
    const conversation = await createMultiConversation(prompt.trim(), shorten, req.session.user.id);
    res.status(201).json(conversation);
  } catch (err) {
    console.error("Multi-LLM error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

// Start a new conversation — single LLM (legacy, kept for compatibility).
app.post("/api/conversations", requireAuth, async (req, res) => {
  const { prompt, shorten } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required." });
  try {
    const conversation = await createConversation(prompt.trim(), shorten, req.session.user.id);
    res.status(201).json(conversation);
  } catch (err) {
    console.error("Ollama error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

// Continue an existing conversation — all 3 LLMs simultaneously.
// IMPORTANT: must be before /:id/messages so "multi" isn't swallowed as :id.
app.post("/api/conversations/:id/messages/multi", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { prompt, shorten } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required." });
  try {
    const conversation = await addMultiMessageToConversation(id, prompt.trim(), shorten, req.session.user.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    res.json(conversation);
  } catch (err) {
    console.error("Multi-LLM error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

// Continue an existing conversation — single LLM (legacy).
app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { prompt, shorten } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required." });
  try {
    const conversation = await addMessageToConversation(id, prompt.trim(), shorten, req.session.user.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    res.json(conversation);
  } catch (err) {
    console.error("Ollama error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

// ── Bookmark routes ───────────────────────────────────────────────────────────
app.get("/api/bookmarks", requireAuth, (req, res) => {
  res.json(conversations.filter(c => c.userId === req.session.user.id && c.bookmarked));
});

app.post("/api/bookmarks/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c  = bookmarkConversation(id, req.session.user.id);
  if (!c) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Conversation successfully bookmarked", conversation: c });
});

app.delete("/api/bookmarks/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c  = unbookmarkConversation(id, req.session.user.id);
  if (!c) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Bookmark removed successfully", conversation: c });
});

// ── Search ────────────────────────────────────────────────────────────────────
app.get("/api/search", requireAuth, (req, res) => {
  const query = (req.query.q || "").trim().toLowerCase();
  if (!query) return res.status(400).json({ error: "Search query required." });
  const results = conversations.filter(
    c =>
      c.userId === req.session.user.id &&
      (c.title.toLowerCase().includes(query) ||
       c.prompt.toLowerCase().includes(query) ||
       c.response.toLowerCase().includes(query))
  );
  res.json(results);
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

app.delete("/api/conversations/:id", requireAuth, (req, res) => {
  const id      = Number(req.params.id);
  const deleted = deleteConversationById(id, req.session.user.id);
  if (!deleted) return res.status(404).json({ error: "Conversation not found." });
  res.json({ message: "Conversation successfully deleted", deleted });
});

// ── Start server ──────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  shortenResponse,
  createConversation,
  addMessageToConversation,
  createMultiConversation,
  addMultiMessageToConversation,
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
};
