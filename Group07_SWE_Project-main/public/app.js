// ─── DOM refs ────────────────────────────────────────────────────────────────
const chatList         = document.getElementById("chatList");
const bookmarkList     = document.getElementById("bookmarkList");
const responseSection  = document.getElementById("responseSection");
const threadSection    = document.getElementById("threadSection");
const threadTitle      = document.getElementById("threadTitle");
const threadMessages   = document.getElementById("threadMessages");
const threadBookmarkBtn   = document.getElementById("threadBookmarkBtn");
const threadUnbookmarkBtn = document.getElementById("threadUnbookmarkBtn");
const threadDeleteBtn  = document.getElementById("threadDeleteBtn");
const promptInput      = document.getElementById("promptInput");
const searchInput      = document.getElementById("searchInput");
const searchBtn        = document.getElementById("searchBtn");
const clearSearchBtn   = document.getElementById("clearSearchBtn");
const sendBtn          = document.getElementById("sendBtn");
const shortenToggle    = document.getElementById("shortenToggle");
const wordLimit        = document.getElementById("wordLimit");
const saveSettingsBtn  = document.getElementById("saveSettingsBtn");
const logoutBtn        = document.getElementById("logoutBtn");
const userInfo         = document.getElementById("userInfo");
const newChatBtn       = document.getElementById("newChatBtn");
const mainHeading      = document.getElementById("mainHeading");

// ─── State ───────────────────────────────────────────────────────────────────
let activeConversationId = null; // UC3: track which conversation is open

// ─── Auth ────────────────────────────────────────────────────────────────────
async function checkAuth() {
  const res  = await fetch("/api/me");
  const data = await res.json();
  if (!data.loggedIn) { window.location.href = "/"; return; }
  if (userInfo) userInfo.textContent = `Logged in as ${data.user.username}`;
}

// ─── Sidebar: load conversations (UC2) ───────────────────────────────────────
async function loadConversations() {
  const res           = await fetch("/api/conversations");
  const conversations = await res.json();

  chatList.innerHTML = "";

  // Most-recent first
  conversations
    .slice()
    .reverse()
    .forEach(conv => {
      const li = document.createElement("li");
      li.className = activeConversationId === conv.id ? "active-chat" : "";
      li.innerHTML = `
        <span class="chat-title" onclick="openConversation(${conv.id})">${conv.title}</span>
        <div class="chat-item-actions">
          <button class="icon-btn" onclick="openConversation(${conv.id})" title="Open">↗</button>
          <button class="icon-btn danger" onclick="deleteConversation(${conv.id})" title="Delete">✕</button>
        </div>
      `;
      chatList.appendChild(li);
    });
}

async function loadBookmarks() {
  const res       = await fetch("/api/bookmarks");
  const bookmarks = await res.json();

  bookmarkList.innerHTML = "";

  bookmarks
    .slice()
    .reverse()
    .forEach(conv => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="chat-title" onclick="openConversation(${conv.id})">${conv.title}</span>
        <div class="chat-item-actions">
          <button class="icon-btn" onclick="openConversation(${conv.id})" title="Open">↗</button>
        </div>
      `;
      bookmarkList.appendChild(li);
    });
}

// ─── Settings ────────────────────────────────────────────────────────────────
async function saveSettings() {
  const responseLength = Number(wordLimit.value);
  const res  = await fetch("/api/settings/response-length", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responseLength })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not save settings"); return; }
  alert("Response length updated");
}

// ─── UC1: Send prompt → auto-save conversation ───────────────────────────────
async function sendPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  // UC3: if a conversation is active, continue it instead of creating new
  if (activeConversationId !== null) {
    await continueConversation(prompt);
    return;
  }

  // New conversation
  const res  = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, shorten: shortenToggle.checked })
  });
  const data = await res.json();

  if (!res.ok) { alert(data.error || "Could not create conversation"); return; }

  promptInput.value = "";
  activeConversationId = data.id;

  await loadConversations();
  await loadBookmarks();
  renderThread(data);
}

// ─── UC3: Continue an existing conversation ───────────────────────────────────
async function continueConversation(prompt) {
  const res  = await fetch(`/api/conversations/${activeConversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, shorten: shortenToggle.checked })
  });
  const data = await res.json();

  if (!res.ok) { alert(data.error || "Could not send message"); return; }

  promptInput.value = "";
  renderThread(data);
  await loadConversations();
}

// ─── UC2: Render a full conversation thread ───────────────────────────────────
function renderThread(conversation) {
  // Hide search/response area; show thread
  responseSection.innerHTML = "";
  threadSection.style.display = "block";

  activeConversationId = conversation.id;
  threadTitle.textContent = conversation.title;

  // Attach thread-level action buttons
  threadBookmarkBtn.onclick   = () => bookmarkConversation(conversation.id);
  threadUnbookmarkBtn.onclick = () => unbookmarkConversation(conversation.id);
  threadDeleteBtn.onclick     = () => deleteConversation(conversation.id);

  // Build message bubbles from messages array (with legacy fallback)
  threadMessages.innerHTML = "";

  const messages = conversation.messages
    || [
        { role: "user",      content: conversation.prompt   },
        { role: "assistant", content: conversation.response  }
       ];

  messages.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${msg.role === "user" ? "user-bubble" : "assistant-bubble"}`;
    bubble.innerHTML = `
      <span class="bubble-label">${msg.role === "user" ? "You" : "Assistant"}</span>
      <p>${msg.content}</p>
    `;
    threadMessages.appendChild(bubble);
  });

  // Scroll to bottom so latest message is visible
  threadMessages.scrollTop = threadMessages.scrollHeight;

  // Update heading to show continuation hint
  mainHeading.textContent = "Continue the conversation…";

  // Highlight active item in sidebar
  loadConversations();
}

// ─── UC2: Open a previous conversation ───────────────────────────────────────
async function openConversation(id) {
  const res  = await fetch(`/api/conversations/${id}`);
  const data = await res.json();

  if (!res.ok) { alert(data.error || "Conversation not found"); return; }

  renderThread(data);
}

// ─── Bookmark helpers ─────────────────────────────────────────────────────────
async function bookmarkConversation(id) {
  const res  = await fetch(`/api/bookmarks/${id}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not bookmark conversation"); return; }
  alert("Conversation successfully bookmarked");
  await loadBookmarks();
}

async function unbookmarkConversation(id) {
  const res  = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not remove bookmark"); return; }
  alert("Bookmark removed successfully");
  await loadBookmarks();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteConversation(id) {
  if (!confirm("Are you sure you want to delete this conversation?")) return;

  const res  = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!res.ok) { alert(data.error || "Could not delete conversation"); return; }

  // If we just deleted the active conversation, reset view
  if (activeConversationId === id) {
    activeConversationId = null;
    threadSection.style.display = "none";
    threadMessages.innerHTML = "";
    mainHeading.textContent = "How can I help you?";
  }

  await loadConversations();
  await loadBookmarks();
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function searchConversations() {
  const query = searchInput.value.trim();
  if (!query) { alert("Please enter a search term"); return; }

  const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  if (!res.ok) { alert(data.error || "Search failed"); return; }

  // Exit thread view, show search results
  threadSection.style.display = "none";
  activeConversationId = null;
  mainHeading.textContent = `Search results for "${query}"`;

  responseSection.innerHTML = "";

  if (data.length === 0) {
    responseSection.innerHTML = "<p>No matching conversations found.</p>";
    return;
  }

  data
    .slice()
    .reverse()
    .forEach(conv => {
      const card = document.createElement("div");
      card.className = "responseCard";
      card.innerHTML = `
        <h3>${conv.title}</h3>
        <p><strong>Prompt:</strong> ${conv.prompt}</p>
        <p><strong>Response:</strong> ${conv.response}</p>
        <div class="responseActions">
          <button onclick="openConversation(${conv.id})">Open Full Chat</button>
        </div>
      `;
      responseSection.appendChild(card);
    });
}

// ─── New chat button: reset to blank state ────────────────────────────────────
newChatBtn.addEventListener("click", () => {
  activeConversationId = null;
  threadSection.style.display = "none";
  threadMessages.innerHTML = "";
  responseSection.innerHTML = "";
  promptInput.value = "";
  mainHeading.textContent = "How can I help you?";
  loadConversations();
});

// ─── Event listeners ──────────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendPrompt);

promptInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendPrompt();
});

saveSettingsBtn.addEventListener("click", saveSettings);

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  });
}

if (searchBtn)      searchBtn.addEventListener("click", searchConversations);
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", async () => {
    searchInput.value = "";
    responseSection.innerHTML = "";
    mainHeading.textContent = "How can I help you?";
    await loadConversations();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
loadConversations();
loadBookmarks();
