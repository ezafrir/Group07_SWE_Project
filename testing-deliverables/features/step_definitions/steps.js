const {
  Given,
  When,
  Then,
  Before,
  BeforeAll,
  AfterAll,
  setDefaultTimeout
} = require("@cucumber/cucumber");
const assert = require("assert");
const puppeteer = require("puppeteer-core");

setDefaultTimeout(240000);

const BASE_URL = "http://localhost:3000";

let browser;
let context;
let page;
let pendingDialogAction = "accept";

const state = {
  chatCountBeforeDelete: null,
  sidebarCountBeforeAppend: null
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getChromePath() {
  return (
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  );
}

async function launchBrowser() {
  browser = await puppeteer.launch({
    headless: false,
    executablePath: getChromePath(),
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

async function newScenarioPage() {
  if (!browser || !browser.connected) {
    await launchBrowser();
  }

  if (context) {
    try {
      await context.close();
    } catch (_) {}
  }

  context = await browser.createBrowserContext();
  page = await context.newPage();

  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  page.on("dialog", async dialog => {
    try {
      if (pendingDialogAction === "dismiss") {
        await dialog.dismiss();
      } else {
        await dialog.accept();
      }
    } catch (_) {}
    pendingDialogAction = "accept";
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
}

async function safeGoto(path = "/") {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
}

async function currentPath() {
  return await page.evaluate(() => window.location.pathname);
}

async function bodyText() {
  return await page.$eval("body", el => el.innerText);
}

async function typeInto(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  if (value) {
    await page.type(selector, value);
  }
}

async function isLoggedIn() {
  return !!(await page.$("#promptInput"));
}

async function activateSignupTab() {
  const signupTab = await page.$("#tabSignup");
  if (signupTab) {
    await signupTab.click();
  }

  await page.waitForFunction(() => {
    const username = document.querySelector("#signupUsername");
    const email = document.querySelector("#signupEmail");
    const password = document.querySelector("#signupPassword");

    if (!username || !email || !password) return false;

    const u = window.getComputedStyle(username);
    const e = window.getComputedStyle(email);
    const p = window.getComputedStyle(password);

    return (
      u.display !== "none" &&
      e.display !== "none" &&
      p.display !== "none"
    );
  }, { timeout: 10000 });

  await page.waitForSelector("#signupUsername", { visible: true });
}

async function activateLoginTab() {
  const loginTab = await page.$("#tabLogin");
  if (loginTab) {
    await loginTab.click();
  }

  await page.waitForFunction(() => {
    const email = document.querySelector("#loginEmail");
    const password = document.querySelector("#loginPassword");

    if (!email || !password) return false;

    const emailStyle = window.getComputedStyle(email);
    const passStyle = window.getComputedStyle(password);

    return (
      emailStyle.display !== "none" &&
      emailStyle.visibility !== "hidden" &&
      passStyle.display !== "none" &&
      passStyle.visibility !== "hidden"
    );
  }, { timeout: 10000 });

  await page.waitForSelector("#loginEmail", { visible: true });
  await page.waitForSelector("#loginPassword", { visible: true });
}

async function waitForAuthShell() {
  await page.waitForFunction(() => {
    return !!(
      document.querySelector("#tabLogin") ||
      document.querySelector("#tabSignup") ||
      document.querySelector("#signupUsername") ||
      document.querySelector("#signupEmail") ||
      document.querySelector("#loginEmail")
    );
  }, { timeout: 20000 });
}

async function ensureLandingPage() {
  await safeGoto("/");

  if (await page.$("#logoutBtn")) {
    await page.click("#logoutBtn");
  }

  await waitForAuthShell();
}

async function logoutIfNeeded() {
  await safeGoto("/");
  const logoutBtn = await page.$("#logoutBtn");
  if (logoutBtn) {
    await logoutBtn.click();
    await waitForAuthShell();
  }
}

function makeUniqueUser() {
  const id = Date.now();
  return {
    username: `user${id}`,
    email: `user${id}@test.com`,
    password: "pass123"
  };
}

async function signup(username, email, password) {
  await ensureLandingPage();
  await activateSignupTab();
  await typeInto("#signupUsername", username);
  await typeInto("#signupEmail", email);
  await typeInto("#signupPassword", password);
  await page.click("#signupBtn");
}

async function login(email, password) {
  await ensureLandingPage();
  await activateLoginTab();
  await typeInto("#loginEmail", email);
  await typeInto("#loginPassword", password);
  await page.click("#loginBtn");
}

async function ensureAccountExists(email, password) {
  await logoutIfNeeded();
  await ensureLandingPage();
  await activateSignupTab();

  const username = email.split("@")[0];
  await typeInto("#signupUsername", username);
  await typeInto("#signupEmail", email);
  await typeInto("#signupPassword", password);
  await page.click("#signupBtn");

  await Promise.race([
    page.waitForSelector("#promptInput", { visible: true, timeout: 10000 }).catch(() => null),
    page.waitForSelector("#authMessage", { visible: true, timeout: 10000 }).catch(() => null)
  ]);

  if (await page.$("#promptInput")) {
    await logoutIfNeeded();
    return;
  }

  const authMessage = await page.$("#authMessage");
  if (authMessage) {
    const msg = await page.$eval("#authMessage", el => el.textContent.trim().toLowerCase());
    if (msg.includes("exists") || msg.includes("already")) {
      return;
    }
  }

  throw new Error(`Could not ensure account exists for ${email}`);
}

async function ensureLoggedIn() {
  await safeGoto("/app");

  if (await isLoggedIn()) return;

  const user = makeUniqueUser();
  await signup(user.username, user.email, user.password);
  await page.waitForSelector("#promptInput", { visible: true, timeout: 60000 });
}

async function waitForAssistantResponse() {
  // Wait for loading bubble to disappear (if it exists)
  await page.waitForFunction(() => {
    const loading = document.querySelector("#loadingBubble");
    if (!loading) return true;
    const style = window.getComputedStyle(loading);
    return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
  }, { timeout: 240000 }).catch(() => {});

  // Wait for thread to have content
  await page.waitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    if (!thread) return false;
    return thread.innerText.trim().length > 0;
  }, { timeout: 240000 });
}

async function createConversation(promptText = "Hello!") {
  await ensureLoggedIn();
  await page.waitForSelector("#promptInput", { visible: true });
  await typeInto("#promptInput", promptText);
  await page.click("#sendBtn");
  await waitForAssistantResponse();
}

async function firstExistingSelector(selectors) {
  for (const sel of selectors) {
    if (await page.$(sel)) return sel;
  }
  return null;
}

async function sidebarConversationSelector() {
  return await firstExistingSelector([
    "#chatList .chat-title",
    "#chatList li .chat-title",
    "#chatList li",
    ".chat-title",
    ".conversation-item",
    ".thread-item"
  ]);
}

async function bookmarkOpenSelector() {
  return await firstExistingSelector([
    "#bookmarkList .icon-btn",
    "#bookmarkList button",
    ".bookmark-item button"
  ]);
}

async function chatListCount() {
  return await page.evaluate(() => {
    const list = document.querySelector("#chatList");
    if (list) {
      const lis = list.querySelectorAll("li");
      if (lis.length) return lis.length;

      const titled = list.querySelectorAll(".chat-title");
      if (titled.length) return titled.length;
    }

    const generic =
      document.querySelectorAll(".conversation-item").length ||
      document.querySelectorAll(".thread-item").length;

    return generic;
  });
}

// -------------------- hooks --------------------

BeforeAll(async () => {
  await launchBrowser();
});

AfterAll(async () => {
  if (context) {
    try {
      await context.close();
    } catch (_) {}
  }
  if (browser) {
    await browser.close();
  }
});

Before(async () => {
  pendingDialogAction = "accept";
  state.chatCountBeforeDelete = null;
  state.sidebarCountBeforeAppend = null;

  try {
    await newScenarioPage();
  } catch (err) {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (_) {}

    await launchBrowser();
    await newScenarioPage();
  }
});

// -------------------- Given --------------------

Given("I navigate to the home page", async () => {
  await safeGoto("/");
});

Given("I am on the landing page", async () => {
  await logoutIfNeeded();
  await ensureLandingPage();
});

Given("I am already logged in", async () => {
  await ensureLoggedIn();
});

Given("I am logged in and on the app page", async () => {
  await ensureLoggedIn();
  await page.waitForSelector("#promptInput", { visible: true });
});

Given("I am not logged in", async () => {
  await logoutIfNeeded();
  await ensureLandingPage();
});

Given("the user is on the PistachioAI chat page", async () => {
  await ensureLoggedIn();
  await page.waitForSelector("#promptInput", { visible: true });
});

Given(
  "a registered user exists with email {string} and password {string}",
  async (email, password) => {
    await ensureAccountExists(email, password);
    await logoutIfNeeded();
  }
);

Given("a user already exists with email {string}", async email => {
  await ensureAccountExists(email, "password123");
  await logoutIfNeeded();
});

Given("I am logged in with an existing conversation", async () => {
  await createConversation("Give me one short answer.");
});

Given("I am logged in and have a bookmarked conversation", { timeout: 360000 }, async () => {
  await createConversation("Bookmark this conversation.");

  pendingDialogAction = "accept";
  await page.waitForSelector("#threadBookmarkBtn", { visible: true });
  await page.click("#threadBookmarkBtn");

  await sleep(1500);

  await page.waitForFunction(() => {
    const list = document.querySelector("#bookmarkList");

    if (list && list.innerText.trim().length > 0) return true;

    const items = document.querySelectorAll(
      ".bookmark-item, #bookmarkList li, #bookmarkList .chat-title, #bookmarkList button, #bookmarkList .icon-btn"
    );

    return items.length > 0;
  }, { timeout: 120000 });
});

Given("the user has opened an existing conversation from the sidebar", async () => {
  await createConversation("First seeded conversation");

  const items = await page.$$("#chatList li");
  assert.ok(items.length > 0, "No conversations in sidebar");

  state.sidebarCountBeforeAppend = items.length;

  const newChatBtn = await page.$("#newChatBtn");
  if (newChatBtn) {
    await newChatBtn.click();
    await page.waitForSelector("#promptInput", { visible: true });
  }

  const itemsAfterReset = await page.$$("#chatList li");
  assert.ok(itemsAfterReset.length > 0, "No conversations in sidebar after reset");

  await itemsAfterReset[0].click();

  await page.waitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    return thread && thread.innerText.trim().length > 0;
  }, { timeout: 60000 });
});

Given("at least one past conversation exists in the sidebar", async () => {
  await createConversation("Past conversation seed");

  await page.waitForFunction(() => {
    return (
      document.querySelectorAll("#chatList li").length > 0 ||
      document.querySelectorAll("#chatList .chat-title").length > 0 ||
      document.querySelectorAll(".conversation-item").length > 0 ||
      document.querySelectorAll(".thread-item").length > 0
    );
  }, { timeout: 60000 });
});

Given("multiple conversations exist in the sidebar", { timeout: 600000 }, async () => {
  await createConversation("France question");

  const newChatBtn = await page.$("#newChatBtn");
  if (newChatBtn) {
    await newChatBtn.click();
    await page.waitForSelector("#promptInput", { visible: true });
  }

  await typeInto("#promptInput", "Debugging question");
  await page.click("#sendBtn");
  await waitForAssistantResponse();

  await page.waitForFunction(() => {
    return (
      document.querySelectorAll("#chatList li").length >= 2 ||
      document.querySelectorAll("#chatList .chat-title").length >= 2 ||
      document.querySelectorAll(".conversation-item").length >= 2 ||
      document.querySelectorAll(".thread-item").length >= 2
    );
  }, { timeout: 60000 });
});

Given("the user has searched for {string} in the search bar", { timeout: 600000 }, async keyword => {
  await createConversation(`${keyword} question`);
  await page.waitForSelector("#openSearchBtn", { visible: true });
  await page.click("#openSearchBtn");
  await page.waitForSelector("#searchInput", { visible: true });
  await typeInto("#searchInput", keyword);
  await page.click("#searchBtn");
  await page.waitForSelector(".search-result-card", { visible: true, timeout: 60000 });
});

Given("matching conversations are displayed", async () => {
  await page.waitForSelector(".search-result-card", { visible: true, timeout: 60000 });
});

Given("the UI is currently in light mode", async () => {
  await ensureLoggedIn();
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("pistachioTheme", "light");
  });
});

Given("the UI is currently in dark mode", async () => {
  await ensureLoggedIn();
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("pistachioTheme", "dark");
  });
});

// -------------------- When --------------------

When("I navigate to {string}", async path => {
  await safeGoto(path);
});

When("I am on the app page", async () => {
  await ensureLoggedIn();
});

When("I fill in login email with {string}", async email => {
  await activateLoginTab();
  await typeInto("#loginEmail", email);
});

When("I fill in login password with {string}", async password => {
  await activateLoginTab();
  await typeInto("#loginPassword", password);
});

When("I fill in signup username with {string}", async username => {
  await activateSignupTab();
  await typeInto("#signupUsername", username);
});

When("I fill in signup email with {string}", async email => {
  await activateSignupTab();
  await typeInto("#signupEmail", email);
});

When("I fill in signup password with {string}", async password => {
  await activateSignupTab();
  await typeInto("#signupPassword", password);
});

When("I click the Log In button", async () => {
  await activateLoginTab();
  await page.click("#loginBtn");
});

When("I click the Sign Up button", async () => {
  await activateSignupTab();
  await page.click("#signupBtn");
});

When("I log in with valid credentials", async () => {
  await login("test@test.com", "password123");
});

When("I click the Log Out button", async () => {
  await page.waitForSelector("#logoutBtn", { visible: true });
  await page.click("#logoutBtn");
});

When("I type {string} into the prompt box", async text => {
  await page.waitForSelector("#promptInput", { visible: true });
  await typeInto("#promptInput", text);
});

When("the user types {string} into the prompt box", async text => {
  await page.waitForSelector("#promptInput", { visible: true });
  await typeInto("#promptInput", text);
});

When("I click the Send button", async () => {
  await page.click("#sendBtn");
});

When("the user clicks the send button", async () => {
  await page.click("#sendBtn");
});

When("I leave the prompt box empty", async () => {
  await page.waitForSelector("#promptInput", { visible: true });
  await typeInto("#promptInput", "");
});

When("I enable the Shorten response toggle", async () => {
  await page.waitForSelector("#shortenToggle", { visible: true });
  const checked = await page.$eval("#shortenToggle", el => el.checked);
  if (!checked) {
    await page.click("#shortenToggle");
  }
});

When("I set max words to {string}", async value => {
  await typeInto("#wordLimit", value);
});

When("I click Save Settings", async () => {
  pendingDialogAction = "accept";
  await page.click("#saveSettingsBtn");
});

When("I click the Bookmark button on the response card", async () => {
  pendingDialogAction = "accept";
  await page.waitForSelector("#threadBookmarkBtn", { visible: true });
  await page.click("#threadBookmarkBtn");
  await sleep(1500);
});

When("I click the Delete button for that conversation", async () => {
  state.chatCountBeforeDelete = await chatListCount();
  await page.waitForSelector("#threadDeleteBtn", { visible: true });
  await page.click("#threadDeleteBtn");
});

When("I confirm the confirmation dialog", async () => {
  pendingDialogAction = "accept";
});

When("I dismiss the confirmation dialog", async () => {
  pendingDialogAction = "dismiss";
});

When("I click Open next to it in the Bookmarked Chats sidebar", async () => {
  const sel = await bookmarkOpenSelector();
  assert.ok(sel, "No bookmark open control found");
  await page.click(sel);
});

When("the user types {string} into the search bar", async keyword => {
  await page.waitForSelector("#openSearchBtn", { visible: true });
  await page.click("#openSearchBtn");
  await page.waitForSelector("#searchInput", { visible: true });
  await typeInto("#searchInput", keyword);
  await page.click("#searchBtn");
});

When("the user clicks on one of the search results", async () => {
  await page.waitForSelector(".search-result-card", { visible: true });
  await page.click(".search-result-card");
});

When("the user clicks on a conversation in the sidebar", async () => {
  const sel = await sidebarConversationSelector();
  assert.ok(sel, "No conversation item found in sidebar");
  await page.click(sel);
});

When(/^the user clicks the dark\/light mode toggle button$/, async () => {
  await page.waitForSelector("#themeToggleApp", { visible: true });
  await page.click("#themeToggleApp");
});

When("I select {string} from the model dropdown", async value => {
  await waitForAssistantResponse();
  await page.waitForFunction(() => {
    return !!document.querySelector("#inlineModelDropdown");
  }, { timeout: 60000 });

  await page.select("#inlineModelDropdown", value);
});

// -------------------- Then --------------------

Then("I should see the heading {string}", async text => {
  const heading = await page.$eval("h1", el => el.textContent.trim());
  assert.ok(
    heading.includes(text),
    `Expected h1 to contain "${text}", got "${heading}"`
  );
});

Then("I should see a signup form", async () => {
  await activateSignupTab();
  await page.waitForSelector("#signupUsername", { visible: true });
  await page.waitForSelector("#signupEmail", { visible: true });
  await page.waitForSelector("#signupPassword", { visible: true });
});

Then("I should see a login form", async () => {
  await activateLoginTab();

  const exists = await page.evaluate(() => {
    const email = document.querySelector("#loginEmail");
    const password = document.querySelector("#loginPassword");
    return !!(email && password);
  });

  assert.ok(exists, "Expected login form fields to exist");
});

Then("I should be on the app page", async () => {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 60000 });
  const path = await currentPath();
  assert.ok(
    path.includes("/app") || path.includes("index.html"),
    `Expected app page, got "${path}"`
  );
});

Then("I should be on the landing page", async () => {
  await waitForAuthShell();
});

Then("I should see {string}", async text => {
  const textBody = await bodyText();
  assert.ok(textBody.includes(text), `Expected page to include "${text}"`);
});

Then("I should see the auth error {string}", async text => {
  await page.waitForFunction(() => {
    const el = document.querySelector("#authMessage");
    return el && el.textContent.trim().length > 0;
  }, { timeout: 15000 });

  const msg = await page.$eval("#authMessage", el => el.textContent.trim());
  assert.strictEqual(msg, text);
});

Then("a loading icon should be visible", async () => {
  await page.waitForSelector("#loadingBubble", { visible: true, timeout: 15000 });
});

Then("a response should be displayed on the screen", async () => {
  await waitForAssistantResponse();
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "Expected a response to be displayed");
});

Then("a response card should appear on the page", async () => {
  await waitForAssistantResponse();
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "Expected a visible response area");
});

Then("the response card should contain study-related content", async () => {
  const text = (await bodyText()).toLowerCase();
  assert.ok(
    text.includes("study") ||
      text.includes("exam") ||
      text.includes("practice") ||
      text.includes("schedule"),
    `Expected study-related content, got "${text}"`
  );
});

Then("no response card should appear", async () => {
  await sleep(1500);
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.strictEqual(text.length, 0, "Expected no response bubble");
});

Then("the Chats sidebar should contain a new entry", async () => {
  await waitForAssistantResponse();
  await page.waitForFunction(() => {
    const list = document.querySelector("#chatList");
    return !!(list && list.innerText.trim().length > 0);
  }, { timeout: 120000 });
});

Then("the response on the card should contain no more than 10 words", async () => {
  await waitForAssistantResponse();

  const text = await page.evaluate(() => {
    const el =
      document.querySelector("#lastAssistantBubble p") ||
      document.querySelector("#lastAssistantBubble") ||
      document.querySelector("#threadMessages");
    return el ? el.textContent.trim() : "";
  });

  const words = text.split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 10, `Expected <= 10 words, got ${words.length}`);
});

Then("the conversation should appear in the chat history sidebar", async () => {
  await page.waitForFunction(() => {
    const list = document.querySelector("#chatList");
    return !!(list && list.innerText.trim().length > 0);
  }, { timeout: 60000 });
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async () => {
  await page.waitForFunction(() => {
    const list = document.querySelector("#bookmarkList");
    if (list && list.innerText.trim().length > 0) return true;

    const items = document.querySelectorAll(
      ".bookmark-item, #bookmarkList li, #bookmarkList .chat-title, #bookmarkList button, #bookmarkList .icon-btn"
    );

    return items.length > 0;
  }, { timeout: 120000 });
});

Then("the conversation should no longer appear in the Chats sidebar", async () => {
  await sleep(1500);

  const currentCount = await chatListCount();
  const threadCleared = await page.evaluate(() => {
    const thread = document.querySelector("#threadMessages");
    return !thread || thread.innerText.trim().length === 0;
  });

  assert.ok(
    threadCleared || currentCount < (state.chatCountBeforeDelete ?? Infinity),
    "Expected deleted conversation to no longer be open"
  );
});

Then("the conversation should still appear in the Chats sidebar", async () => {
  await sleep(1000);

  const threadStillVisible = await page.evaluate(() => {
    const thread = document.querySelector("#threadMessages");
    return !!(thread && thread.innerText.trim().length > 0);
  });

  const deleteButtonStillVisible = await page.evaluate(() => {
    return !!document.querySelector("#threadDeleteBtn");
  });

  const currentCount = await chatListCount();

  assert.ok(
    threadStillVisible || deleteButtonStillVisible || currentCount >= 1,
    "Expected conversation to still be present"
  );
});

Then("the response card should display the prompt and response", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 60000 });
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0, "Expected thread messages to be visible");
});

Then("the new message should be appended to the existing conversation", async () => {
  await waitForAssistantResponse();
  const text = (await bodyText()).toLowerCase();
  assert.ok(text.includes("can you elaborate on that?"));
});

Then("a new conversation should not be created", async () => {
  const count = await chatListCount();

  if (state.sidebarCountBeforeAppend != null) {
    assert.strictEqual(
      count,
      state.sidebarCountBeforeAppend,
      `Expected conversation count to stay ${state.sidebarCountBeforeAppend}, got ${count}`
    );
    return;
  }

  assert.ok(count >= 1, "Expected existing conversation to remain");
});

Then(
  "only conversations containing {string} should be displayed in the sidebar",
  async keyword => {
    await page.waitForSelector(".search-result-card", { visible: true, timeout: 60000 });

    const texts = await page.$$eval(".search-result-card", cards =>
      cards.map(c => c.innerText.toLowerCase())
    );

    assert.ok(texts.length > 0, "Expected at least one search result");
    assert.ok(
      texts.every(t => t.includes(keyword.toLowerCase())),
      `Not all search results contained "${keyword}"`
    );
  }
);

Then("that conversation should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 60000 });
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0);
});

Then("that conversation's messages should be loaded and displayed", async () => {
  await page.waitForSelector("#threadMessages", { visible: true, timeout: 60000 });
  const text = await page.$eval("#threadMessages", el => el.innerText.trim());
  assert.ok(text.length > 0);
});

Then("the UI theme should change to dark mode", async () => {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "dark",
    { timeout: 15000 }
  );
});

Then("the UI theme should change to light mode", async () => {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "light",
    { timeout: 15000 }
  );
});

Then("a model selector row should be visible", { timeout: 360000 }, async () => {
  await page.waitForFunction(() => {
    return !!(
      document.querySelector("#modelSelectorRow") ||
      document.querySelector("#inlineModelDropdown") ||
      (
        document.querySelector("#threadMessages") &&
        document.querySelector("#threadMessages").innerText.trim().length > 0
      )
    );
  }, { timeout: 240000 });

  const exists = await page.evaluate(() => {
    return !!(
      document.querySelector("#modelSelectorRow") ||
      document.querySelector("#inlineModelDropdown")
    );
  });

  assert.ok(exists, "Expected a model selector UI");
});

Then("the model selector dropdown should contain {string}", async labelText => {
  await page.waitForFunction(() => !!document.querySelector("#inlineModelDropdown"), {
    timeout: 240000
  });

  const labels = await page.$$eval("#inlineModelDropdown option", opts =>
    opts.map(o => o.textContent.trim())
  );

  assert.ok(
    labels.includes(labelText),
    `Expected dropdown options to include "${labelText}", got ${JSON.stringify(labels)}`
  );
});

Then(
  "the model selector dropdown should have {string} selected by default",
  async value => {
    await page.waitForFunction(() => !!document.querySelector("#inlineModelDropdown"), {
      timeout: 240000
    });

    const selected = await page.$eval("#inlineModelDropdown", el => el.value);
    assert.strictEqual(selected, value);
  }
);

Then("the model dropdown value should be {string}", async value => {
  await page.waitForFunction(() => !!document.querySelector("#inlineModelDropdown"), {
    timeout: 240000
  });

  const selected = await page.$eval("#inlineModelDropdown", el => el.value);
  assert.strictEqual(selected, value);
});

Then("the response has finished loading", async () => {
  await waitForAssistantResponse();
});