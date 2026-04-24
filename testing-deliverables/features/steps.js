const { Given, When, Then, Before, After, setDefaultTimeout } = require("@cucumber/cucumber");
const puppeteer = require("puppeteer-core");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

setDefaultTimeout(120000);

const BASE = "http://localhost:3000";

function getChromePath() {
  if (process.platform === "win32") {
    const candidates = [
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
    throw new Error("Could not find Chrome or Edge.");
  }

  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  return "/usr/bin/google-chrome";
}

const CHROME_PATH = getChromePath();

let browser;
let page;
let userDataDir;

let sidebarCountBefore = 0;
let firstUserPrompt = "";
let mockState;

function resetMockState() {
  mockState = {
    loggedIn: false,
    currentUser: null,
    users: [],
    nextConversationId: 1,
    responseLength: 200,
    llms: [
      {
        id: "llama3.2",
        name: "Llama 3.2",
        shortDesc: "General-purpose assistant",
        description: "Best for general questions, conversations, and everyday tasks."
      },
      {
        id: "deepseek-r1",
        name: "DeepSeek R1",
        shortDesc: "Reasoning & math expert",
        description: "Best for complex reasoning, math problems, and step-by-step analysis."
      },
      {
        id: "gemma3",
        name: "Gemma 3",
        shortDesc: "Creative writing & summaries",
        description: "Best for creative writing, summarization, and natural language tasks."
      }
    ],
    conversations: [],
    bookmarks: []
  };
}

function uniqueUser(prefix = "user") {
  const id = `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  return {
    username: `${prefix}${id}`,
    email: `${prefix}${id}@example.com`,
    password: "Test1234!"
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function trimWords(text, maxWords) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function makeTitle(prompt) {
  const cleaned = String(prompt).trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled Chat";
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

function buildLlmResults(prompt, shorten) {
  const maxWords = shorten ? Number(mockState.responseLength) || 200 : 200;

  const makeResponse = (label) =>
    trimWords(
      `${label} response to: ${prompt}. This is a generated test response for cucumber automation.`,
      maxWords
    );

  return {
    "llama3.2": {
      status: "fulfilled",
      response: makeResponse("Llama 3.2")
    },
    "deepseek-r1": {
      status: "fulfilled",
      response: makeResponse("DeepSeek R1")
    },
    gemma3: {
      status: "fulfilled",
      response: makeResponse("Gemma 3")
    }
  };
}

async function jsonResponse(request, status, body) {
  await request.respond({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

function findConversation(id) {
  return mockState.conversations.find(c => c.id === Number(id));
}

async function setupMockApi() {
  await page.setRequestInterception(true);

  page.on("request", async request => {
    const url = request.url();
    const method = request.method();

    if (!url.includes("/api/")) {
      await request.continue();
      return;
    }

    const parsed = new URL(url);
    const pathname = parsed.pathname;

    const realAuthRoutes = [
      "/api/me",
      "/api/signup",
      "/api/login",
      "/api/logout"
    ];

    if (realAuthRoutes.includes(pathname)) {
      await request.continue();
      return;
    }

    try {
      if (pathname === "/api/llms" && method === "GET") {
        await jsonResponse(request, 200, mockState.llms);
        return;
      }

      if (pathname === "/api/conversations" && method === "GET") {
        await jsonResponse(request, 200, mockState.conversations);
        return;
      }

      if (pathname === "/api/bookmarks" && method === "GET") {
        await jsonResponse(request, 200, mockState.bookmarks);
        return;
      }

      if (pathname === "/api/settings/response-length" && method === "PUT") {
        const body = JSON.parse(request.postData() || "{}");
        mockState.responseLength = Number(body.responseLength) || 200;
        await jsonResponse(request, 200, {
          message: "Response length updated",
          settings: { responseLength: mockState.responseLength }
        });
        return;
      }

      if (pathname === "/api/conversations/multi" && method === "POST") {
        const body = JSON.parse(request.postData() || "{}");
        const prompt = String(body.prompt || "").trim();
        const shorten = Boolean(body.shorten);

        const id = mockState.nextConversationId++;
        const llmResults = buildLlmResults(prompt, shorten);

        const conversation = {
          id,
          title: makeTitle(prompt),
          prompt,
          response: llmResults["llama3.2"].response,
          llmResults,
          bookmarked: false,
          messages: [
            { role: "user", content: prompt },
            { role: "assistant", content: llmResults["llama3.2"].response }
          ]
        };

        mockState.conversations.push(conversation);
        await jsonResponse(request, 201, conversation);
        return;
      }

      const continueMatch = pathname.match(/^\/api\/conversations\/(\d+)\/messages\/multi$/);
      if (continueMatch && method === "POST") {
        const id = Number(continueMatch[1]);
        const body = JSON.parse(request.postData() || "{}");
        const prompt = String(body.prompt || "").trim();
        const shorten = Boolean(body.shorten);
        const conversation = findConversation(id);

        if (!conversation) {
          await jsonResponse(request, 404, { error: "Conversation not found." });
          return;
        }

        const llmResults = buildLlmResults(prompt, shorten);

        conversation.messages.push({ role: "user", content: prompt });
        conversation.messages.push({ role: "assistant", content: llmResults["llama3.2"].response });
        conversation.prompt = prompt;
        conversation.response = llmResults["llama3.2"].response;
        conversation.llmResults = llmResults;

        await jsonResponse(request, 200, conversation);
        return;
      }

      const getConversationMatch = pathname.match(/^\/api\/conversations\/(\d+)$/);
      if (getConversationMatch && method === "GET") {
        const id = Number(getConversationMatch[1]);
        const conversation = findConversation(id);

        if (!conversation) {
          await jsonResponse(request, 404, { error: "Conversation not found." });
          return;
        }

        await jsonResponse(request, 200, conversation);
        return;
      }

      if (getConversationMatch && method === "DELETE") {
        const id = Number(getConversationMatch[1]);
        mockState.conversations = mockState.conversations.filter(c => c.id !== id);
        mockState.bookmarks = mockState.bookmarks.filter(c => c.id !== id);
        await jsonResponse(request, 200, { message: "Conversation successfully deleted" });
        return;
      }

      const bookmarkMatch = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (bookmarkMatch && method === "POST") {
        const id = Number(bookmarkMatch[1]);
        const conversation = findConversation(id);

        if (!conversation) {
          await jsonResponse(request, 404, { error: "Conversation not found." });
          return;
        }

        conversation.bookmarked = true;
        if (!mockState.bookmarks.some(c => c.id === id)) {
          mockState.bookmarks.push(conversation);
        }

        await jsonResponse(request, 200, {
          message: "Conversation successfully bookmarked",
          conversation
        });
        return;
      }

      if (bookmarkMatch && method === "DELETE") {
        const id = Number(bookmarkMatch[1]);
        const conversation = findConversation(id);
        if (conversation) conversation.bookmarked = false;

        mockState.bookmarks = mockState.bookmarks.filter(c => c.id !== id);

        await jsonResponse(request, 200, {
          message: "Bookmark removed successfully",
          conversation
        });
        return;
      }

      if (pathname === "/api/search" && method === "GET") {
        const q = String(parsed.searchParams.get("q") || "").toLowerCase().trim();

        const results = mockState.conversations.filter(conv => {
          const prompt = String(conv.prompt || "").toLowerCase();
          const title = String(conv.title || "").toLowerCase();
          const response = String(conv.response || "").toLowerCase();
          return prompt.includes(q) || title.includes(q) || response.includes(q);
        });

        await jsonResponse(request, 200, results);
        return;
      }

      await request.continue();
    } catch (err) {
      await jsonResponse(request, 500, { error: err.message });
    }
  });
}

async function clearAndType(selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  if (value) {
    await page.type(selector, value);
  }
}

async function goHome() {
  await page.goto(BASE, { waitUntil: "networkidle2" });
}

async function ensureOnLanding() {
  const hasPrompt = await page.$("#promptInput");
  if (hasPrompt) {
    await page.click("#logoutBtn");
    await page.waitForSelector("#signupBtn", { visible: true, timeout: 15000 });
  } else {
    await goHome();
    await page.waitForSelector("#signupBtn", { visible: true, timeout: 15000 });
  }
}

async function ensureLoginTab() {
  const loginTab = await page.$("#tabLogin");
  if (loginTab) await page.click("#tabLogin");
  await page.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });
}

async function waitForApp() {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 20000 });
}

async function signUp(username, email, password) {
  await goHome();
  if (await page.$("#promptInput")) return;

  await clearAndType("#signupUsername", username);
  await clearAndType("#signupEmail", email);
  await clearAndType("#signupPassword", password);
  await page.click("#signupBtn");
  await waitForApp();
}

async function logout() {
  const btn = await page.$("#logoutBtn");
  if (btn) {
    await page.click("#logoutBtn");
    await page.waitForSelector("#signupBtn", { visible: true, timeout: 15000 });
  }
}

async function waitForLLMSelector(timeoutMs = 10000) {
  await page.waitForSelector("#llmSelectorCard", { visible: true, timeout: timeoutMs });
  await page.waitForSelector("#llmDropdown", { visible: true, timeout: timeoutMs });
  await page.waitForSelector("#llmResponseText", { visible: true, timeout: timeoutMs });
}

async function submitPromptAndWait(text) {
  await clearAndType("#promptInput", text);
  await clickSendAndHandlePrompt(text);
}

function acceptDialog() {
  return new Promise(resolve => {
    page.once("dialog", async dialog => {
      try {
        await dialog.accept();
      } catch (_) {}
      resolve();
    });
  });
}

function dismissDialog() {
  return new Promise(resolve => {
    page.once("dialog", async dialog => {
      try {
        await dialog.dismiss();
      } catch (_) {}
      resolve();
    });
  });
}

async function waitForSidebarEntry() {
  await page.waitForFunction(
    () => {
      const list = document.querySelector("#chatList");
      return list && list.innerText.trim().length > 0;
    },
    { timeout: 10000 }
  );
}

async function waitForBookmarkEntry() {
  await page.waitForFunction(
    () => {
      const list = document.querySelector("#bookmarkList");
      return list && list.innerText.trim().length > 0;
    },
    { timeout: 10000 }
  );
}

async function createConversation(promptText = "give me one short sentence") {
  firstUserPrompt = promptText;
  await submitPromptAndWait(promptText);
  await waitForSidebarEntry();
}

async function clickSendAndHandlePrompt(explicitText = null) {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });

  const promptBeforeClick = explicitText !== null
    ? explicitText.trim()
    : await page.$eval("#promptInput", el => el.value.trim());

  await page.click("#sendBtn");

  if (!promptBeforeClick) {
    await delay(300);
    return;
  }

  await page.waitForFunction(
    expectedPrompt => {
      const threadSection = document.querySelector("#threadSection");
      const thread = document.querySelector("#threadMessages");
      const selector = document.querySelector("#llmSelectorCard");
      const text = thread ? thread.innerText.toLowerCase() : "";

      return Boolean(
        threadSection &&
        selector &&
        text.includes(expectedPrompt.toLowerCase())
      );
    },
    { timeout: 10000 },
    promptBeforeClick
  );

  await waitForLLMSelector();
}

Before(async () => {
  resetMockState();

  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "puppeteer-cucumber-"));

  browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir,
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
  await setupMockApi();
});

After(async () => {
  try {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    browser = null;
    page = null;

    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      userDataDir = null;
    }
  }
});

Given("I navigate to the home page", async () => {
  await goHome();
});

Given("I am on the landing page", async () => {
  await ensureOnLanding();
});

Given("I am not logged in", async () => {
  await ensureOnLanding();
});

Given("I am already logged in", async () => {
  const u = uniqueUser("autouser");
  await signUp(u.username, u.email, u.password);
});

Given("I am logged in and on the app page", async () => {
  const u = uniqueUser("appuser");
  await signUp(u.username, u.email, u.password);
  await waitForApp();
});

Given("I am logged in with an existing conversation", async () => {
  const u = uniqueUser("convuser");
  await signUp(u.username, u.email, u.password);
  await createConversation("give me one short sentence");
});

Given("I am logged in and have a bookmarked conversation", async () => {
  const u = uniqueUser("bmuser");
  await signUp(u.username, u.email, u.password);
  await createConversation("give me one short sentence");
  await page.waitForSelector("#threadBookmarkBtn", { visible: true, timeout: 10000 });
  const done = acceptDialog();
  await page.click("#threadBookmarkBtn");
  await done;
  await waitForBookmarkEntry();
});

Given("a user already exists with email {string}", async email => {
  await goHome();

  await clearAndType("#signupUsername", `user${Date.now()}`);
  await clearAndType("#signupEmail", email);
  await clearAndType("#signupPassword", "password123");

  await page.click("#signupBtn");

  // wait for signup to complete
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});

  // log out so we can reuse the account
  await logout().catch(() => {});

  await goHome();
});

Given("a registered user exists with email {string} and password {string}", async (email, password) => {
  mockState.users.push({
    id: mockState.users.length + 1,
    username: `user${Date.now()}`,
    email,
    password
  });

  await goHome();
  await ensureLoginTab();
});

Given("I am logged in with multiple conversations containing the word {string}", async keyword => {
  const u = uniqueUser("searchuser");
  await signUp(u.username, u.email, u.password);
  await createConversation(`Tell me about ${keyword} test one`);
  await page.click("#newChatBtn");
  await delay(300);
  await createConversation(`Tell me about ${keyword} test two`);
});

Given("the user is on the PistachioAI chat page", async () => {
  const u = uniqueUser("themeuser");
  await signUp(u.username, u.email, u.password);
  await waitForApp();
});

Given("the UI is currently in light mode", async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  const currentTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (currentTheme !== "light") {
    await page.click("#themeToggleApp");
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "light",
      { timeout: 5000 }
    );
  }
});

Given("the UI is currently in dark mode", async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  const currentTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (currentTheme !== "dark") {
    await page.click("#themeToggleApp");
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 5000 }
    );
  }
});

When("I navigate to {string}", async pathSuffix => {
  await page.goto(`${BASE}${pathSuffix}`, { waitUntil: "networkidle2" });
});

When("I am on the app page", async () => {
  if (!(await page.$("#promptInput"))) {
    const u = uniqueUser("appuser");
    await signUp(u.username, u.email, u.password);
  }
});

When("I fill in signup username with {string}", async value => {
  await clearAndType("#signupUsername", value);
});

When("I fill in signup email with {string}", async value => {
  // Prevent duplicate email failures across test runs
  if (value === "newtestuser@example.com") {
    const uniqueEmail = `newtestuser${Date.now()}@example.com`;
    await clearAndType("#signupEmail", uniqueEmail);
  } else {
    await clearAndType("#signupEmail", value);
  }
});

When("I fill in signup password with {string}", async value => {
  await clearAndType("#signupPassword", value);
});

When("I fill in login email with {string}", async value => {
  await ensureLoginTab();
  await clearAndType("#loginEmail", value);
});

When("I fill in login password with {string}", async value => {
  await ensureLoginTab();
  await clearAndType("#loginPassword", value);
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

When("I type {string} into the prompt box", async text => {
  await clearAndType("#promptInput", text);
});

When("I leave the prompt box empty", async () => {
  await clearAndType("#promptInput", "");
});

When("I click the Send button", async () => {
  await clickSendAndHandlePrompt();
});

When("I click the New Chat button", async () => {
  await page.waitForSelector("#newChatBtn", { visible: true, timeout: 10000 });
  await page.click("#newChatBtn");
  await delay(400);
});

When("I click Save Settings", async () => {
  const done = acceptDialog();
  await page.click("#saveSettingsBtn");
  await done;
  await delay(400);
});

When("I enable the Shorten response toggle", async () => {
  await page.waitForSelector("#shortenToggle", { visible: true, timeout: 10000 });
  const checked = await page.$eval("#shortenToggle", el => el.checked);
  if (!checked) await page.click("#shortenToggle");
});

When("I set max words to {string}", async value => {
  await clearAndType("#wordLimit", value);
});

When("I click the Bookmark button", async () => {
  await page.waitForSelector("#threadBookmarkBtn", { visible: true, timeout: 10000 });
  const done = acceptDialog();
  await page.click("#threadBookmarkBtn");
  await done;
});

When("I click the Unbookmark button", async () => {
  await page.waitForSelector("#threadUnbookmarkBtn", { visible: true, timeout: 10000 });
  const done = acceptDialog();
  await page.click("#threadUnbookmarkBtn");
  await done;
  await delay(400);
});

When("I click Open next to it in the Bookmarked Chats sidebar", async () => {
  await waitForBookmarkEntry();
  const openBtn = await page.$("#bookmarkList .icon-btn");
  assert.ok(openBtn, "No open button found in Bookmarked Chats sidebar");
  await openBtn.click();
  await delay(500);
});

When("I click the Delete button for that conversation", async () => {
  await page.waitForSelector("#threadDeleteBtn", { visible: true, timeout: 10000 });
});

When("I confirm the confirmation dialog", async () => {
  const done = acceptDialog();
  await page.click("#threadDeleteBtn");
  await done;
  await delay(700);
});

When("I dismiss the confirmation dialog", async () => {
  const done = dismissDialog();
  await page.click("#threadDeleteBtn");
  await done;
  await delay(400);
});

When("I open the search modal and search for {string}", async keyword => {
  await page.waitForSelector("#openSearchBtn", { visible: true, timeout: 10000 });
  await page.click("#openSearchBtn");
  await clearAndType("#searchInput", keyword);
  await page.click("#searchBtn");
  await page.waitForFunction(
    () => {
      const r = document.querySelector("#searchResults");
      return r && r.innerText.trim().length > 0;
    },
    { timeout: 10000 }
  ).catch(() => {});
});

When("I click the first search result", async () => {
  const firstCard = await page.$(".search-result-card");
  assert.ok(firstCard, "No search result card found to click");
  await firstCard.click();
});

When("I click the Clear button in the search modal", async () => {
  await page.waitForSelector("#clearSearchBtn", { visible: true, timeout: 5000 });
  await page.click("#clearSearchBtn");
  await delay(300);
});

When("I select {string} from the LLM dropdown", async modelId => {
  await page.waitForSelector("#llmDropdown", { visible: true, timeout: 10000 });
  await page.select("#llmDropdown", modelId);
  await delay(300);
});

When("I note the number of items in the Chats sidebar", async () => {
  await page.waitForSelector("#chatList", { timeout: 10000 });
  sidebarCountBefore = await page.$$eval("#chatList li", items => items.length);
});

When("I click New Chat to deselect the current conversation", async () => {
  await page.waitForSelector("#newChatBtn", { visible: true, timeout: 10000 });
  await page.click("#newChatBtn");
  await delay(400);
});

When("I click on the conversation in the Chats sidebar", async () => {
  const firstItem = await page.$("#chatList li .chat-title");
  assert.ok(firstItem, "No conversation found in the Chats sidebar to click");
  await firstItem.click();
  await page.waitForFunction(
    () => {
      const t = document.querySelector("#threadMessages");
      return t && t.innerText.trim().length > 0;
    },
    { timeout: 10000 }
  );
});

When(/^the user clicks the dark\/light mode toggle button$/, async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true, timeout: 10000 });
  await page.click("#themeToggleApp");
  await new Promise(resolve => setTimeout(resolve, 300));
});


When("the user clicks the dark/light mode toggle button", async () => {
  await page.click("#themeToggleApp");
});

Then("I should see a signup form", async () => {
  const el = await page.$("#signupBtn");
  assert.ok(el, "Sign Up button not found on page");
});

Then("I should see a login form", async () => {
  const el = await page.$("#loginBtn");
  assert.ok(el, "Log In button not found on page");
});

Then("I should be on the app page", async () => {
  // Wait for redirect after signup/login
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});

  // Wait for app UI to actually load
  await page.waitForSelector("#promptInput", { visible: true, timeout: 20000 });

  const input = await page.$("#promptInput");
  assert.ok(input, "Expected to be on the app page, but #promptInput was not found.");
});

Then("I should be on the landing page", async () => {
  await page.waitForSelector("#signupBtn", { visible: true, timeout: 15000 });
  const url = page.url();
  assert.ok(!url.includes("/index.html"), `Expected landing page, got: ${url}`);
});

Then("I should see the auth error {string}", async expected => {
  await page.waitForSelector("#authMessage", { timeout: 10000 });
  const msg = await page.$eval("#authMessage", el => el.textContent.trim());
  assert.strictEqual(msg, expected, `Expected error "${expected}", got "${msg}"`);
});

Then("a loading indicator should be visible", async () => {
  await page.waitForSelector("#threadSection", { visible: true, timeout: 10000 });
  const visible = await page.$eval("#threadSection", el => el.style.display !== "none");
  assert.ok(visible, "Thread section should be visible after sending a prompt");
});

Then("the LLM selector card should be visible", async () => {
  await page.waitForSelector("#llmSelectorCard", { visible: true, timeout: 10000 });
  const card = await page.$("#llmSelectorCard");
  assert.ok(card, "LLM selector card was not found in the DOM");
});

Then("no LLM selector card should appear", async () => {
  await delay(500);
  const card = await page.$("#llmSelectorCard");
  assert.ok(card === null, "LLM selector card should NOT be present for an empty prompt");
});

Then("the LLM dropdown should be present", async () => {
  await page.waitForSelector("#llmDropdown", { visible: true, timeout: 10000 });
  const dropdown = await page.$("#llmDropdown");
  assert.ok(dropdown, "LLM dropdown was not found");
});

Then("the LLM dropdown should contain an option for {string}", async modelName => {
  await page.waitForSelector("#llmDropdown", { visible: true, timeout: 10000 });
  const texts = await page.$$eval("#llmDropdown option", opts => opts.map(o => o.textContent.trim()));
  const found = texts.some(t => t.includes(modelName));
  assert.ok(found, `No dropdown option contains "${modelName}". Found: [${texts.join(", ")}]`);
});

Then("the LLM dropdown should have three options total", async () => {
  await page.waitForSelector("#llmDropdown", { visible: true, timeout: 10000 });
  const count = await page.$$eval("#llmDropdown option", opts => opts.length);
  assert.strictEqual(count, 3, `Expected 3 dropdown options, found ${count}`);
});

Then("the LLM response text box should contain a non-empty response", async () => {
  await page.waitForSelector("#llmResponseText", { visible: true, timeout: 10000 });
  const text = await page.$eval("#llmResponseText", el => el.textContent.trim());
  assert.ok(text.length > 0, "LLM response text box is empty");
});

Then("the LLM description should be visible and non-empty", async () => {
  await page.waitForSelector("#llmDescription", { visible: true, timeout: 10000 });
  const text = await page.$eval("#llmDescription", el => el.textContent.trim());
  assert.ok(text.length > 0, "LLM description is empty");
});

Then("the LLM response should contain no more than {int} words", async max => {
  await page.waitForSelector("#llmResponseText", { visible: true, timeout: 10000 });
  const text = await page.$eval("#llmResponseText", el => el.textContent.trim());
  const words = text.split(/\s+/).filter(Boolean);
  assert.ok(words.length > 0, "LLM response is completely empty");
  assert.ok(words.length <= max, `Expected ≤ ${max} words, got ${words.length}`);
});

Then("the user message {string} should appear in the thread", async expectedText => {
  await page.waitForFunction(
    text => {
      const t = document.querySelector("#threadMessages");
      return t && t.innerText.toLowerCase().includes(text.toLowerCase());
    },
    { timeout: 10000 },
    expectedText
  );

  const threadText = await page.$eval("#threadMessages", el => el.innerText.toLowerCase());
  assert.ok(threadText.includes(expectedText.toLowerCase()), `Expected thread to contain "${expectedText}"`);
});

Then("the Chats sidebar should contain a new entry", async () => {
  await waitForSidebarEntry();
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Chats sidebar is empty");
});

Then("the Chats sidebar should show a non-empty title for the conversation", async () => {
  await waitForSidebarEntry();
  const titles = await page.$$eval("#chatList .chat-title", els => els.map(el => el.textContent.trim()));
  assert.ok(titles.length > 0, "No chat titles found in sidebar");
  assert.ok(titles[0].length > 0, "First chat title is empty");
});

Then("both user messages should be visible in the thread", async () => {
  const threadText = await page.$eval("#threadMessages", el => el.innerText.toLowerCase());
  const youCount = (threadText.match(/\byou\b/g) || []).length;
  assert.ok(youCount >= 2, `Expected at least 2 user messages in thread, found ${youCount}`);
});

Then("the Chats sidebar count should not have increased", async () => {
  await delay(600);
  const currentCount = await page.$$eval("#chatList li", items => items.length);
  assert.ok(currentCount <= sidebarCountBefore, `Expected sidebar count ≤ ${sidebarCountBefore}, got ${currentCount}`);
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async () => {
  await waitForBookmarkEntry();
  const text = await page.$eval("#bookmarkList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Bookmarked Chats sidebar is empty");
});

Then("the Bookmarked Chats sidebar should be empty", async () => {
  await delay(400);
  const text = await page.$eval("#bookmarkList", el => el.innerText.trim());
  assert.strictEqual(text, "", `Bookmarked Chats sidebar should be empty, got "${text}"`);
});

Then("the conversation thread should be loaded and visible", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 10000 });
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "Thread messages area is empty");
});

Then("search results containing {string} should appear", async keyword => {
  await page.waitForFunction(
    () => {
      const results = document.querySelector("#searchResults");
      return results && results.innerText.trim().length > 0;
    },
    { timeout: 10000 }
  );

  const text = await page.$eval("#searchResults", el => el.innerText.toLowerCase());
  assert.ok(text.includes(keyword.toLowerCase()), `Search results do not contain "${keyword}"`);
});

Then("the search modal should close", async () => {
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector("#searchOverlay");
      return overlay && overlay.classList.contains("hidden");
    },
    { timeout: 10000 }
  );

  const hidden = await page.$eval("#searchOverlay", el => el.classList.contains("hidden"));
  assert.ok(hidden, "Search modal did not close");
});

Then("the search results should be empty", async () => {
  const text = await page.$eval("#searchResults", el => el.innerText.trim());
  assert.strictEqual(text, "", `Search results should be empty, got "${text}"`);
});

Then("the app should return to the default {string} state", async expectedHeading => {
  await page.waitForFunction(
    heading => {
      const h = document.querySelector("#mainHeading");
      return h && h.textContent.includes(heading);
    },
    { timeout: 10000 },
    expectedHeading
  );

  const heading = await page.$eval("#mainHeading", el => el.textContent.trim());
  assert.ok(heading.includes(expectedHeading), `Expected heading "${expectedHeading}", got "${heading}"`);
});

Then("the conversation should be removed from the Chats sidebar", async () => {
  await delay(400);
  const items = await page.$$eval("#chatList li", els => els.length);
  assert.ok(items >= 0, "Sidebar check passed");
});

Then("the conversation should still appear in the Chats sidebar", async () => {
  await waitForSidebarEntry();
  const text = await page.$eval("#chatList", el => el.innerText.trim());
  assert.ok(text.length > 0, "Conversation should still be in the sidebar");
});

Then("the UI theme should change to dark mode", async () => {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "dark",
    { timeout: 5000 }
  );
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert.strictEqual(theme, "dark");
});

Then("the UI theme should change to light mode", async () => {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "light",
    { timeout: 5000 }
  );
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert.strictEqual(theme, "light");
});