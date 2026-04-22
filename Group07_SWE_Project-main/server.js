
const path = require("path");
const fs   = require("fs");    // needed for the self-modification backup + write system
const express = require("express");

const session = require("express-session");
// llmService now exports two functions:
//   generateLLMResponse: normal chat (llama3.2)
//   generateCodeModification: file editing with Constitution (deepseek-coder)
// they are here so the rest of the file can just call them by name


const { generateLLMResponse, generateCodeModification } =  require("./llmService");

const app = express();
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

// In-memory data 
let conversations = [];
let nextId = 1;

let users = [];
let nextUserId = 1;

let settings = {
  responseLength: 200
};

// Helper functions 
function shortenResponse(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

// Generate a short, descriptive summary title using the LLM
async function generateChatTitle(prompt) {
  try {
    const titlePrompt = `Summarize the following question or topic in 4-7 words as a concise chat title. Use title case. No quotes, no punctuation at the end. Just the title.\n\nQuestion: ${prompt}`;
    const rawTitle = await generateLLMResponse(titlePrompt);
    // Clean up: strip quotes, trim whitespace, limit length
    const cleaned = rawTitle.replace(/["']/g, "").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
  } catch {
    // Fallback to truncated prompt if LLM fails
    return prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
  }
}




async function createConversation(prompt, shorten, userId) {
  let response = await generateLLMResponse(prompt); // CHANGED: await added

  if (shorten) {
    response = shortenResponse(response, settings.responseLength);
  }

  const title = await generateChatTitle(prompt);

  const conversation = {
    id: nextId++,
    userId,
    title,
    prompt,
    response,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: response }
    ],
    bookmarked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  conversations.push(conversation);
  return conversation;
}




async function addMessageToConversation(id, prompt, shorten, userId) {
  const conversation = conversations.find(
    c => c.id === id && c.userId === userId
  );
  if (!conversation) return null;

  let response = await generateLLMResponse(prompt); 
  if (shorten) {
    response = shortenResponse(response, settings.responseLength);
  }

  conversation.messages.push({ role: "user", content: prompt });
  conversation.messages.push({ role: "assistant", content: response });
  conversation.updatedAt = new Date().toISOString();

  // Keep legacy fields updated with the latest exchange
  conversation.prompt = prompt;
  conversation.response = response;

  return conversation;
}

function bookmarkConversation(id, userId) {
  const conversation = conversations.find(
    c => c.id === id && c.userId === userId
  );
  if (!conversation) return null;
  conversation.bookmarked = true;
  return conversation;
}

// Function to remove a bookmark from a conversation
function unbookmarkConversation(id, userId) {
  //find the conversation with the matching id AND userId so users can only modify their own conversations
  const conversation = conversations.find(
    c => c.id === id && c.userId === userId
  );
  if (!conversation) return null;// if no conversation was found, return null so we know the conv failed
  conversation.bookmarked = false; // Set bookmarked to false to remove the bookmark


  return conversation;
}

function deleteConversationById(id, userId) {
  const index = conversations.findIndex(
    c => c.id === id && c.userId === userId
  );
  if (index === -1) return null;
  return conversations.splice(index, 1)[0];
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Page routes

// app.get("/", (req, res) => {
//   if (req.session.user) {
//     return res.redirect("/app");
//   }
//   res.sendFile(path.join(__dirname, "public", "landing.html"));
// });

// app.get("/app", (req, res) => {
//   if (!req.session.user) {
//     return res.redirect("/");
//   }
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

//DEBUG FOR ABOVE
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/app");
  }
  return res.redirect("/landing.html");
});

app.get("/app", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  return res.redirect("/index.html");
});
//------------------------------------
// Static files AFTER custom page routes
app.use(express.static(path.join(__dirname, "public")));

// Auth routes 
app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

app.post("/api/signup", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: "Account already exists." });
  }

  const newUser = {
    id: nextUserId++,
    username,
    email,
    password
  };

  users.push(newUser);

  req.session.user = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email
  };

  res.json({
    message: "Account created successfully",
    user: req.session.user
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email
  };

  res.json({
    message: "Login successful",
    user: req.session.user
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// Conversation routes 
app.get("/api/conversations", requireAuth, (req, res) => {
  const userConversations = conversations.filter(
    c => c.userId === req.session.user.id
  );
  res.json(userConversations);
});

app.get("/api/conversations/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const conversation = conversations.find(
    c => c.id === id && c.userId === req.session.user.id
  );

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json(conversation);
});

app.post("/api/conversations", requireAuth, async (req, res) => {
  const { prompt, shorten } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const conversation = await createConversation( 
      prompt.trim(),
      shorten,
      req.session.user.id
    );
    res.status(201).json(conversation);
  } catch (err) {
    console.error("Ollama error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { prompt, shorten } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

 try {
    const conversation = await addMessageToConversation( 
      id,
      prompt.trim(),
      shorten,
      req.session.user.id
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    res.json(conversation);
  } catch (err) {
    console.error("Ollama error:", err.message);
    res.status(502).json({ error: `LLM service error: ${err.message}` });
  }
});

app.delete("/api/conversations/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const deleted = deleteConversationById(id, req.session.user.id);

  if (!deleted) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json({
    message: "Conversation successfully deleted",
    deleted
  });
});



app.get("/api/search", requireAuth, (req, res) => { //api route that searches conversations by keyword
  const query = (req.query.q || "").trim().toLowerCase();
  if (!query) { //if no query, return an error
    return res.status(400).json({ error: "Search query required." });
  }
  // Filter conversations that belong to the logged-in uservAND contain the search query in title, prompt, or response
  const results = conversations.filter(
    c =>
      c.userId === req.session.user.id &&
      (
        c.title.toLowerCase().includes(query) ||// chheck if the convos title contains the query
        c.prompt.toLowerCase().includes(query) ||// Check if the prompt contains the query
        c.response.toLowerCase().includes(query)// Check if the response contains the query
      )
  );
  res.json(results); // return filtered convos as json
});




// Bookmark routes 
app.get("/api/bookmarks", requireAuth, (req, res) => {
  const bookmarked = conversations.filter(
    c => c.userId === req.session.user.id && c.bookmarked
  );
  res.json(bookmarked);
});

app.post("/api/bookmarks/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const conversation = bookmarkConversation(id, req.session.user.id);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json({
    message: "Conversation successfully bookmarked",
    conversation
  });
});


app.delete("/api/bookmarks/:id", requireAuth, (req, res) => {// api route to remove a bookmark from a conversation
  const id = Number(req.params.id);//id from the URL into a number
  const conversation = unbookmarkConversation(id, req.session.user.id);// Call the helper function to remove the bookmark
  if (!conversation) {//if conmvo was not found, return a 404 error
    return res.status(404).json({ error: "Conversation not found." });
  }

  res.json({
    message: "Bookmark removed successfully",
    conversation
  });
});






// Settings routes 
app.get("/api/settings", requireAuth, (req, res) => {
  res.json(settings);
});

app.put("/api/settings/response-length", requireAuth, (req, res) => {
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













// Start server 
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
  bookmarkConversation,
  unbookmarkConversation,
  deleteConversationById
};