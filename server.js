const express = require("express");
const path = require("path");
const generateLLMResponse = require("./llmService");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let conversations = [];
let nextId = 1;

let settings = {
  responseLength: 200
};

function shortenResponse(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

function createConversation(prompt, shorten) {
  let response = generateLLMResponse(prompt);

  if (shorten) {
    response = shortenResponse(response, settings.responseLength);
  }

  const conversation = {
    id: nextId++,
    title: prompt.length > 20 ? prompt.slice(0, 20) + "..." : prompt,
    prompt,
    response,
    bookmarked: false,
    createdAt: new Date().toISOString()
  };

  conversations.push(conversation);
  return conversation;
}

function bookmarkConversation(id) {
  const conversation = conversations.find(c => c.id === id);
  if (!conversation) return null;
  conversation.bookmarked = true;
  return conversation;
}

function deleteConversationById(id) {
  const index = conversations.findIndex(c => c.id === id);
  if (index === -1) return null;
  return conversations.splice(index, 1)[0];
}

app.get("/api/conversations", (req, res) => {
  res.json(conversations);
});

app.get("/api/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = conversations.find(c => c.id === id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json(conversation);
});

app.get("/api/bookmarks", (req, res) => {
  const bookmarked = conversations.filter(c => c.bookmarked);
  res.json(bookmarked);
});

app.post("/api/conversations", (req, res) => {
  const { prompt, shorten } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const conversation = createConversation(prompt.trim(), shorten);
  res.status(201).json(conversation);
});

app.post("/api/bookmarks/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = bookmarkConversation(id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json({
    message: "Conversation successfully bookmarked",
    conversation
  });
});

app.delete("/api/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  const deleted = deleteConversationById(id);

  if (!deleted) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json({
    message: "Conversation successfully deleted",
    deleted
  });
});

app.put("/api/settings/response-length", (req, res) => {
  const { responseLength } = req.body;

  if (!responseLength || Number(responseLength) <= 0) {
    return res.status(400).json({ error: "Invalid response length." });
  }

  settings.responseLength = Number(responseLength);

  res.json({
    message: "Response length updated",
    settings
  });
});

app.get("/api/settings", (req, res) => {
  res.json(settings);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  shortenResponse,
  createConversation,
  bookmarkConversation,
  deleteConversationById
};