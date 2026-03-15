const chatList = document.getElementById("chatList");
const bookmarkList = document.getElementById("bookmarkList");
const responseSection = document.getElementById("responseSection");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const shortenToggle = document.getElementById("shortenToggle");
const wordLimit = document.getElementById("wordLimit");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

async function loadConversations() {
  const res = await fetch("/api/conversations");
  const conversations = await res.json();

  chatList.innerHTML = "";
  conversations.forEach(conv => {
    const li = document.createElement("li");
    li.innerHTML = `
  <span>${conv.title}</span>
  <button onclick="deleteConversation(${conv.id})">Delete</button>
`;
    chatList.appendChild(li);
  });
}

async function loadBookmarks() {
  const res = await fetch("/api/bookmarks");
  const bookmarks = await res.json();

  bookmarkList.innerHTML = "";
  bookmarks.forEach(conv => {
    const li = document.createElement("li");
    li.textContent = conv.title;
    bookmarkList.appendChild(li);
  });
}

async function saveSettings() {
  const responseLength = Number(wordLimit.value);

  await fetch("/api/settings/response-length", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responseLength })
  });

  alert("Response length updated");
}

async function sendPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      shorten: shortenToggle.checked
    })
  });

  const conversation = await res.json();
  renderResponse(conversation);
  await loadConversations();
  promptInput.value = "";
}

function renderResponse(conversation) {
  responseSection.innerHTML = `
    <div class="responseCard">
      <h3>${conversation.title}</h3>
      <p><strong>Prompt:</strong> ${conversation.prompt}</p>
      <p><strong>Response:</strong> ${conversation.response}</p>
      <div class="responseActions">
        <button onclick="bookmarkConversation(${conversation.id})">Bookmark</button>
      </div>
    </div>
  `;
}

async function bookmarkConversation(id) {
  await fetch(`/api/bookmarks/${id}`, {
    method: "POST"
  });

  alert("Conversation successfully bookmarked");
  await loadBookmarks();
}

async function deleteConversation(id) {
  const confirmed = confirm("Are you sure you want to delete this conversation?");
  if (!confirmed) return;

  await fetch(`/api/conversations/${id}`, {
    method: "DELETE"
  });

  alert("Conversation successfully deleted");
  await loadConversations();
  await loadBookmarks();
}

saveSettingsBtn.addEventListener("click", saveSettings);
sendBtn.addEventListener("click", sendPrompt);

loadConversations();
loadBookmarks();

