/**
 * features/step_definitions/steps.js
 *
 * Cucumber step definitions — every step used across all .feature files.
 * Each test runs in a fresh browser page (Before/After hooks).
 *
 * Requires:
 *   npm install --save-dev @cucumber/cucumber puppeteer
 *
 * The server must already be running on http://localhost:3000 before you
 * invoke `npx cucumber-js`.
 */

const { Given, When, Then, Before, After } = require("@cucumber/cucumber");
const puppeteer = require("puppeteer");
const assert = require("assert");

const BASE = "http://localhost:3000";

let browser;
let page;

// ── Lifecycle ─────────────────────────────────────────────────────────────────

Before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
});

After(async () => {
  await browser.close();
});

// ── Shared helpers ────────────────────────────────────────────────────────────

async function signUp(username, email, password) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", username);
  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", email);
  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", password);
  await page.click("#signupBtn");
  await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
}

async function logOut() {
  await page.evaluate(async () => {
    await fetch("/api/logout", { method: "POST" });
  });
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Given steps ───────────────────────────────────────────────────────────────

Given("I navigate to the home page", async () => {
  await page.goto(BASE, { waitUntil: "networkidle0" });
});

Given("I am on the landing page", async () => {
  await page.goto(BASE, { waitUntil: "networkidle0" });
});

Given("I am not logged in", async () => {
  // Fresh page — no session cookie present
});

Given("I am already logged in", async () => {
  await signUp("autouser", "auto@example.com", "pass123");
});

Given("a user already exists with email {string}", async (email) => {
  await signUp("firstuser", email, "pass");
  await logOut();
});

Given("a registered user exists with email {string} and password {string}", async (email, password) => {
  await signUp("reguser", email, password);
  await logOut();
});

Given("I am logged in and on the app page", async () => {
  await signUp("appuser", "appuser@example.com", "pass");
  assert.ok(page.url().includes("/app"), "Should be on /app after signup");
});

Given("I am logged in with an existing conversation", async () => {
  await signUp("convuser", "convuser@example.com", "pass");
  await page.type("#promptInput", "Tell me about debugging");
  await page.click("#sendBtn");
  await page.waitForSelector(".responseCard");
});

Given("I am logged in and have a bookmarked conversation", async () => {
  await signUp("bmuser", "bmuser@example.com", "pass");
  await page.type("#promptInput", "How do I study?");
  await page.click("#sendBtn");
  await page.waitForSelector(".responseCard");
  await page.click(".responseActions button");
  await page.waitForFunction(
    () => document.querySelector("#bookmarkList li") !== null
  );
});

// ── When steps ────────────────────────────────────────────────────────────────

When("I am on the landing page", async () => {
  await page.goto(BASE, { waitUntil: "networkidle0" });
});

When("I am on the app page", async () => {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
});

When("I navigate to {string}", async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
});

When("I fill in signup username with {string}", async (value) => {
  await page.$eval("#signupUsername", el => (el.value = ""));
  await page.type("#signupUsername", value);
});

When("I fill in signup email with {string}", async (value) => {
  await page.$eval("#signupEmail", el => (el.value = ""));
  await page.type("#signupEmail", value);
});

When("I fill in signup password with {string}", async (value) => {
  await page.$eval("#signupPassword", el => (el.value = ""));
  await page.type("#signupPassword", value);
});

When("I fill in login email with {string}", async (value) => {
  await page.$eval("#loginEmail", el => (el.value = ""));
  await page.type("#loginEmail", value);
});

When("I fill in login password with {string}", async (value) => {
  await page.$eval("#loginPassword", el => (el.value = ""));
  await page.type("#loginPassword", value);
});

When("I click the Sign Up button", async () => {
  await page.click("#signupBtn");
  await delay(600);
});

When("I click the Log In button", async () => {
  await page.click("#loginBtn");
  await delay(600);
});

When("I click the Log Out button", async () => {
  await page.click("#logoutBtn");
  await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
});

When("I click the Send button", async () => {
  await page.click("#sendBtn");
  await delay(600);
});

When("I click Save Settings", async () => {
  page.once("dialog", async d => await d.accept());
  await page.click("#saveSettingsBtn");
  await delay(400);
});

When("I type {string} into the prompt box", async (text) => {
  await page.$eval("#promptInput", el => (el.value = ""));
  await page.type("#promptInput", text);
});

When("I leave the prompt box empty", async () => {
  await page.$eval("#promptInput", el => (el.value = ""));
});

When("I enable the Shorten response toggle", async () => {
  const checked = await page.$eval("#shortenToggle", el => el.checked);
  if (!checked) await page.click("#shortenToggle");
});

When("I set max words to {string}", async (value) => {
  await page.$eval("#wordLimit", el => (el.value = ""));
  await page.type("#wordLimit", value);
});

When("I click the Bookmark button on the response card", async () => {
  await page.waitForSelector(".responseActions button");
  await page.click(".responseActions button");
  await delay(500);
});

When("I click the Delete button for that conversation", async () => {
  await page.waitForSelector("#chatList li");
  // Delete button is the last button in the list item
  const deleteBtn = await page.$('#chatList li button:last-child');
  page.once("dialog", async d => {
    // stored for confirm/dismiss steps — intercepted in Then steps
  });
  await deleteBtn.click();
  await delay(300);
});

When("I confirm the confirmation dialog", async () => {
  page.once("dialog", async d => await d.accept());
  const deleteBtn = await page.$('#chatList li button:last-child');
  if (deleteBtn) {
    await deleteBtn.click();
  }
  await delay(700);
});

When("I dismiss the confirmation dialog", async () => {
  page.once("dialog", async d => await d.dismiss());
  const deleteBtn = await page.$('#chatList li button:last-child');
  if (deleteBtn) {
    await deleteBtn.click();
  }
  await delay(400);
});

When("I click Open next to it in the Bookmarked Chats sidebar", async () => {
  await page.waitForSelector("#bookmarkList li button");
  await page.click("#bookmarkList li button");
  await delay(500);
});

// ── Then steps ────────────────────────────────────────────────────────────────

Then("I should see the heading {string}", async (text) => {
  const heading = await page.$eval("h1", el => el.textContent.trim());
  assert.ok(
    heading.includes(text),
    `Expected h1 to contain "${text}", got "${heading}"`
  );
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
  await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
  assert.ok(page.url().includes("/app"), `Expected /app in URL, got ${page.url()}`);
});

Then("I should be on the landing page", async () => {
  assert.ok(
    !page.url().includes("/app"),
    `Expected to be on landing page, got ${page.url()}`
  );
});

Then("I should see {string}", async (text) => {
  const content = await page.content();
  assert.ok(content.includes(text), `Page does not contain "${text}"`);
});

Then("I should see the auth error {string}", async (expected) => {
  await page.waitForSelector("#authMessage");
  const msg = await page.$eval("#authMessage", el => el.textContent.trim());
  assert.strictEqual(msg, expected, `Expected error "${expected}", got "${msg}"`);
});

Then("a response card should appear on the page", async () => {
  await page.waitForSelector(".responseCard", { timeout: 5000 });
  const card = await page.$(".responseCard");
  assert.ok(card, "Response card not found");
});

Then("the response card should contain study-related content", async () => {
  const text = await page.$eval(".responseCard", el => el.textContent.toLowerCase());
  const relevant = text.includes("study") || text.includes("exam") || text.includes("concept");
  assert.ok(relevant, `Response card did not contain study-related text: "${text}"`);
});

Then("no response card should appear", async () => {
  await delay(500);
  const cards = await page.$$(".responseCard");
  assert.strictEqual(cards.length, 0, "Response card should not have been created");
});

Then("the Chats sidebar should contain a new entry", async () => {
  await page.waitForFunction(
    () => document.querySelector("#chatList li") !== null,
    { timeout: 5000 }
  );
  const items = await page.$$("#chatList li");
  assert.ok(items.length > 0, "Chat list should not be empty");
});

Then("the response on the card should contain no more than {int} words", async (max) => {
  await page.waitForSelector(".responseCard");
  const responseEl = await page.$(".responseCard p:nth-child(3)");
  const text = await page.evaluate(el => el.textContent, responseEl);
  const words = text.replace(/^Response:\s*/i, "").trim().split(/\s+/);
  assert.ok(
    words.length <= max,
    `Expected ≤ ${max} words, got ${words.length}: "${text}"`
  );
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async () => {
  await page.waitForFunction(
    () => document.querySelector("#bookmarkList li") !== null,
    { timeout: 5000 }
  );
  const items = await page.$$("#bookmarkList li");
  assert.ok(items.length > 0, "Bookmarked Chats list should not be empty");
});

Then("the conversation should no longer appear in the Chats sidebar", async () => {
  await page.waitForFunction(
    () => document.querySelector("#chatList li") === null,
    { timeout: 5000 }
  ).catch(() => {});
  const items = await page.$$("#chatList li");
  assert.strictEqual(items.length, 0, "Chat list should be empty after deletion");
});

Then("the conversation should still appear in the Chats sidebar", async () => {
  const items = await page.$$("#chatList li");
  assert.ok(items.length > 0, "Conversation should still be present");
});

Then("the response card should display the prompt and response", async () => {
  await page.waitForSelector(".responseCard");
  const text = await page.$eval(".responseCard", el => el.textContent);
  assert.ok(
    text.includes("Prompt:") && text.includes("Response:"),
    "Card should show both prompt and response sections"
  );
});
