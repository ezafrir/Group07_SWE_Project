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
const deleteAllChatsBtn   = document.getElementById("deleteAllChatsBtn");

// Search modal refs
const openSearchBtn  = document.getElementById("openSearchBtn");
const searchOverlay  = document.getElementById("searchOverlay");
const closeSearchBtn = document.getElementById("closeSearchBtn");
const searchInput    = document.getElementById("searchInput");
const searchBtn      = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchResults  = document.getElementById("searchResults");

// ─── Multi-LLM cache ──────────────────────────────────────────────────────────
const multiResponseCache = {};

// ─── State ───────────────────────────────────────────────────────────────────
let activeConversationId = null;

// ─── Auth ────────────────────────────────────────────────────────────────────
async function checkAuth() {
  const res  = await fetch("/api/me");
  const data = await res.json();
  if (!data.loggedIn) { window.location.href = "/"; return; }
  if (userInfo) userInfo.textContent = `Logged in as ${data.user.username}`;
}

// ─── Sidebar: load conversations ──────────────────────────────────────────────
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
        <span class="chat-title" onclick="openConversation(${conv.id})">${escapeHtml(conv.title)}</span>
        <div class="chat-item-actions">
          <button class="icon-btn" onclick="openConversation(${conv.id})" title="Open">↗</button>
          <button class="icon-btn rename-btn" onclick="renameConversation(${conv.id}, this)" title="Rename">✏️</button>
          <button class="icon-btn" onclick="exportConversation(${conv.id})" title="Export">⬇</button>
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
        <span class="chat-title" onclick="openConversation(${conv.id})">${escapeHtml(conv.title)}</span>
        <div class="chat-item-actions">
          <button class="icon-btn" onclick="openConversation(${conv.id})" title="Open">↗</button>
        </div>
      `;
      bookmarkList.appendChild(li);
    });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
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

// ─── Loading bubbles ──────────────────────────────────────────────────────────
let isSending = false;

function showUserBubble(prompt) {
  threadSection.style.display = "block";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble user-bubble";
  bubble.dataset.pending = "true";
  bubble.innerHTML = `<span class="bubble-label">You</span><p>${escapeHtml(prompt)}</p>`;
  threadMessages.appendChild(bubble);
  scrollToBottom();
}

function showLoadingBubble() {
  threadSection.style.display = "block";
  const bubble = document.createElement("div");
  bubble.className = "loading-bubble";
  bubble.id = "loadingBubble";
  bubble.innerHTML = `<span>Generating Response. Thinking</span><div class="dots"><span></span><span></span><span></span></div>`;
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Send prompt ──────────────────────────────────────────────────────────────
async function sendPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt || isSending) return;

  isSending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending…";
  promptInput.value = "";

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

async function continueConversation(prompt) {
  const res  = await fetch(`/api/conversations/${activeConversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, shorten: shortenToggle.checked })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not send message"); return; }

  hideLoadingBubble();
  renderThread(data);
  await loadConversations();
}

// ─── Render thread ────────────────────────────────────────────────────────────
function renderThread(conversation) {
  responseSection.innerHTML = "";
  threadSection.style.display = "block";

  activeConversationId = conversation.id;
  threadTitle.textContent = conversation.title;

  threadBookmarkBtn.onclick   = () => bookmarkConversation(conversation.id);
  threadUnbookmarkBtn.onclick = () => unbookmarkConversation(conversation.id);
  threadDeleteBtn.onclick     = () => deleteConversation(conversation.id);

  threadMessages.innerHTML = "";

  const messages = conversation.messages || [
    { role: "user",      content: conversation.prompt   },
    { role: "assistant", content: conversation.response  }
  ];

  let lastAssistantIdx = -1;
  messages.forEach((msg, idx) => { if (msg.role === "assistant") lastAssistantIdx = idx; });

  messages.forEach((msg, idx) => {
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${msg.role === "user" ? "user-bubble" : "assistant-bubble"}`;
    if (idx === lastAssistantIdx) bubble.id = "lastAssistantBubble";

    const label = document.createElement("span");
    label.className = "bubble-label";
    label.textContent = msg.role === "user" ? "You" : "PistachioAI";

    const body = document.createElement("p");
    body.textContent = msg.content;

    bubble.appendChild(label);
    bubble.appendChild(body);
    threadMessages.appendChild(bubble);
  });

  appendModelSelector(conversation.id);
  scrollToBottom();
  mainHeading.textContent = "Continue your conversation…";
  loadConversations();
}

// ─── Model selector widget ────────────────────────────────────────────────────
function appendModelSelector(convId) {
  const old = document.getElementById("modelSelectorRow");
  if (old) old.remove();

  const wrapper = document.createElement("div");
  wrapper.id = "modelSelectorRow";
  wrapper.className = "model-selector-wrapper";

  // Row 1: local model dropdown
  const row = document.createElement("div");
  row.className = "model-selector-row";

  const label = document.createElement("span");
  label.className = "model-selector-label";
  label.textContent = "View response from:";

  const dropdown = document.createElement("select");
  dropdown.className = "model-dropdown";
  dropdown.id = "inlineModelDropdown";
  [
    { value: "llama3.2:latest",  text: "Llama 3.2 (local)"  },
    { value: "phi3:latest",      text: "Phi-3 (local)"      },
    { value: "tinyllama:latest", text: "TinyLlama (local)"  }  // CHANGED: was gemma3
  ].forEach(({ value, text }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    dropdown.appendChild(opt);
  });
  dropdown.value = "llama3.2:latest";

  const loadingIndicator = document.createElement("span");
  loadingIndicator.className = "model-loading-indicator hidden";
  loadingIndicator.id = "modelLoadingIndicator";
  loadingIndicator.textContent = "⏳ Fetching other models…";

  row.appendChild(label);
  row.appendChild(dropdown);
  row.appendChild(loadingIndicator);

  // Row 2: Gemini cloud button + action buttons
  const actionsRow = document.createElement("div");
  actionsRow.className = "model-actions-row";

  const geminiBtn = document.createElement("button");
  geminiBtn.className = "model-action-btn gemini-btn";
  geminiBtn.id = "geminiBtn";
  geminiBtn.innerHTML = "✨ Gemini (Cloud)";

  const groqBtn = document.createElement("button");
  groqBtn.className = "model-action-btn groq-btn";
  groqBtn.id = "groqBtn";
  groqBtn.innerHTML = "⚡ Groq / Llama (Cloud)";

  const summaryBtn = document.createElement("button");
  summaryBtn.className = "model-action-btn summary-btn";
  summaryBtn.id = "summaryBtn";
  summaryBtn.innerHTML = "📝 Summarize All";

  const compareBtn = document.createElement("button");
  compareBtn.className = "model-action-btn compare-btn";
  compareBtn.id = "compareBtn";
  compareBtn.innerHTML = "⚖️ Compare All";

  actionsRow.appendChild(geminiBtn);
  actionsRow.appendChild(groqBtn);
  actionsRow.appendChild(summaryBtn);
  actionsRow.appendChild(compareBtn);

  // Result panel
  const resultPanel = document.createElement("div");
  resultPanel.className = "model-result-panel hidden";
  resultPanel.id = "modelResultPanel";

  const resultHeader = document.createElement("div");
  resultHeader.className = "model-result-header";

  const resultTitle = document.createElement("span");
  resultTitle.className = "model-result-title";
  resultTitle.id = "modelResultTitle";

  const closePanel = document.createElement("button");
  closePanel.className = "model-result-close";
  closePanel.textContent = "✕";
  closePanel.title = "Close";
  closePanel.addEventListener("click", () => {
    resultPanel.classList.add("hidden");
    summaryBtn.classList.remove("active");
    compareBtn.classList.remove("active");
    geminiBtn.classList.remove("active");
    groqBtn.classList.remove("active");
  });

  resultHeader.appendChild(resultTitle);
  resultHeader.appendChild(closePanel);

  const resultBody = document.createElement("div");
  resultBody.className = "model-result-body";
  resultBody.id = "modelResultBody";

  resultPanel.appendChild(resultHeader);
  resultPanel.appendChild(resultBody);

  wrapper.appendChild(row);
  wrapper.appendChild(actionsRow);
  wrapper.appendChild(resultPanel);
  threadMessages.appendChild(wrapper);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function swapBubble(modelLabel, text) {
    const bubble = document.getElementById("lastAssistantBubble");
    if (!bubble) return;
    bubble.querySelector(".bubble-label").textContent = modelLabel;
    bubble.querySelector("p").textContent = text;
  }

  function showResultPanel(title, content, isLoading = false) {
    resultTitle.textContent = title;
    if (isLoading) {
      resultBody.innerHTML = `<div class="model-result-loading"><div class="dots"><span></span><span></span><span></span></div><span>Generating…</span></div>`;
    } else {
      resultBody.textContent = content;
    }
    resultPanel.classList.remove("hidden");
    scrollToBottom();
  }

  // Pre-fetch local model responses in background
  if (!multiResponseCache[convId]) {
    loadingIndicator.classList.remove("hidden");
    fetch(`/api/conversations/${convId}/multi-response`)
      .then(r => r.json())
      .then(data => {
        if (data.multiResponses) {
          multiResponseCache[convId] = data.multiResponses;
          const entry = data.multiResponses.find(r => r.modelId === dropdown.value);
          if (entry) swapBubble(entry.label, entry.error ? `(Model unavailable: ${entry.error})` : entry.response);
        }
      })
      .catch(() => {
        loadingIndicator.textContent = "⚠ Models unavailable (is Ollama running?)";
        loadingIndicator.classList.remove("hidden");
      })
      .finally(() => {
        if (!loadingIndicator.textContent.startsWith("⚠")) loadingIndicator.classList.add("hidden");
      });
  }

  dropdown.addEventListener("change", () => {
    const cached = multiResponseCache[convId];
    if (!cached) { loadingIndicator.classList.remove("hidden"); return; }
    const entry = cached.find(r => r.modelId === dropdown.value);
    if (!entry) return;
    swapBubble(entry.label, entry.error ? `(Model unavailable: ${entry.error})` : entry.response);
  });

  // Gemini cloud button
  geminiBtn.addEventListener("click", async () => {
    const isOpen = !resultPanel.classList.contains("hidden") && geminiBtn.classList.contains("active");
    if (isOpen) {
      resultPanel.classList.add("hidden");
      geminiBtn.classList.remove("active");
      return;
    }
    geminiBtn.classList.add("active");
    groqBtn.classList.remove("active");
    summaryBtn.classList.remove("active");
    compareBtn.classList.remove("active");
    showResultPanel("✨ Gemini 2.5 Flash (Cloud)", "", true);
    geminiBtn.disabled = true;

    try {
      const res  = await fetch(`/api/conversations/${convId}/gemini`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gemini request failed");
      showResultPanel("✨ Gemini 2.5 Flash (Cloud)", data.response);
    } catch (err) {
      showResultPanel("✨ Gemini 2.5 Flash (Cloud)", `⚠ ${err.message}`);
    } finally {
      geminiBtn.disabled = false;
    }
  });

  // Groq / Llama 3.3 70B cloud button
  groqBtn.addEventListener("click", async () => {
    const isOpen = !resultPanel.classList.contains("hidden") && groqBtn.classList.contains("active");
    if (isOpen) {
      resultPanel.classList.add("hidden");
      groqBtn.classList.remove("active");
      return;
    }
    groqBtn.classList.add("active");
    geminiBtn.classList.remove("active");
    summaryBtn.classList.remove("active");
    compareBtn.classList.remove("active");
    showResultPanel("⚡ Groq — Llama 3.3 70B (Cloud)", "", true);
    groqBtn.disabled = true;

    try {
      const res  = await fetch(`/api/conversations/${convId}/groq`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Groq request failed");
      showResultPanel("⚡ Groq — Llama 3.3 70B (Cloud)", data.response);
    } catch (err) {
      showResultPanel("⚡ Groq — Llama 3.3 70B (Cloud)", `⚠ ${err.message}`);
    } finally {
      groqBtn.disabled = false;
    }
  });

  // Summary button
  summaryBtn.addEventListener("click", async () => {
    const isOpen = !resultPanel.classList.contains("hidden") && summaryBtn.classList.contains("active");
    if (isOpen) { resultPanel.classList.add("hidden"); summaryBtn.classList.remove("active"); return; }

    summaryBtn.classList.add("active");
    compareBtn.classList.remove("active");
    geminiBtn.classList.remove("active");
    groqBtn.classList.remove("active");
    showResultPanel("📝 Summary of All Responses", "", true);
    summaryBtn.disabled = true;

    try {
      const res  = await fetch(`/api/conversations/${convId}/multi-summary`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Summary failed");
      showResultPanel("📝 Summary of All Responses", data.summary);
    } catch (err) {
      showResultPanel("📝 Summary of All Responses", `⚠ ${err.message}`);
    } finally {
      summaryBtn.disabled = false;
    }
  });

  // Compare button
  compareBtn.addEventListener("click", async () => {
    const isOpen = !resultPanel.classList.contains("hidden") && compareBtn.classList.contains("active");
    if (isOpen) { resultPanel.classList.add("hidden"); compareBtn.classList.remove("active"); return; }

    compareBtn.classList.add("active");
    summaryBtn.classList.remove("active");
    geminiBtn.classList.remove("active");
    groqBtn.classList.remove("active");
    showResultPanel("⚖️ Comparison of All Responses", "", true);
    compareBtn.disabled = true;

    try {
      const res  = await fetch(`/api/conversations/${convId}/multi-compare`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Comparison failed");
      showResultPanel("⚖️ Comparison of All Responses", data.comparison);
    } catch (err) {
      showResultPanel("⚖️ Comparison of All Responses", `⚠ ${err.message}`);
    } finally {
      compareBtn.disabled = false;
    }
  });
}

// ─── Open conversation ────────────────────────────────────────────────────────
async function openConversation(id) {
  const res  = await fetch(`/api/conversations/${id}`);
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Conversation not found"); return; }
  renderThread(data);
}

// ─── Rename conversation ──────────────────────────────────────────────────────
async function renameConversation(id, btn) {
  const li        = btn.closest("li");
  const titleSpan = li.querySelector(".chat-title");
  const current   = titleSpan.textContent;

  const newTitle = prompt("Enter a new name for this conversation:", current);
  if (!newTitle || !newTitle.trim() || newTitle.trim() === current) return;

  const res  = await fetch(`/api/conversations/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: newTitle.trim() })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not rename conversation"); return; }

  titleSpan.textContent = data.conversation.title;
  // Update thread title if this is the active conversation
  if (activeConversationId === id) threadTitle.textContent = data.conversation.title;
  await loadConversations();
}

// ─── Export conversation ──────────────────────────────────────────────────────
function exportConversation(id) {
  const a = document.createElement("a");
  a.href = `/api/conversations/${id}/export`;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Delete all chats ─────────────────────────────────────────────────────────
async function deleteAllChats() {
  if (!confirm("Are you sure you want to delete ALL your conversations? This cannot be undone.")) return;

  const res  = await fetch("/api/conversations", { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Could not delete all conversations"); return; }

  activeConversationId = null;
  threadSection.style.display = "none";
  threadMessages.innerHTML = "";
  responseSection.innerHTML = "";
  mainHeading.textContent = "How can I help you?";
  await loadConversations();
  await loadBookmarks();
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

// ─── Delete single conversation ───────────────────────────────────────────────
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

// ─── Search ───────────────────────────────────────────────────────────────────
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

  data.slice().reverse().forEach(conv => {
    const card = document.createElement("div");
    card.className = "search-result-card";
    card.innerHTML = `
      <h4>${escapeHtml(conv.title)}</h4>
      <p>${escapeHtml(conv.prompt.length > 80 ? conv.prompt.slice(0, 80) + "…" : conv.prompt)}</p>
    `;
    card.addEventListener("click", () => { closeSearch(); openConversation(conv.id); });
    searchResults.appendChild(card);
  });
}

function openSearch() { searchOverlay.classList.remove("hidden"); searchInput.focus(); }
function closeSearch() { searchOverlay.classList.add("hidden"); searchResults.innerHTML = ""; searchInput.value = ""; }

// ─── Event listeners ──────────────────────────────────────────────────────────
newChatBtn.addEventListener("click", () => {
  activeConversationId = null;
  threadSection.style.display = "none";
  threadMessages.innerHTML = "";
  responseSection.innerHTML = "";
  promptInput.value = "";
  mainHeading.textContent = "How can I help you?";
  loadConversations();
});

if (deleteAllChatsBtn) {
  deleteAllChatsBtn.addEventListener("click", deleteAllChats);
}

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
clearSearchBtn.addEventListener("click", () => { searchInput.value = ""; searchResults.innerHTML = ""; });

// ─── Self-modification (Emma's feature) ───────────────────────────────────────
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
  suggestInstruction.value  = "";
}

async function submitSuggestion() {
  const filePath    = suggestFile.value;
  const instruction = suggestInstruction.value.trim();

  if (!instruction) {
    suggestStatus.style.color   = "var(--danger, #e74c3c)";
    suggestStatus.textContent   = "Please enter an instruction.";
    return;
  }

  suggestSubmitBtn.disabled   = true;
  suggestSubmitBtn.textContent = "Working…";
  suggestStatus.style.color   = "var(--text-secondary)";
  suggestStatus.textContent   = "Sending to DeepSeek Coder… this may take a few minutes.";

  try {
    const res  = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, instruction })
    });
    const data = await res.json();

    if (!res.ok) {
      suggestStatus.style.color = "var(--danger, #e74c3c)";
      suggestStatus.textContent = `Error: ${data.error}`;
    } else {
      suggestStatus.style.color = "var(--success, #27ae60)";
      suggestStatus.textContent =
        `✓ ${data.message}\nBackup saved to: ${data.backedUpTo}`;
    }
  } catch (err) {
    suggestStatus.style.color = "var(--danger, #e74c3c)";
    suggestStatus.textContent = `Network error: ${err.message}`;
  } finally {
    suggestSubmitBtn.disabled    = false;
    suggestSubmitBtn.textContent = "Apply Change";
  }
}

openSuggestBtn.addEventListener("click", openSuggest);
closeSuggestBtn.addEventListener("click", closeSuggest);
suggestCancelBtn.addEventListener("click", closeSuggest);
suggestOverlay.addEventListener("click", e => { if (e.target === suggestOverlay) closeSuggest(); });
suggestSubmitBtn.addEventListener("click", submitSuggestion);

// ─── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
loadConversations();
loadBookmarks();
