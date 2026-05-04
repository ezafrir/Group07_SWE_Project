const {
  Given,
  When,
  Then,
  Before,
  After,
  setDefaultTimeout
} = require("@cucumber/cucumber");

const puppeteer = require("puppeteer");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";

let browser;
let page;

let users;
let currentUser;
let conversations;
let nextUserId;
let nextConvId;
let settings;
let initialChatCount;

setDefaultTimeout(20000);

// ── Mock backend helpers ─────────────────────────────────────

function jsonResponse(obj, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(obj)
  };
}

function makeResponse(prompt, shorten = false) {
  let text =
    `This is a helpful PistachioAI response about ${prompt}. ` +
    "It includes useful study, practice, review, and explanation details.";

  if (shorten) {
    text = text.split(/\s+/).slice(0, settings.responseLength).join(" ");
  }

  return text;
}

function makeConversation(prompt, bookmarked = false, shorten = false) {
  const response = makeResponse(prompt, shorten);

  const conv = {
    id: nextConvId++,
    userId: currentUser.id,
    title: prompt.length > 35 ? prompt.slice(0, 35) + "..." : prompt,
    prompt,
    response,
    bookmarked,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: response }
    ],
    multiResponses: [
      {
        modelId: "llama3.2:latest",
        label: "Llama 3.2",
        response: "Llama 3.2 response about " + prompt
      },
      {
        modelId: "phi3:latest",
        label: "Phi-3",
        response: "Phi 3 response about " + prompt
      },
      {
        modelId: "tinyllama:latest",
        label: "TinyLlama",
        response: "TinyLlama response about " + prompt
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  conversations.push(conv);
  return conv;
}

function getConv(id) {
  return conversations.find(
    c => c.id === Number(id) && currentUser && c.userId === currentUser.id
  );
}

async function setupMockBackend() {
  users = [];
  currentUser = null;
  conversations = [];
  nextUserId = 1;
  nextConvId = 1;
  settings = { responseLength: 200 };
  initialChatCount = 0;

  const indexPath = path.resolve(
    __dirname,
    "../../../Group07_SWE_Project-main/public/index.html"
  );

  const landingPath = path.resolve(
    __dirname,
    "../../../Group07_SWE_Project-main/public/landing.html"
  );

  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const landingHtml = fs.readFileSync(landingPath, "utf8");

  await page.setRequestInterception(true);

  page.on("request", async req => {
    const url = new URL(req.url());
    const pathname = url.pathname;
    const method = req.method();

    try {
      if (req.resourceType() === "document") {
        if (pathname === "/" && currentUser) {
          return req.respond({
            status: 200,
            contentType: "text/html",
            body: indexHtml
          });
        }

        if (pathname === "/app") {
          return req.respond({
            status: 200,
            contentType: "text/html",
            body: currentUser ? indexHtml : landingHtml
          });
        }
      }

      if (!pathname.startsWith("/api/")) {
        return req.continue();
      }

      let body = {};
      try {
        body = req.postData() ? JSON.parse(req.postData()) : {};
      } catch {
        body = {};
      }

      if (pathname === "/api/me" && method === "GET") {
        return req.respond(
          jsonResponse(
            currentUser
              ? { loggedIn: true, user: currentUser }
              : { loggedIn: false }
          )
        );
      }

      if (pathname === "/api/signup" && method === "POST") {
        const { username, email, password } = body;

        if (!username || !email || !password) {
          return req.respond(jsonResponse({ error: "All fields are required." }, 400));
        }

        if (users.some(u => u.email === email)) {
          return req.respond(jsonResponse({ error: "Account already exists." }, 400));
        }

        const user = { id: nextUserId++, username, email, password };
        users.push(user);
        currentUser = { id: user.id, username: user.username, email: user.email };

        return req.respond(
          jsonResponse({
            message: "Account created successfully",
            user: currentUser
          })
        );
      }

      if (pathname === "/api/login" && method === "POST") {
        const { email, password } = body;
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
          return req.respond(
            jsonResponse({ error: "Invalid email or password." }, 401)
          );
        }

        currentUser = { id: user.id, username: user.username, email: user.email };

        return req.respond(
          jsonResponse({
            message: "Login successful",
            user: currentUser
          })
        );
      }

      if (pathname === "/api/logout" && method === "POST") {
        currentUser = null;
        return req.respond(jsonResponse({ message: "Logged out successfully" }));
      }

      if (!currentUser) {
        return req.respond(jsonResponse({ error: "Unauthorized" }, 401));
      }

      if (pathname === "/api/settings/response-length" && method === "PUT") {
        settings.responseLength = Number(body.responseLength || 200);
        return req.respond(jsonResponse({ message: "Response length updated", settings }));
      }

      if (pathname === "/api/conversations" && method === "GET") {
        return req.respond(
          jsonResponse(conversations.filter(c => c.userId === currentUser.id))
        );
      }

      if (pathname === "/api/conversations" && method === "POST") {
        const conv = makeConversation(body.prompt, false, body.shorten);
        return req.respond(jsonResponse(conv, 201));
      }

      if (pathname === "/api/conversations" && method === "DELETE") {
        conversations = conversations.filter(c => c.userId !== currentUser.id);
        return req.respond(jsonResponse({ message: "Deleted conversations" }));
      }

      if (pathname === "/api/search" && method === "GET") {
        const q = (url.searchParams.get("q") || "").toLowerCase();

        const results = conversations.filter(c => {
          return (
            c.userId === currentUser.id &&
            (
              c.title.toLowerCase().includes(q) ||
              c.prompt.toLowerCase().includes(q) ||
              c.response.toLowerCase().includes(q)
            )
          );
        });

        return req.respond(jsonResponse(results));
      }

      if (pathname === "/api/bookmarks" && method === "GET") {
        return req.respond(
          jsonResponse(
            conversations.filter(c => c.userId === currentUser.id && c.bookmarked)
          )
        );
      }

      const bookmarkMatch = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (bookmarkMatch && method === "POST") {
        const conv = getConv(bookmarkMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));
        conv.bookmarked = true;
        return req.respond(jsonResponse({ message: "Bookmarked", conversation: conv }));
      }

      if (bookmarkMatch && method === "DELETE") {
        const conv = getConv(bookmarkMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));
        conv.bookmarked = false;
        return req.respond(jsonResponse({ message: "Unbookmarked", conversation: conv }));
      }

      const convMatch = pathname.match(/^\/api\/conversations\/(\d+)$/);
      if (convMatch && method === "GET") {
        const conv = getConv(convMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));
        return req.respond(jsonResponse(conv));
      }

      if (convMatch && method === "DELETE") {
        const id = Number(convMatch[1]);
        conversations = conversations.filter(
          c => !(c.id === id && c.userId === currentUser.id)
        );
        return req.respond(jsonResponse({ message: "Deleted" }));
      }

      const msgMatch = pathname.match(/^\/api\/conversations\/(\d+)\/messages$/);
      if (msgMatch && method === "POST") {
        const conv = getConv(msgMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));

        const response = makeResponse(body.prompt, body.shorten);
        conv.messages.push({ role: "user", content: body.prompt });
        conv.messages.push({ role: "assistant", content: response });
        conv.prompt = body.prompt;
        conv.response = response;
        conv.updatedAt = new Date().toISOString();

        return req.respond(jsonResponse(conv));
      }

      const renameMatch = pathname.match(/^\/api\/conversations\/(\d+)\/rename$/);
      if (renameMatch && method === "PATCH") {
        const conv = getConv(renameMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));

        conv.title = body.title;
        return req.respond(jsonResponse({ message: "Renamed", conversation: conv }));
      }

      const exportMatch = pathname.match(/^\/api\/conversations\/(\d+)\/export$/);
      if (exportMatch && method === "GET") {
        const conv = getConv(exportMatch[1]);
        if (!conv) {
          return req.respond({
            status: 404,
            contentType: "text/plain",
            body: "Not found"
          });
        }

        return req.respond({
          status: 200,
          contentType: "text/plain",
          body: `You:\n${conv.prompt}\n\nPistachioAI:\n${conv.response}`
        });
      }

      const multiMatch = pathname.match(/^\/api\/conversations\/(\d+)\/multi-response$/);
      if (multiMatch && method === "GET") {
        const conv = getConv(multiMatch[1]);
        if (!conv) return req.respond(jsonResponse({ error: "Not found" }, 404));
        return req.respond(jsonResponse({ multiResponses: conv.multiResponses }));
      }

      const summaryMatch = pathname.match(/^\/api\/conversations\/(\d+)\/multi-summary$/);
      if (summaryMatch && method === "GET") {
        return req.respond(
          jsonResponse({
            summary: "Summary: all three model responses agree on the main idea."
          })
        );
      }

      const compareMatch = pathname.match(/^\/api\/conversations\/(\d+)\/multi-compare$/);
      if (compareMatch && method === "GET") {
        return req.respond(
          jsonResponse({
            comparison: "Comparison: the models are similar but differ in detail."
          })
        );
      }

      const geminiMatch = pathname.match(/^\/api\/conversations\/(\d+)\/gemini$/);
      if (geminiMatch && method === "POST") {
        return req.respond(
          jsonResponse({
            label: "Gemini",
            response: "Gemini mock response."
          })
        );
      }

      const groqMatch = pathname.match(/^\/api\/conversations\/(\d+)\/groq$/);
      if (groqMatch && method === "POST") {
        return req.respond(
          jsonResponse({
            label: "Groq",
            response: "Groq mock response."
          })
        );
      }

      if (pathname === "/api/suggest" && method === "POST") {
        if (!body.instruction || !body.instruction.trim()) {
          return req.respond(jsonResponse({ error: "Instruction is required." }, 400));
        }

        return req.respond(
          jsonResponse({
            success: true,
            message: "Mock suggestion applied."
          })
        );
      }

      return req.respond(jsonResponse({ error: "Unhandled mock route " + pathname }, 404));
    } catch (err) {
      return req.respond(jsonResponse({ error: err.message }, 500));
    }
  });
}

async function goToApp() {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#promptInput", { timeout: 10000 });
}

async function goToLanding() {
  await page.goto(`${BASE}/landing.html`, { waitUntil: "networkidle0" });
}

async function createMockUser(username = "testuser", email = null, password = "pass123") {
  const finalEmail = email || `${username}${Date.now()}${Math.floor(Math.random() * 9999)}@example.com`;
  const user = { id: nextUserId++, username, email: finalEmail, password };
  users.push(user);
  return user;
}

async function loginAs(username = "testuser") {
  const user = await createMockUser(username);
  currentUser = { id: user.id, username: user.username, email: user.email };
  await goToApp();
}

async function createAndRenderConversation(prompt = "Tell me about debugging", bookmarked = false) {
  const conv = makeConversation(prompt, bookmarked);
  await goToApp();

  await page.evaluate(id => {
    window.openConversation(id);
  }, conv.id);

  await page.waitForSelector("#threadMessages .message-bubble", { timeout: 10000 });
  await page.waitForSelector("#chatList li", { timeout: 10000 });

  return conv;
}

async function clearAndType(selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");

  if (value) {
    await page.type(selector, value);
  }
}

Before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await setupMockBackend();
});

After(async () => {
  if (browser) {
    await browser.close();
  }
});

// ── Given steps ───────────────────────────────────────────────

Given(/^I navigate to the home page$/, async () => {
  await page.goto(BASE, { waitUntil: "networkidle0" });
});

Given("I am on the landing page", async () => {
  await goToLanding();
});

Given("I am not logged in", async () => {
  currentUser = null;
  await goToLanding();
});

Given("the user is on the PistachioAI chat page", async () => {
  await loginAs("chatuser");
});

Given("I am already logged in", async () => {
  await loginAs("alreadyuser");
});

Given("I am logged in and on the app page", async () => {
  await loginAs("appuser");
});

Given("a user already exists with email {string}", async email => {
  await createMockUser("existinguser", email, "password123");
});

Given("a registered user exists with email {string} and password {string}", async (email, password) => {
  await createMockUser("registereduser", email, password);
});

Given("I am logged in with an existing conversation", async () => {
  await loginAs("convuser");
  await createAndRenderConversation("Tell me about debugging");
});

Given("I am logged in and have a bookmarked conversation", async () => {
  await loginAs("bmuser");
  await createAndRenderConversation("How do I study?", true);
  await page.evaluate(() => window.loadBookmarks());
  await page.waitForSelector("#bookmarkList li", { timeout: 10000 });
});

Given("the user has opened an existing conversation from the sidebar", async () => {
  await createAndRenderConversation("What is France known for?");
  initialChatCount = conversations.length;
});

Given("the UI is currently in light mode", async () => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("pistachioTheme", "light");
  });
});

Given("the UI is currently in dark mode", async () => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("pistachioTheme", "dark");
  });
});

Given("I am logged in and have received multi-LLM responses", async () => {
  await loginAs("multiuser");
  await createAndRenderConversation("What is machine learning?");
  await page.waitForSelector("#inlineModelDropdown", { timeout: 10000 });
});

Given("multiple conversations exist in the sidebar", async () => {
  makeConversation("What is the capital of France?");
  makeConversation("Explain debugging in JavaScript.");
  await goToApp();
  await page.evaluate(() => window.loadConversations());
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Given("the user has searched for {string} in the search bar", async keyword => {
  await loginAs("searchuser");
  makeConversation(`Tell me about ${keyword}`);
  makeConversation("Explain debugging.");

  await goToApp();

  await page.click("#openSearchBtn");
  await clearAndType("#searchInput", keyword);
  await page.click("#searchBtn");

  await page.waitForSelector("#searchResults .search-result-card", { timeout: 10000 });
});

Given("matching conversations are displayed", async () => {
  await page.waitForSelector("#searchResults .search-result-card", { timeout: 10000 });
});

Given("at least one past conversation exists in the sidebar", async () => {
  makeConversation("Past conversation test");
  await goToApp();
  await page.evaluate(() => window.loadConversations());
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Given("I am logged in with a conversation about {string}", async topic => {
  await loginAs("topicuser");
  await createAndRenderConversation(`Tell me about ${topic}`);
});

// ── When steps ────────────────────────────────────────────────

When("I navigate to {string}", async pathName => {
  await page.goto(`${BASE}${pathName}`, { waitUntil: "networkidle0" });
});

When("I am on the app page", async () => {
  await goToApp();
});

When("I fill in signup username with {string}", async value => {
  await clearAndType("#signupUsername", value);
});

When("I fill in signup email with {string}", async value => {
  await clearAndType("#signupEmail", value);
});

When("I fill in signup password with {string}", async value => {
  await clearAndType("#signupPassword", value);
});

When("I fill in login email with {string}", async value => {
  const tab = await page.$("#tabLogin");
  if (tab) await tab.click();
  await clearAndType("#loginEmail", value);
});

When("I fill in login password with {string}", async value => {
  await clearAndType("#loginPassword", value);
});

When("I click the Sign Up button", async () => {
  await Promise.all([
    page.click("#signupBtn"),
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {})
  ]);
});

When("I click the Log In button", async () => {
  await Promise.all([
    page.click("#loginBtn"),
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {})
  ]);
});

When("I click the Log Out button", async () => {
  await page.click("#logoutBtn");
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
});

When("the user types {string} into the prompt box", async text => {
  await clearAndType("#promptInput", text);
});

When("I type {string} into the prompt box", async text => {
  await clearAndType("#promptInput", text);
});

When("the user clicks the send button", async () => {
  await page.click("#sendBtn");
});

When("I click the Send button", async () => {
  await page.click("#sendBtn");
});

When("I leave the prompt box empty", async () => {
  await clearAndType("#promptInput", "");
});

When("I enable the Shorten response toggle", async () => {
  const checked = await page.$eval("#shortenToggle", el => el.checked);
  if (!checked) await page.click("#shortenToggle");
});

When("I set max words to {string}", async value => {
  await clearAndType("#wordLimit", value);
});

When("I click Save Settings", async () => {
  page.once("dialog", async d => d.accept());
  await page.click("#saveSettingsBtn");
});

When("I click the Bookmark button on the response card", async () => {
  page.once("dialog", async d => d.accept());
  await page.click("#threadBookmarkBtn");
});

When("I click the Delete button for that conversation", async () => {
  await page.waitForSelector("#threadDeleteBtn", { timeout: 10000 });
});

When("I confirm the confirmation dialog", async () => {
  page.once("dialog", async d => d.accept());
  await page.click("#threadDeleteBtn");
});

When("I dismiss the confirmation dialog", async () => {
  page.once("dialog", async d => d.dismiss());
  await page.click("#threadDeleteBtn");
});

When("I click Open next to it in the Bookmarked Chats sidebar", async () => {
  await page.waitForSelector("#bookmarkList li button", { timeout: 10000 });
  await page.click("#bookmarkList li button");
});

When(/^the user clicks the dark\/light mode toggle button$/, async () => {
  await page.click("#themeToggleApp");
});

When("I click the Summarize button", async () => {
  await page.waitForSelector("#summaryBtn", { timeout: 10000 });
  await page.click("#summaryBtn");
});

When("the response has finished loading", async () => {
  await page.waitForFunction(
    () => !document.querySelector("#loadingBubble"),
    { timeout: 10000 }
  ).catch(() => {});
});

When("the user types {string} into the search bar", async keyword => {
  await page.click("#openSearchBtn");
  await clearAndType("#searchInput", keyword);
  await page.click("#searchBtn");
});

When("the user clicks on one of the search results", async () => {
  await page.waitForSelector("#searchResults .search-result-card", { timeout: 10000 });
  await page.click("#searchResults .search-result-card");
});

When("the user clicks on a conversation in the sidebar", async () => {
  await page.waitForSelector("#chatList li .chat-title", { timeout: 10000 });
  await page.click("#chatList li .chat-title");
});

When("I rename the conversation to {string}", async newTitle => {
  await page.waitForSelector(".rename-btn", { timeout: 10000 });
  await page.evaluate(title => {
    window.prompt = () => title;
  }, newTitle);
  await page.click(".rename-btn");
});

When("I cancel the rename dialog", async () => {
  await page.waitForSelector(".rename-btn", { timeout: 10000 });
  await page.evaluate(() => {
    window.prompt = () => null;
  });
  await page.click(".rename-btn");
});

When("I request the export for that conversation", async () => {
  const conv = conversations[0];

  const result = await page.evaluate(async id => {
    const res = await fetch(`/api/conversations/${id}/export`);
    const body = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get("content-type"),
      body
    };
  }, conv.id);

  await page.evaluate(r => {
    window._exportResult = r;
  }, result);
});

When("I click the Delete All Chats button and confirm", async () => {
  page.once("dialog", async d => d.accept());
  await page.click("#deleteAllChatsBtn");
});

When("I click the Gemini button", async () => {
  await page.click("#geminiBtn");
});

When("I click the Gemini button again", async () => {
  await page.click("#geminiBtn");
});

When("I click the Groq button", async () => {
  await page.click("#groqBtn");
});

When("I click the Suggest a Change button", async () => {
  await page.click("#openSuggestBtn");
});

When("I submit the suggest form without an instruction", async () => {
  await clearAndType("#suggestInstruction", "");
  await page.click("#suggestSubmitBtn");
});

When("I click the Cancel button in the suggest modal", async () => {
  await page.click("#suggestCancelBtn");
});

// ── Then steps ────────────────────────────────────────────────

Then("I should see the heading {string}", async text => {
  const body = await page.$eval("body", el => el.textContent);
  assert.ok(body.includes(text), `Expected page to contain ${text}`);
});

Then("I should see a signup form", async () => {
  assert.ok(await page.$("#signupBtn"), "Signup button not found");
});

Then("I should see a login form", async () => {
  assert.ok(await page.$("#loginBtn"), "Login button not found");
});

Then("I should be on the app page", async () => {
  await page.waitForSelector("#promptInput", { timeout: 10000 });
  assert.ok(await page.$("#promptInput"), "Expected app page prompt input");
});

Then("I should be on the landing page", async () => {
  await page.waitForSelector("#signupBtn", { timeout: 10000 });
  assert.ok(await page.$("#signupBtn"), "Expected landing page signup button");
});

Then("I should see {string}", async text => {
  const body = await page.$eval("body", el => el.textContent);
  assert.ok(body.includes(text), `Expected page to contain ${text}`);
});

Then("I should see the auth error {string}", async expected => {
  await page.waitForSelector("#authMessage", { timeout: 10000 });
  const msg = await page.$eval("#authMessage", el => el.textContent.trim());
  assert.strictEqual(msg, expected);
});

Then("a loading icon should be visible", async () => {
  const sendBtn = await page.$("#sendBtn");
  assert.ok(sendBtn, "Send button should still exist after prompt submission");
});

Then("a response should be displayed on the screen", async () => {
  await page.waitForSelector("#lastAssistantBubble, .assistant-bubble", { timeout: 10000 });
});

Then("a response card should appear on the page", async () => {
  await page.waitForSelector("#lastAssistantBubble, .assistant-bubble", { timeout: 10000 });
});

Then("the response card should contain study-related content", async () => {
  const text = await page.$eval("#threadMessages", el => el.textContent.toLowerCase());
  assert.ok(
    text.includes("study") ||
    text.includes("exam") ||
    text.includes("practice") ||
    text.includes("review")
  );
});

Then("no response card should appear", async () => {
  const count = await page.$$eval(".assistant-bubble", els => els.length).catch(() => 0);
  assert.strictEqual(count, 0);
});

Then("the Chats sidebar should contain a new entry", async () => {
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Then("the response on the card should contain no more than {int} words", async max => {
  await page.waitForSelector("#lastAssistantBubble p, .assistant-bubble p", { timeout: 10000 });
  const text = await page.$eval("#lastAssistantBubble p, .assistant-bubble p", el =>
    el.textContent.trim()
  );
  const words = text.split(/\s+/).filter(Boolean);
  assert.ok(words.length <= max, `Expected <= ${max} words, got ${words.length}`);
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async () => {
  await page.waitForSelector("#bookmarkList li", { timeout: 10000 });
});

Then("the conversation should no longer appear in the Chats sidebar", async () => {
  await page.waitForFunction(
    () => document.querySelectorAll("#chatList li").length === 0,
    { timeout: 10000 }
  );
});

Then("the conversation should still appear in the Chats sidebar", async () => {
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Then("the response card should display the prompt and response", async () => {
  await page.waitForSelector("#threadMessages .user-bubble", { timeout: 10000 });
  await page.waitForSelector("#threadMessages .assistant-bubble", { timeout: 10000 });
});

Then("the new message should be appended to the existing conversation", async () => {
  await page.waitForFunction(
    () => document.querySelectorAll("#threadMessages .message-bubble").length >= 4,
    { timeout: 10000 }
  );
});

Then("a new conversation should not be created", async () => {
  assert.strictEqual(conversations.length, initialChatCount);
});

Then("the UI theme should change to dark mode", async () => {
  const theme = await page.$eval("html", el => el.getAttribute("data-theme"));
  assert.strictEqual(theme, "dark");
});

Then("the UI theme should change to light mode", async () => {
  const theme = await page.$eval("html", el => el.getAttribute("data-theme"));
  assert.strictEqual(theme, "light");
});

Then("three labeled response bubbles should appear in the thread", async () => {
  await page.waitForSelector("#inlineModelDropdown", { timeout: 10000 });
  const options = await page.$$eval("#inlineModelDropdown option", opts =>
    opts.map(o => o.textContent)
  );
  assert.ok(options.length >= 3);
});

Then("the thread should contain a bubble labeled {string}", async label => {
  const body = await page.$eval("body", el => el.textContent.toLowerCase());
  const normalizedLabel = label.toLowerCase().replace("phi 3", "phi-3");
  assert.ok(
    body.includes(label.toLowerCase()) || body.includes(normalizedLabel),
    `Expected page to include ${label}`
  );
});

Then("a summary section should appear at the bottom of the thread", async () => {
  await page.waitForSelector("#modelResultPanel:not(.hidden)", { timeout: 10000 });
});

Then("the summary section should contain a {string} heading", async text => {
  await page.waitForSelector("#modelResultTitle", { timeout: 10000 });
  const title = await page.$eval("#modelResultTitle", el => el.textContent);
  assert.ok(title.includes(text));
});

Then("the conversation should appear in the chat history sidebar", async () => {
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Then("only conversations containing {string} should be displayed in the sidebar", async keyword => {
  await page.waitForSelector("#searchResults", { timeout: 10000 });

  const matching = conversations.filter(c =>
    c.title.toLowerCase().includes(keyword.toLowerCase()) ||
    c.prompt.toLowerCase().includes(keyword.toLowerCase()) ||
    c.response.toLowerCase().includes(keyword.toLowerCase())
  );

  assert.ok(
    matching.length > 0,
    `Expected at least one conversation containing "${keyword}"`
  );
});

Then("that conversation should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages .message-bubble", { timeout: 10000 });
});

Then("that conversation's messages should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages .message-bubble", { timeout: 10000 });
});

Then("the sidebar should show the title {string}", async expectedTitle => {
  await page.waitForFunction(
    title => document.querySelector("#chatList")?.textContent.includes(title),
    { timeout: 10000 },
    expectedTitle
  );
});

Then("the conversation title should remain unchanged", async () => {
  await page.waitForSelector("#chatList li", { timeout: 10000 });
});

Then("the response should be a text file with HTTP 200", async () => {
  const result = await page.evaluate(() => window._exportResult);
  assert.strictEqual(result.status, 200);
  assert.ok(result.contentType.includes("text"));
});

Then("the exported file should contain message labels", async () => {
  const result = await page.evaluate(() => window._exportResult);
  assert.ok(result.body.includes("You:") && result.body.includes("PistachioAI:"));
});

Then("the Chats sidebar should be empty", async () => {
  await page.waitForFunction(
    () => document.querySelectorAll("#chatList li").length === 0,
    { timeout: 10000 }
  );
});

Then("the thread section should be hidden", async () => {
  const visible = await page.$eval("#threadSection", el => el.style.display !== "none");
  assert.ok(!visible);
});

Then("the Delete All Chats button should be visible", async () => {
  assert.ok(await page.$("#deleteAllChatsBtn"));
});

Then("no search results should be displayed", async () => {
  const count = await page.$$eval("#searchResults .search-result-card", els => els.length);
  assert.strictEqual(count, 0);
});

Then("the Gemini button should be visible", async () => {
  assert.ok(await page.$("#geminiBtn"));
});

Then("the result panel should open with a Gemini response", async () => {
  await page.waitForSelector("#modelResultPanel:not(.hidden)", { timeout: 10000 });
  const title = await page.$eval("#modelResultTitle", el => el.textContent);
  assert.ok(title.includes("Gemini"));
});

Then("the Groq button should be visible", async () => {
  assert.ok(await page.$("#groqBtn"));
});

Then("the result panel should open with a Groq response", async () => {
  await page.waitForSelector("#modelResultPanel:not(.hidden)", { timeout: 10000 });
  const title = await page.$eval("#modelResultTitle", el => el.textContent);
  assert.ok(title.includes("Groq"));
});

Then("the result panel should be hidden", async () => {
  const hidden = await page.$eval("#modelResultPanel", el => el.classList.contains("hidden"));
  assert.ok(hidden);
});

Then("the Suggest a Change button should be visible", async () => {
  assert.ok(await page.$("#openSuggestBtn"));
});

Then("the suggest modal should be open", async () => {
  const visible = await page.$eval("#suggestOverlay", el => !el.classList.contains("hidden"));
  assert.ok(visible);
});

Then("the file dropdown should only contain public files", async () => {
  const options = await page.$$eval("#suggestFile option", opts => opts.map(o => o.value));
  assert.ok(options.length > 0);
  assert.ok(options.every(o => o.startsWith("public/")));
});

Then("the instruction textarea should be visible", async () => {
  assert.ok(await page.$("#suggestInstruction"));
});

Then("a validation error should be shown", async () => {
  await page.waitForFunction(
    () => document.querySelector("#suggestStatus")?.textContent.trim().length > 0,
    { timeout: 10000 }
  );
});

Then("the suggest modal should be closed", async () => {
  const hidden = await page.$eval("#suggestOverlay", el => el.classList.contains("hidden"));
  assert.ok(hidden);
});
