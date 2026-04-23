// ─── DOM refs ────────────────────────────────────────────────────────────────
const chatList            = document.getElementById("chatList");
const bookmarkList        = document.getElementById("bookmarkList");
const responseSection     = document.getElementById("responseSection");
const threadSection       = document.getElementById("threadSection");
const threadTitle         = document.getElementById("threadTitle");
const threadMessages      = document.getElementById("threadMessages");
const threadBookmarkBtn   = document.getElementById("threadBookmarkBtn");
const threadUnbookmarkBtn = document.getElementById("threadUnbookmarkBtn");
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
  threadDeleteBtn.onclick     = () => deleteConversation(conversation.id);

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
      <span class="bubble-label">${msg.role === "user" ? "You" : "PistachioAI"}</span>
      <p>${escapeHtml(msg.content)}</p>
    `;
    threadMessages.appendChild(bubble);
  });

  scrollToBottom();

  // Change #6: "Continue your conversation…"
  mainHeading.textContent = "Continue your conversation…";

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


// self-modification--------------------------------------------------------------

//1. user clicks "Suggest a Change" 
//2. user picks a file from the dropdown and types an instruction
//3. on apply change, we POST to /api/suggest with {filePath, instruction}
//4. we show a working status while deepseek processes
//5. on success we show the backup path and ask the user to reload
//6. on error (constitution violation, syntax error, or other) we show the reason



const openSuggestBtn     = document.getElementById("openSuggestBtn");
const suggestOverlay     = document.getElementById("suggestOverlay");
const closeSuggestBtn    = document.getElementById("closeSuggestBtn");
const suggestCancelBtn   = document.getElementById("suggestCancelBtn");
const suggestSubmitBtn   = document.getElementById("suggestSubmitBtn");
const suggestFile        = document.getElementById("suggestFile");
const suggestInstruction = document.getElementById("suggestInstruction");
const suggestStatus      = document.getElementById("suggestStatus");

function openSuggest() {
  suggestOverlay.classList.remove("hidden");
  suggestInstruction.focus();
}

function closeSuggest() {
  suggestOverlay.classList.add("hidden");
  suggestStatus.textContent = "";
  suggestInstruction.value = "";
}

async function submitSuggestion() {
  const filePath    = suggestFile.value;
  const instruction = suggestInstruction.value.trim();

  if (!instruction) {
    suggestStatus.textContent = "Please enter an instruction.";
    suggestStatus.style.color = "var(--danger, #e74c3c)";
    return;
  }

  // Disable the button and show a working message.
  // DeepSeek can take 10-30 seconds to process a full file, so the user
  // needs feedback that something is happening.
  suggestSubmitBtn.disabled = true;
  suggestSubmitBtn.textContent = "Working…";
  suggestStatus.style.color = "var(--text-secondary)";
  suggestStatus.textContent = `Sending to DeepSeek Coder… this may take up to 5 minutes.`;

  try {
    const res  = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, instruction })
    });
    const data = await res.json();

    if (!res.ok) {
      // Show whatever error the server returned (Constitution violation,
      // syntax error, path error, etc.) so the user understands why it failed.
      suggestStatus.style.color = "var(--danger, #e74c3c)";
      suggestStatus.textContent = `Error: ${data.error}`;
      return;
    }

    // Success — tell the user where the backup is and that they need to reload.
    // We don't auto-reload because the user may want to read the message first.
    suggestStatus.style.color = "var(--success, #27ae60)";
    suggestStatus.textContent =
      `✓ ${data.message} Original backed up to: ${data.backedUpTo}`;

  } catch (err) {
    suggestStatus.style.color = "var(--danger, #e74c3c)";
    suggestStatus.textContent = `Network error: ${err.message}`;
  } finally {
    // Always re-enable the button, even if there was an error
    suggestSubmitBtn.disabled = false;
    suggestSubmitBtn.textContent = "Apply Change";
  }
}

openSuggestBtn.addEventListener("click", openSuggest);
closeSuggestBtn.addEventListener("click", closeSuggest);
suggestCancelBtn.addEventListener("click", closeSuggest);
suggestOverlay.addEventListener("click", e => { if (e.target === suggestOverlay) closeSuggest(); });
suggestSubmitBtn.addEventListener("click", submitSuggestion);
