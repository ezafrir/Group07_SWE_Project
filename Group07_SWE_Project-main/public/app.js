const chatList = document.getElementById("chatList");
const bookmarkList = document.getElementById("bookmarkList");
const responseSection = document.getElementById("responseSection");
const promptInput = document.getElementById("promptInput");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sendBtn = document.getElementById("sendBtn");
const shortenToggle = document.getElementById("shortenToggle");
const wordLimit = document.getElementById("wordLimit");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

async function checkAuth() {
  const res = await fetch("/api/me");
  const data = await res.json();

  if (!data.loggedIn) {
    window.location.href = "/";
    return;
  }

  if (userInfo) {
    userInfo.textContent = `Logged in as ${data.user.username}`;
  }
}

async function loadConversations() {
  const res = await fetch("/api/conversations");
  const conversations = await res.json();

  chatList.innerHTML = "";

  conversations
    .slice()
    .reverse()
    .forEach(conv => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${conv.title}</span>
        <div style="display:flex; gap:8px;">
          <button onclick="openConversation(${conv.id})">Open</button>
          <button onclick="deleteConversation(${conv.id})">Delete</button>
        </div>
      `;
      chatList.appendChild(li);
    });
}

async function loadBookmarks() {
  const res = await fetch("/api/bookmarks");
  const bookmarks = await res.json();

  bookmarkList.innerHTML = "";

  bookmarks
    .slice()
    .reverse()
    .forEach(conv => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${conv.title}</span>
        <button onclick="openConversation(${conv.id})">Open</button>
      `;
      bookmarkList.appendChild(li);
    });
}

async function saveSettings() {
  const responseLength = Number(wordLimit.value);

  const res = await fetch("/api/settings/response-length", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responseLength })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Could not save settings");
    return;
  }

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

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Could not create conversation");
    return;
  }

  renderConversation(data, true);
  await loadConversations();
  await loadBookmarks();
  promptInput.value = "";
}

function renderConversation(conversation, prepend = false) {
  const html = `
    <div class="responseCard" id="conversation-${conversation.id}">
      <h3>${conversation.title}</h3>
      <p><strong>Prompt:</strong> ${conversation.prompt}</p>
      <p><strong>Response:</strong> ${conversation.response}</p>
      <div class="responseActions">
        <button onclick="bookmarkConversation(${conversation.id})">Bookmark</button>
         <button onclick="unbookmarkConversation(${conversation.id})">Unbookmark</button>
      </div>
    </div>
  `;

  if (prepend) {
    responseSection.insertAdjacentHTML("afterbegin", html);
  } else {
    responseSection.innerHTML = html;
  }
}

async function openConversation(id) {
  const res = await fetch(`/api/conversations/${id}`);
  const conversation = await res.json();

  if (!res.ok) {
    alert(conversation.error || "Conversation not found");
    return;
  }

  renderConversation(conversation, false);
}

async function bookmarkConversation(id) {
  const res = await fetch(`/api/bookmarks/${id}`, {
    method: "POST"
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Could not bookmark conversation");
    return;
  }

  alert("Conversation successfully bookmarked");
  await loadBookmarks();
}

//unbookmark conv function
async function unbookmarkConversation(id) {

  const res = await fetch(`/api/bookmarks/${id}`, {// send a delete request to the backend api
    method: "DELETE"
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Could not remove bookmark");
    return;
  }

  alert("Bookmark removed successfully"); //tell user unbookmark was successful
  await loadBookmarks(); //reload bookmark update
}

async function deleteConversation(id) {
  const confirmed = confirm("Are you sure you want to delete this conversation?");
  if (!confirmed) return;

  const res = await fetch(`/api/conversations/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Could not delete conversation");
    return;
  }

  alert("Conversation successfully deleted");
  await loadConversations();
  await loadBookmarks();

  const card = document.getElementById(`conversation-${id}`);
  if (card) {
    card.remove();
  }
}



//search function
async function searchConversations() {
  const query = searchInput.value.trim(); //get text from search and trim whitespace
  if (!query) {
    alert("Please enter a search term"); //if user entered nothing, send an alert and do not search
    return;
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`); //send request to backend search api
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Search failed");
    return;
  }

  responseSection.innerHTML = ""; //clear prev searches

  if (data.length === 0) { //if no searches found
    responseSection.innerHTML = "<p>No matching conversations found.</p>";
    return;
  }
//render search results:
  data
    .slice()
    .reverse()
    .forEach(conversation => {
      renderConversation(conversation, true);
    });
}


if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  });
}

saveSettingsBtn.addEventListener("click", saveSettings);
sendBtn.addEventListener("click", sendPrompt);

if (searchBtn) {
  searchBtn.addEventListener("click", searchConversations);
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", async () => {
    searchInput.value = "";
    responseSection.innerHTML = "";
    await loadConversations();
  });
}

checkAuth();
loadConversations();
loadBookmarks();
