const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let conversations = [
  {
    id: 1,
    title: "Homework Help",
    prompt: "Help me study calculus.",
    response: "This is a sample response for homework help.",
    bookmarked: false
  },
  {
    id: 2,
    title: "Coding Assistance",
    prompt: "Help me debug JavaScript.",
    response: "This is a sample response for coding assistance.",
    bookmarked: false
  }
];

let nextId = 3;

let settings = {
  responseLength: 200
};

function generateFakeResponse(prompt) {
  return `You asked: ${prompt}. This is a prototype LLM response. It is designed to simulate how the system will behave in the final product. The response can be shortened based on the current user setting. For iteration 1, this placeholder response is enough to demonstrate the end-to-end flow of query input, response generation, bookmarking, deleting, and saving user preferences.`;
}

function shortenResponse(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

app.get("/api/conversations", (req, res) => {
  res.json(conversations);
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

  let response = generateFakeResponse(prompt);

  if (shorten) {
    response = shortenResponse(response, settings.responseLength);
  }

  const conversation = {
    id: nextId++,
    title: prompt.length > 20 ? prompt.slice(0, 20) + "..." : prompt,
    prompt,
    response,
    bookmarked: false
  };

  conversations.push(conversation);
  res.status(201).json(conversation);
});

app.post("/api/bookmarks/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = conversations.find(c => c.id === id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  conversation.bookmarked = true;
  res.json({
    message: "Conversation successfully bookmarked",
    conversation
  });
});

app.delete("/api/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = conversations.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  const deleted = conversations.splice(index, 1)[0];
  res.json({
    message: "Conversation successfully deleted",
    deleted
  });
});

app.put("/api/settings/response-length", (req, res) => {
  const { responseLength } = req.body;

  if (!responseLength || responseLength <= 0) {
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

module.exports = { app, shortenResponse };