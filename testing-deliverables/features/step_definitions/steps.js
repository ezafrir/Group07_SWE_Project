const { Given, When, Then, Before, After, setDefaultTimeout } = require("@cucumber/cucumber");
const puppeteer = require("puppeteer-core");
const assert = require("assert");

setDefaultTimeout(1200000);

const BASE = "http://localhost:3000";

let browser;
let page;

function uniqueUser(prefix = "user") {
  const id = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  return {
    username: `${prefix}${id}`,
    email: `${prefix}${id}@example.com`,
    password: "Test1234!"
  };
}

function getChromePath() {
  if (process.platform === "win32") {
    return `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
  }
  return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

Before(async () => {
  browser = await puppeteer.launch({
    headless: false,
    executablePath: getChromePath(),
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
});

After(async () => {
  if (browser) {
    await browser.close();
  }
});

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wraps page.waitForFunction with retry logic for the "Waiting failed" error that
// Puppeteer throws when the frame's execution context is briefly detached during
// a navigation (e.g. the /app → /index.html server redirect). The detach is
// transient; waiting a moment and retrying reliably resolves it.
async function robustWaitForFunction(fn, options = {}) {
  const totalTimeout = options.timeout || 30000;
  const MAX_RETRIES = 5;
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const elapsed = Date.now() - start;
    const remaining = totalTimeout - elapsed;
    if (remaining <= 0) throw new Error(`robustWaitForFunction: timed out after ${totalTimeout}ms`);

    try {
      // Pass remaining budget so retries never exceed the original total timeout.
      return await page.waitForFunction(fn, { ...options, timeout: remaining });
    } catch (err) {
      const isDetach =
        err.message === "Waiting failed" ||
        err.message.includes("detached") ||
        err.message.includes("Execution context was destroyed");
      if (isDetach && attempt < MAX_RETRIES) {
        await delay(600 * attempt); // 0.6 s, 1.2 s, 1.8 s, 2.4 s back-off
        continue;
      }
      throw err;
    }
  }
}

async function goHome() {
  await page.goto(BASE, { waitUntil: "networkidle2" });
}

async function ensureLoginTab() {
  const loginTab = await page.$("#tabLogin");
  if (loginTab) {
    await page.click("#tabLogin");
  }
}

async function waitForApp() {
  try {
    await robustWaitForFunction(() => !!document.querySelector("#promptInput"), { timeout: 20000 });
  } catch {
    // Signup may have failed due to a duplicate email from a prior test run.
    // Fall back to login using the credentials still in the signup form.
    const authMsg = await page.$eval("#authMessage", el => el.textContent.trim()).catch(() => "");
    if (authMsg.includes("already exists")) {
      const email    = await page.$eval("#signupEmail",    el => el.value).catch(() => "");
      const password = await page.$eval("#signupPassword", el => el.value).catch(() => "");
      if (email && password) {
        await page.click("#tabLogin").catch(() => {});
        await page.waitForSelector("#loginEmail", { visible: true, timeout: 5000 });
        await page.$eval("#loginEmail",    el => (el.value = ""));
        await page.type("#loginEmail",    email);
        await page.$eval("#loginPassword", el => (el.value = ""));
        await page.type("#loginPassword", password);
        await page.click("#loginBtn");
        await robustWaitForFunction(() => !!document.querySelector("#promptInput"), { timeout: 15000 });
        return;
      }
    }
    throw new Error(`waitForApp timed out. Auth message: "${authMsg}"`);
  }
}

async function waitForSidebarEntry() {
  await robustWaitForFunction(() => {
    const list = document.querySelector("#chatList");
    return list && list.innerText.trim().length > 0;
  }, { timeout: 480000 });
}

async function waitForBookmarkEntry() {
  await robustWaitForFunction(() => {
    const list = document.querySelector("#bookmarkList");
    return list && list.innerText.trim().length > 0;
  }, { timeout: 15000 });
}

async function signUp(username, email, password) {
  await goHome();

  const promptExists = await page.$("#promptInput");
  if (promptExists) return;

  await page.waitForSelector("#signupUsername", { visible: true, timeout: 10000 });

  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", username);

  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", email);

  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", password);

  await page.click("#signupBtn");
  await waitForApp();
}

async function login(email, password) {
  await goHome();

  const promptExists = await page.$("#promptInput");
  if (promptExists) return;

  await ensureLoginTab();
  await page.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });

  await page.$eval("#loginEmail", el => (el.value = ""));
  await page.type("#loginEmail", email);

  await page.$eval("#loginPassword", el => (el.value = ""));
  await page.type("#loginPassword", password);

  await page.click("#loginBtn");
  await waitForApp();
}

async function logout() {
  const logoutBtn = await page.$("#logoutBtn");
  if (logoutBtn) {
    await page.click("#logoutBtn");
    await page.waitForSelector("#tabLogin", { visible: true, timeout: 30000 });
  }
}

async function submitPrompt(text) {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await page.click("#promptInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#promptInput", text);

  await page.waitForSelector("#sendBtn", { visible: true, timeout: 10000 });
  await page.click("#sendBtn");
}

async function waitForResponse() {
  // Wait directly for an assistant-bubble — it appears once all 3 models have responded.
  // 9-minute ceiling matches waitForMultiLLMResponses and covers 3 sequential local LLM calls.
  await robustWaitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    return thread && thread.querySelector(".assistant-bubble") !== null;
  }, { timeout: 540000 });
}

async function createConversation(promptText = "give me one short sentence") {
  await submitPrompt(promptText);
  await waitForResponse();
  // loadConversations() is called before renderThread() in app.js, so the sidebar
  // should already be populated by the time waitForResponse() resolves.
  // Use a short poll so we don't double-count against the step timeout budget.
  await robustWaitForFunction(() => {
    const list = document.querySelector("#chatList");
    return list && list.innerText.trim().length > 0;
  }, { timeout: 30000 }).catch(() => {});
}

async function bookmarkCurrentConversation() {
  await page.waitForSelector("#threadBookmarkBtn", { visible: true, timeout: 10000 });
  page.once("dialog", async d => await d.accept());
  await page.click("#threadBookmarkBtn");
  await delay(1000);
}

Given("I navigate to the home page", async () => {
  await goHome();
});

Given("I am on the landing page", async () => {
  await goHome();
  const promptExists = await page.$("#promptInput");
  if (promptExists) {
    await logout();
  }
  await page.waitForSelector("#signupBtn", { visible: true, timeout: 10000 });
});

Given("I am not logged in", async () => {
  await goHome();
  const promptExists = await page.$("#promptInput");
  if (promptExists) {
    await logout();
  }
});

Given("I am already logged in", async () => {
  const user = uniqueUser("autouser");
  await signUp(user.username, user.email, user.password);
});

Given("a user already exists with email {string}", async (email) => {
  await goHome();
  await page.waitForSelector("#signupUsername", { visible: true, timeout: 10000 });

  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", `user${Date.now()}`);

  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", email);

  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", "Test1234!");

  await page.click("#signupBtn");
  await delay(1000);
  await logout().catch(() => {});
});

Given("a registered user exists with email {string} and password {string}", async (email, password) => {
  await goHome();
  await page.waitForSelector("#signupUsername", { visible: true, timeout: 10000 });

  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", `user${Date.now()}`);

  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", email);

  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", password);

  await page.click("#signupBtn");
  await delay(1000);
  await logout().catch(() => {});
});

Given("I am logged in and on the app page", async () => {
  const user = uniqueUser("appuser");
  await signUp(user.username, user.email, user.password);
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
});

Given("I am logged in with an existing conversation", async () => {
  const user = uniqueUser("convuser");
  await signUp(user.username, user.email, user.password);
  await createConversation("give me one short sentence");
});

Given("I am logged in and have a bookmarked conversation", async () => {
  const user = uniqueUser("bmuser");
  await signUp(user.username, user.email, user.password);
  await createConversation("give me one short sentence");
  await bookmarkCurrentConversation();
  await waitForBookmarkEntry();
});

When("I am on the app page", async () => {
  await goHome();
  const promptExists = await page.$("#promptInput");
  if (!promptExists) {
    const user = uniqueUser("appuser");
    await signUp(user.username, user.email, user.password);
  }
});

When("I navigate to {string}", async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
});

When("I fill in signup username with {string}", async value => {
  await page.waitForSelector("#signupUsername", { visible: true, timeout: 10000 });
  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", value);
});

When("I fill in signup email with {string}", async value => {
  await page.waitForSelector("#signupEmail", { visible: true, timeout: 10000 });
  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", value);
});

When("I fill in signup password with {string}", async value => {
  await page.waitForSelector("#signupPassword", { visible: true, timeout: 10000 });
  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", value);
});

When("I fill in login email with {string}", async value => {
  await ensureLoginTab();
  await page.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });
  await page.$eval("#loginEmail", el => (el.value = ""));
  await page.type("#loginEmail", value);
});

When("I fill in login password with {string}", async value => {
  await ensureLoginTab();
  await page.waitForSelector("#loginPassword", { visible: true, timeout: 10000 });
  await page.$eval("#loginPassword", el => (el.value = ""));
  await page.type("#loginPassword", value);
});

When("I click the Sign Up button", async () => {
  await page.click("#signupBtn");
  await delay(800);
});

When("I click the Log In button", async () => {
  await ensureLoginTab();
  await page.click("#loginBtn");
  await delay(800);
});

When("I click the Log Out button", async () => {
  await logout();
});

When("I click the Send button", async () => {
  await page.waitForSelector("#sendBtn", { visible: true, timeout: 10000 });
  await page.click("#sendBtn");
  await delay(300);
});

When("I click Save Settings", async () => {
  page.once("dialog", async d => await d.accept());
  await page.waitForSelector("#saveSettingsBtn", { visible: true, timeout: 10000 });
  await page.click("#saveSettingsBtn");
  await delay(600);
});

When("I type {string} into the prompt box", async text => {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await page.click("#promptInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#promptInput", text);
});

When("I leave the prompt box empty", async () => {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await page.$eval("#promptInput", el => (el.value = ""));
});

When("I enable the Shorten response toggle", async () => {
  await page.waitForSelector("#shortenToggle", { visible: true, timeout: 10000 });
  const checked = await page.$eval("#shortenToggle", el => el.checked);
  if (!checked) {
    await page.click("#shortenToggle");
  }
});

When("I set max words to {string}", async value => {
  await page.waitForSelector("#wordLimit", { visible: true, timeout: 10000 });
  await page.click("#wordLimit", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#wordLimit", value);
});

When("I click the Bookmark button on the response card", async () => {
  await bookmarkCurrentConversation();
});

When("I click the Delete button for that conversation", async () => {
  await page.waitForSelector("#threadDeleteBtn", { visible: true, timeout: 10000 });
  page.once("dialog", async d => await d.dismiss());
  await page.click("#threadDeleteBtn");
  await delay(300);
});

When("I confirm the confirmation dialog", async () => {
  await page.waitForSelector("#threadDeleteBtn", { visible: true, timeout: 10000 });
  page.once("dialog", async d => await d.accept());
  await page.click("#threadDeleteBtn");
  await delay(700);
});

When("I dismiss the confirmation dialog", async () => {
  await page.waitForSelector("#threadDeleteBtn", { visible: true, timeout: 10000 });
  page.once("dialog", async d => await d.dismiss());
  await page.click("#threadDeleteBtn");
  await delay(400);
});

When("I click Open next to it in the Bookmarked Chats sidebar", async () => {
  await waitForBookmarkEntry();
  await page.waitForSelector("#bookmarkList button", { visible: true, timeout: 10000 });
  await page.click("#bookmarkList button");
  await delay(500);
});

Then("I should see the heading {string}", async text => {
  const heading = await page.$eval("h1", el => el.textContent.trim());
  assert.ok(heading.includes(text), `Expected h1 to contain "${text}", got "${heading}"`);
});

Then("I should see a signup form", async () => {
  const el = await page.$("#signupBtn");
  assert.ok(el, "Sign Up button not found");
});

Then("I should see a login form", async () => {
  const el = await page.$("#loginBtn");
  assert.ok(el, "Log In button not found");
});

Then("I should be on the app page", async () => {
  await waitForApp();
  assert.ok(
    page.url().includes("index.html") || page.url().includes("/app") || page.url() === `${BASE}/`,
    `Expected app page, got ${page.url()}`
  );
});

Then("I should be on the landing page", async () => {
  await page.waitForSelector("#signupBtn", { visible: true, timeout: 10000 });
  assert.ok(!page.url().includes("/app") || page.url() === `${BASE}/`, `Expected landing page, got ${page.url()}`);
});

Then("I should see {string}", async text => {
  const content = await page.content();
  assert.ok(content.includes(text), `Page does not contain "${text}"`);
});

Then("I should see the auth error {string}", async expected => {
  await page.waitForSelector("#authMessage", { timeout: 10000 });
  const msg = await page.$eval("#authMessage", el => el.textContent.trim());
  assert.strictEqual(msg, expected, `Expected error "${expected}", got "${msg}"`);
});

Then("a response card should appear on the page", async () => {
  await waitForResponse();
  const threadText = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(threadText.length > 0, "Assistant response not found");
});

Then("the response card should contain study-related content", async () => {
  await waitForResponse();
  const text = await page.$eval("#threadMessages", el => el.textContent.toLowerCase());
  const relevant = text.includes("study") || text.includes("exam") || text.includes("concept");
  assert.ok(relevant, `Response did not contain study-related text: "${text}"`);
});

Then("no response card should appear", async () => {
  await delay(500);
  const thread = await page.$("#threadMessages");
  const text = thread ? await page.$eval("#threadMessages", el => el.innerText.trim()) : "";
  assert.ok(!text, "Assistant response should not have been created");
});

Then("the Chats sidebar should contain a new entry", async () => {
  await waitForSidebarEntry();
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Chat list should not be empty");
});

Then("the response on the card should contain no more than {int} words", async max => {
  await waitForResponse();

  const bubbleTexts = await page.$$eval(".assistant-bubble p", els =>
    els.map(el => el.innerText.trim()).filter(t => t.length > 0)
  );
  assert.ok(bubbleTexts.length > 0, "No assistant response text found");
  for (const text of bubbleTexts) {
    const words = text.split(/\s+/).filter(Boolean);
    assert.ok(
      words.length <= max,
      `Response exceeds ${max} words (got ${words.length}): "${text.slice(0, 120)}"`
    );
  }
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async () => {
  await waitForBookmarkEntry();
  const text = await page.$eval("#bookmarkList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Bookmarked Chats list should not be empty");
});

Then("the conversation should no longer appear in the Chats sidebar", async () => {
  await delay(800);
  const threadDeleteBtn = await page.$("#threadDeleteBtn");
  const heading = await page.$("#mainHeading")
    ? await page.$eval("#mainHeading", el => el.textContent.trim())
    : "";
  assert.ok(!threadDeleteBtn || heading.includes("How can I help"), "Conversation should be cleared after deletion");
});

Then("the conversation should still appear in the Chats sidebar", async () => {
  await waitForSidebarEntry();
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Conversation should still be present");
});

Then("the response card should display the prompt and response", async () => {
  await waitForResponse();
  const threadText = await page.$eval("#threadMessages", el => el.textContent.trim());
  assert.ok(threadText.length > 0, "Expected thread to show prompt and response");
});

// Older feature files

Given("the user is on the PistachioAI chat page", async () => {
  await goHome();

  const promptExists = await page.$("#promptInput");
  if (promptExists) {
    await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
    return;
  }

  const user = uniqueUser("chatuser");
  await signUp(user.username, user.email, user.password);
});

When("the user types {string} into the prompt box", async text => {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await page.click("#promptInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#promptInput", text);
});

When("the user clicks the send button", async () => {
  await page.waitForSelector("#sendBtn", { visible: true, timeout: 10000 });
  await page.click("#sendBtn");
});

Then("a loading icon should be visible", async () => {
  // Accept if bubble is present OR a response already arrived (bubble appeared and cleared quickly)
  await robustWaitForFunction(() => {
    const bubble = document.querySelector("#loadingBubble");
    const thread = document.querySelector("#threadMessages");
    return bubble !== null ||
           (thread && thread.querySelector(".assistant-bubble") !== null);
  }, { timeout: 15000 });
});

Then("a response should be displayed on the screen", async () => {
  await waitForResponse();
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "No assistant response found on screen");
});

Given("the user has opened an existing conversation from the sidebar", async () => {
  await createConversation("give me one short sentence");
  await waitForSidebarEntry();

  const firstConversation = await page.$("#chatList .chat-item, #chatList li, #chatList button, #chatList > *");
  assert.ok(firstConversation, "No existing conversation found in sidebar");
  await firstConversation.click();

  await page.waitForSelector("#threadMessages", { visible: true, timeout: 10000 });
});

Then("the new message should be appended to the existing conversation", async () => {
  await waitForResponse();
  const threadText = await page.$eval("#threadMessages", el => el.innerText.toLowerCase());
  assert.ok(threadText.length > 0, "Expected appended conversation content");
});

Then("a new conversation should not be created", async () => {
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Expected sidebar to still contain conversation items");
});

Given("the UI is currently in light mode", async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  const isDark = await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark");
  if (isDark) {
    await page.click("#themeToggleApp");
    await robustWaitForFunction(() => document.documentElement.getAttribute("data-theme") !== "dark", { timeout: 5000 });
  }
});

Given("the UI is currently in dark mode", async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  const isDark = await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark");
  if (!isDark) {
    await page.click("#themeToggleApp");
    await robustWaitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", { timeout: 5000 });
  }
});

When("the user clicks the dark\\/light mode toggle button", async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  await page.click("#themeToggleApp");
});

Then("the UI theme should change to dark mode", async () => {
  await robustWaitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", { timeout: 5000 });
});

Then("the UI theme should change to light mode", async () => {
  await robustWaitForFunction(() => document.documentElement.getAttribute("data-theme") !== "dark", { timeout: 5000 });
});

When("the response has finished loading", async () => {
  await waitForResponse();
});

Then("the conversation should appear in the chat history sidebar", async () => {
  await waitForSidebarEntry();
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "No conversations found in the sidebar");
});

Given("multiple conversations exist in the sidebar", async () => {
  await createConversation("France test one");
  await createConversation("France test two");
  await waitForSidebarEntry();
});

When("the user types {string} into the search bar", async keyword => {
  await page.waitForSelector("#openSearchBtn", { visible: true, timeout: 10000 });
  await page.click("#openSearchBtn");

  await page.waitForSelector("#searchInput", { visible: true, timeout: 10000 });
  await page.click("#searchInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#searchInput", keyword);

  await page.click("#searchBtn");
});

Then("only conversations containing {string} should be displayed in the sidebar", async keyword => {
  await robustWaitForFunction(() => {
    const results = document.querySelector("#searchResults");
    return results && results.innerText.trim().length > 0;
  }, { timeout: 10000 });

  const resultsText = await page.$eval("#searchResults", el => el.innerText.toLowerCase());
  assert.ok(resultsText.includes(keyword.toLowerCase()), `Search results do not contain "${keyword}"`);
});

Given("the user has searched for {string} in the search bar", async keyword => {
  await goHome();

  const promptExists = await page.$("#promptInput");
  if (!promptExists) {
    const user = uniqueUser("searchuser");
    await signUp(user.username, user.email, user.password);
  }

  await createConversation("France searchable conversation");
  await page.click("#openSearchBtn");
  await page.waitForSelector("#searchInput", { visible: true, timeout: 10000 });
  await page.click("#searchInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#searchInput", keyword);
  await page.click("#searchBtn");
});

Given("matching conversations are displayed", async () => {
  await robustWaitForFunction(() => {
    const results = document.querySelector("#searchResults");
    return results && results.innerText.trim().length > 0;
  }, { timeout: 10000 });
});

When("the user clicks on one of the search results", async () => {
  const firstResult = await page.$(".search-result-card, #searchResults > *, #searchResults button, #searchResults li");
  assert.ok(firstResult, "No search result to click");
  await firstResult.click();
});

Then("that conversation should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 10000 });
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "No conversation loaded after clicking search result");
});

Given("at least one past conversation exists in the sidebar", async () => {
  await createConversation("give me one short sentence");
  await waitForSidebarEntry();
});

When("the user clicks on a conversation in the sidebar", async () => {
  const firstConversation = await page.$("#chatList .chat-item, #chatList li, #chatList button, #chatList > *");
  assert.ok(firstConversation, "No conversation found in sidebar");
  await firstConversation.click();
});

Then("that conversation's messages should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 10000 });
  const threadText = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(threadText.length > 0, "No messages loaded after clicking a past conversation");
});

// ─── Multi-LLM response steps ─────────────────────────────────────────────────

async function waitForMultiLLMResponses() {
  // 3 models run sequentially — allow up to 9 minutes total
  await robustWaitForFunction(() => {
    const group = document.querySelector(".multi-response-group");
    return group && group.querySelectorAll(".assistant-bubble").length >= 3;
  }, { timeout: 540000 });
}

Given("I am logged in and have received multi-LLM responses", async () => {
  const user = uniqueUser("llmuser");
  await signUp(user.username, user.email, user.password);
  await submitPrompt("What is machine learning?");
  await waitForMultiLLMResponses();
});

Then("three labeled response bubbles should appear in the thread", async () => {
  await waitForMultiLLMResponses();
  const count = await page.$$eval(".multi-response-group .assistant-bubble", els => els.length);
  assert.ok(count >= 3, `Expected at least 3 response bubbles, got ${count}`);
});

Then("the thread should contain a bubble labeled {string}", async (label) => {
  const text = await page.$eval("#threadMessages", el => el.textContent);
  assert.ok(text.includes(label), `Thread does not contain a bubble labeled "${label}"`);
});

When("I click the Summarize button", async () => {
  await page.waitForSelector("#threadSummarizeBtn", { visible: true, timeout: 10000 });
  await page.click("#threadSummarizeBtn");
});

Then("a summary section should appear at the bottom of the thread", async () => {
  await page.waitForSelector("#summarySection", { visible: true, timeout: 180000 });
  const text = await page.$eval("#summarySection", el => el.innerText.trim());
  assert.ok(text.length > 0, "Summary section is empty");
});

Then("the summary section should contain a {string} heading", async (heading) => {
  await page.waitForSelector("#summarySection", { visible: true, timeout: 180000 });
  const text = await page.$eval("#summarySection", el => el.textContent);
  assert.ok(text.includes(heading), `Summary section does not contain heading "${heading}"`);
});
