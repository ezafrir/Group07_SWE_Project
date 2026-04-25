// ─── DOM refs ────────────────────────────────────────────────────────────────
const chatList            = document.getElementById("chatList");
const bookmarkList        = document.getElementById("bookmarkList");
const responseSection     = document.getElementById("responseSection");
const threadSection       = document.getElementById("threadSection");
const threadTitle         = document.getElementById("threadTitle");
const threadMessages      = document.getElementById("threadMessages");
const threadBookmarkBtn   = document.getElementById("threadBookmarkBtn");
const threadUnbookmarkBtn = document.getElementById("threadUnbookmarkBtn");
const threadSummarizeBtn  = document.getElementById("threadSummarizeBtn");
const threadDeleteBtn     = document.getElementById("threadDeleteBtn");
const promptInput         = document.getElementById("promptInput");
const sendBtn             = document.getElementById("sendBtn");
const shortenToggle       = document.getElementById("shortenToggle");
const wordLimit           = document.getElementById("wordLimit");
const saveSettingsBtn     = document.getElementById("saveSettingsBtn");
const logoutBtn           = document.getElementById("logoutBtn");
const userInfo            = document.getElementById("userInfo");
const newChatBtn          = document.getElementById("newChatBtn");
const mainHeading         = document.getElementById("mainHeading");

// Search modal refs (Change #4)
const openSearchBtn    = document.getElementById("openSearchBtn");
const searchOverlay    = document.getElementById("searchOverlay");
const closeSearchBtn   = document.getElementById("closeSearchBtn");
const searchInput      = document.getElementById("searchInput");
const searchBtn        = document.getElementById("searchBtn");
const clearSearchBtn   = document.getElementById("clearSearchBtn");
const searchResults    = document.getElementById("searchResults");

// ─── State ───────────────────────────────────────────────────────────────────
let activeConversationId = null;

// ─── Auth ────────────────────────────────────────────────────────────────────
async function checkAuth() {
  const res  = await fetch("/api/me");
  const data = await res.json();
  if (!data.loggedIn) { window.location.href = "/"; return; }
  if (userInfo) userInfo.textContent = `Logged in as ${data.user.username}`;
}

// ─── Sidebar: load conversations ─────────────────────────────────────────────
async function loadConversations() {
  const res           = await fetch("/api/conversations");
  const conversations = await res.json();
  chatList.innerHTML  = "";
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

// ─── Loading state ───────────────────────────────────────────────────────────
let isSending = false;

// Show the user's own message immediately in the thread (Change #5)
function showUserBubble(prompt) {
  // Ensure thread section is visible
  threadSection.style.display = "block";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble user-bubble";
  bubble.dataset.pending = "true";
  bubble.innerHTML = `
    <span class="bubble-label">You</span>
    <p>${escapeHtml(prompt)}</p>
  `;
  threadMessages.appendChild(bubble);
  scrollToBottom();
}

function showLoadingBubble() {
  threadSection.style.display = "block";
  const bubble = document.createElement("div");
  bubble.className = "loading-bubble";
  bubble.id = "loadingBubble";
  bubble.innerHTML = `
    <span>Generating Response. Thinking</span>
    <div class="dots"><span></span><span></span><span></span></div>
  `;
  threadMessages.appendChild(bubble);
  scrollToBottom();
}

function hideLoadingBubble() {
  const bubble = document.getElementById("loadingBubble");
  if (bubble) bubble.remove();
}

function scrollToBottom() {
  threadMessages.scrollTop = threadMessages.scrollHeight;
  const scrollArea = document.querySelector(".chat-scroll-area");
  if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
}

// Simple HTML escape to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── UC1: Send prompt → auto-save conversation ───────────────────────────────
async function sendPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  if (isSending) return;

  isSending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending…";
  promptInput.value = "";

  // Change #5: Show user's message first, then thinking bubble
  showUserBubble(prompt);
  showLoadingBubble();

  try {
    if (activeConversationId !== null) {
      await continueConversation(prompt);
      return;
    }

    const res  = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, shorten: shortenToggle.checked })
    });
    const data = await res.json();

    if (!res.ok) { alert(data.error || "Could not create conversation"); return; }

    activeConversationId = data.id;

    hideLoadingBubble();
    await loadConversations();
    await loadBookmarks();
    renderThread(data);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
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
  hideLoadingBubble();
  renderThread(data);
  await loadConversations();
}

// ─── UC2: Render a full conversation thread ───────────────────────────────────
function renderThread(conversation) {
  responseSection.innerHTML = "";
  threadSection.style.display = "block";

  activeConversationId = conversation.id;
  threadTitle.textContent = conversation.title;

  threadBookmarkBtn.onclick   = () => bookmarkConversation(conversation.id);
  threadUnbookmarkBtn.onclick = () => unbookmarkConversation(conversation.id);
  threadSummarizeBtn.onclick  = () => requestSummary(conversation.id);
  threadDeleteBtn.onclick     = () => deleteConversation(conversation.id);

  threadMessages.innerHTML = "";

  const messages = conversation.messages
    || [
        { role: "user",      content: conversation.prompt   },
        { role: "assistant", content: conversation.response  }
       ];

  messages.forEach(msg => {
    if (msg.role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "message-bubble user-bubble";
      bubble.innerHTML = `
        <span class="bubble-label">You</span>
        <p>${escapeHtml(msg.content)}</p>
      `;
      threadMessages.appendChild(bubble);
    } else if (msg.role === "assistant") {
      if (msg.responses) {
        // Multi-LLM response group
        const group = document.createElement("div");
        group.className = "multi-response-group";
        msg.responses.forEach((r, i) => {
          const bubble = document.createElement("div");
          bubble.className = "message-bubble assistant-bubble";
          bubble.innerHTML = `
            <span class="bubble-label">
              <span class="llm-badge llm-badge-${i + 1}">${escapeHtml(r.model)}</span>
            </span>
            <p>${escapeHtml(r.content)}</p>
          `;
          group.appendChild(bubble);
        });
        threadMessages.appendChild(group);
      } else {
        // Legacy single-response fallback
        const bubble = document.createElement("div");
        bubble.className = "message-bubble assistant-bubble";
        bubble.innerHTML = `
          <span class="bubble-label">PistachioAI</span>
          <p>${escapeHtml(msg.content)}</p>
        `;
        threadMessages.appendChild(bubble);
      }
    }
  });

  scrollToBottom();

  // Change #6: "Continue your conversation…"
  mainHeading.textContent = "Continue your conversation…";

  loadConversations();
}

// ─── Summary: synthesize the 3 LLM responses ─────────────────────────────────
async function requestSummary(id) {
  // Remove any existing summary so re-clicks refresh it
  const existing = document.getElementById("summarySection");
  if (existing) existing.remove();

  const placeholder = document.createElement("div");
  placeholder.id = "summarySection";
  placeholder.className = "summary-section";
  placeholder.innerHTML = `
    <div class="summary-header">Summary</div>
    <p class="summary-loading">Generating summary<span class="dots"><span></span><span></span><span></span></span></p>
  `;
  threadMessages.appendChild(placeholder);
  scrollToBottom();

  try {
    const res  = await fetch(`/api/conversations/${id}/summary`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      placeholder.innerHTML = `
        <div class="summary-header">Summary</div>
        <p class="summary-error">${escapeHtml(data.error || "Could not generate summary.")}</p>
      `;
      return;
    }

    placeholder.innerHTML = `
      <div class="summary-header">Summary</div>
      <p>${escapeHtml(data.summary)}</p>
    `;
  } catch {
    placeholder.innerHTML = `
      <div class="summary-header">Summary</div>
      <p class="summary-error">Network error — could not reach the server.</p>
    `;
  }

  scrollToBottom();
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
  if (activeConversationId === id) {
    activeConversationId = null;
    threadSection.style.display = "none";
    threadMessages.innerHTML = "";
    mainHeading.textContent = "How can I help you?";
  }
  await loadConversations();
  await loadBookmarks();
}

// ─── Search (modal-based, Change #4) ─────────────────────────────────────────
async function searchConversations() {
  const query = searchInput.value.trim();
  if (!query) { alert("Please enter a search term"); return; }

  const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Search failed"); return; }

  searchResults.innerHTML = "";

  if (data.length === 0) {
    searchResults.innerHTML = `<p style="color:var(--text-secondary);font-size:14px;">No matching conversations found.</p>`;
    return;
  }

  data
    .slice()
    .reverse()
    .forEach(conv => {
      const card = document.createElement("div");
      card.className = "search-result-card";
      card.innerHTML = `
        <h4>${escapeHtml(conv.title)}</h4>
        <p>${escapeHtml(conv.prompt.length > 80 ? conv.prompt.slice(0, 80) + "…" : conv.prompt)}</p>
      `;
      card.addEventListener("click", () => {
        closeSearch();
        openConversation(conv.id);
      });
      searchResults.appendChild(card);
    });
}

function openSearch() {
  searchOverlay.classList.remove("hidden");
  searchInput.focus();
}

function closeSearch() {
  searchOverlay.classList.add("hidden");
  searchResults.innerHTML = "";
  searchInput.value = "";
}

// ─── New chat ─────────────────────────────────────────────────────────────────
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
promptInput.addEventListener("keydown", e => { if (e.key === "Enter") sendPrompt(); });
saveSettingsBtn.addEventListener("click", saveSettings);

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  });
}

openSearchBtn.addEventListener("click", openSearch);
closeSearchBtn.addEventListener("click", closeSearch);
searchOverlay.addEventListener("click", e => { if (e.target === searchOverlay) closeSearch(); });
searchBtn.addEventListener("click", searchConversations);
searchInput.addEventListener("keydown", e => { if (e.key === "Enter") searchConversations(); });
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchResults.innerHTML = "";
});

// ─── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
loadConversations();
loadBookmarks();
