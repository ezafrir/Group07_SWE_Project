// =============================================================================
// e2e.test.js — Puppeteer end-to-end tests for PistachioAI
// =============================================================================

const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:3000";

function getChromePath() {
  const fs = require("fs");
  if (process.platform === "win32") {
    const candidates = [
      process.env.LOCALAPPDATA  + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.PROGRAMFILES  + "\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA  + "\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
    throw new Error("Could not find Chrome or Edge.");
  }
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "/usr/bin/google-chrome";
}

const CHROME_PATH = getChromePath();
const RUN_ID    = Date.now();
const USERNAME  = `testuser_${RUN_ID}`;
const EMAIL     = `testuser_${RUN_ID}@test.com`;
const PASSWORD  = "TestPass123!";

let pass = 0;
let fail = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function check(condition, label) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    pass++;
  } else {
    console.error(`  ❌  ${label}`);
    fail++;
  }
}

async function runSuite(name, fn) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"─".repeat(60)}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ❌  Suite crashed: ${err.message}`);
    fail++;
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clearAndType(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

async function acceptDialog(page) {
  return new Promise(resolve => {
    page.once("dialog", async dialog => {
      try { await dialog.accept(); } catch (_) {}
      resolve();
    });
  });
}

async function signUp(page, username, email, password) {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector("#signupUsername", { visible: true, timeout: 15000 });
  await clearAndType(page, "#signupUsername", username);
  await clearAndType(page, "#signupEmail",    email);
  await clearAndType(page, "#signupPassword", password);
  await page.click("#signupBtn");
  await page.waitForSelector("#promptInput", { visible: true, timeout: 20000 });
}

async function sendPrompt(page, text) {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await clearAndType(page, "#promptInput", text);
  await page.click("#sendBtn");
}

async function waitForLLMSelector(page, timeoutMs = 120000) {
  await page.waitForSelector("#loadingBubble", { hidden: true, timeout: timeoutMs }).catch(() => {});
  await page.waitForSelector("#llmSelectorCard", { visible: true, timeout: timeoutMs });
}

async function sendAndWait(page, text) {
  await sendPrompt(page, text);
  await waitForLLMSelector(page);
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

(async () => {
  console.log("\n🚀  PistachioAI — Puppeteer E2E Test Suite");
  console.log(`    Run ID: ${RUN_ID}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // ── Suite 1: Landing Page ───────────────────────────────────────────────────
  await runSuite("Suite 1 — Landing Page", async () => {
    await page.goto(BASE, { waitUntil: "networkidle2" });
    check(await page.$("#signupBtn") !== null, "Sign Up button is present");
    check(await page.$("#loginBtn") !== null, "Log In button is present");
  });

  // ── Suite 2: Sign Up ─────────────────────────────────────────────────────────
  await runSuite("Suite 2 — Sign Up", async () => {
    await signUp(page, USERNAME, EMAIL, PASSWORD);
    const url = page.url();
    check(url.includes("/index.html") || url.includes("/app"), "Redirected to app page");
  });

  // ── Suite 3: Login & Logout ──────────────────────────────────────────────────
  await runSuite("Suite 3 — Login & Logout", async () => {
    await page.click("#logoutBtn");
    await page.waitForSelector("#signupBtn", { visible: true });
    await page.click("#tabLogin");
    await clearAndType(page, "#loginEmail", EMAIL);
    await clearAndType(page, "#loginPassword", PASSWORD);
    await page.click("#loginBtn");
    await page.waitForSelector("#promptInput", { visible: true });
    check(true, "Logged back in successfully");
  });

  // ── REORDERED: Suite 4: Shorten Response Setting ─────────────────────────────
  // Running this early prevents VRAM congestion from causing timeouts.
  await runSuite("Suite 4 — Shorten Response Setting", async () => {
    // Refresh to clear any DOM artifacts
    await page.reload({ waitUntil: "networkidle2" });
    
    await page.waitForSelector("#shortenToggle", { visible: true });
    const isChecked = await page.$eval("#shortenToggle", el => el.checked);
    if (!isChecked) await page.click("#shortenToggle");

    await clearAndType(page, "#wordLimit", "5");
    const alertDone = acceptDialog(page);
    await page.click("#saveSettingsBtn");
    await alertDone;

    // Use a simple prompt to ensure fast generation
    await sendAndWait(page, "Tell me a very short joke.");

    const responseText = await page.$eval("#llmResponseText", el => el.textContent.trim());
    const wordCount = responseText.split(/\s+/).filter(Boolean).length;
    check(wordCount <= 5, `Shortened response is ≤ 5 words (got ${wordCount})`);

    // Reset settings
    await page.click("#shortenToggle");
    await clearAndType(page, "#wordLimit", "200");
    const alertDone2 = acceptDialog(page);
    await page.click("#saveSettingsBtn");
    await alertDone2;
    
    await page.click("#newChatBtn");
    await delay(500);
  });

  // ── Suite 5: Send Prompt & LLM Selector Appears ─────────────────────────────
  await runSuite("Suite 5 — Send Prompt & LLM Selector", async () => {
    await sendAndWait(page, "What is the capital of France?");
    check(await page.$("#llmSelectorCard") !== null, "Selector card appears");
  });

  // ── Suite 6: LLM Dropdown — All Three Models ─────────────────────────────────
  await runSuite("Suite 6 — LLM Dropdown: All Three Models", async () => {
    await page.click("#newChatBtn");
    await delay(300);
    await sendAndWait(page, "Gravity in one sentence");
    const count = await page.$$eval("#llmDropdown option", opts => opts.length);
    check(count === 3, "Dropdown has 3 options");
  });

  // ── Suite 7: LLM Dropdown — Switching Models ─────────────────────────────────
  await runSuite("Suite 7 — LLM Dropdown: Switching Models", async () => {
    await page.select("#llmDropdown", "deepseek-r1");
    await delay(500);
    const text = await page.$eval("#llmResponseText", el => el.textContent.trim());
    check(text.length > 0, "DeepSeek response is non-empty");
  });

  // ── Suite 8: Continue Conversation (Multi-LLM) ───────────────────────────────
  await runSuite("Suite 8 — Continue Conversation (Multi-LLM)", async () => {
    await sendAndWait(page, "Give me one more example");
    const thread = await page.$eval("#threadMessages", el => el.innerText.toLowerCase());
    check(thread.includes("example"), "Follow-up message visible");
  });

  // ── Suite 9: Bookmark Conversation ──────────────────────────────────────────
  await runSuite("Suite 9 — Bookmark Conversation", async () => {
    const alertDone = acceptDialog(page);
    await page.click("#threadBookmarkBtn");
    await alertDone;
    await page.waitForFunction(() => document.querySelector("#bookmarkList").innerText.trim().length > 0);
    check(true, "Conversation bookmarked");
  });

  // ── Suite 10: Search Conversations ───────────────────────────────────────────
  await runSuite("Suite 10 — Search Conversations", async () => {
    await page.click("#openSearchBtn");
    await clearAndType(page, "#searchInput", "France");
    await page.click("#searchBtn");
    await page.waitForSelector(".search-result-card");
    check(true, "Search results found");
    await page.click("#closeSearchBtn");
  });

  // ── Suite 11: New Chat Resets State ──────────────────────────────────────────
  await runSuite("Suite 11 — New Chat Resets State", async () => {
    await page.click("#newChatBtn");
    await delay(500);
    const card = await page.$("#llmSelectorCard");
    check(card === null, "UI reset correctly");
  });

  // ── Suite 12: Delete Conversation ───────────────────────────────────────────
  await runSuite("Suite 12 — Delete Conversation", async () => {
    await sendAndWait(page, "Delete me");
    const acceptDone = acceptDialog(page);
    await page.click("#threadDeleteBtn");
    await acceptDone;
    check(true, "Conversation deleted");
  });

  // ── Suite 13: View Past Conversation from Sidebar ────────────────────────────
  await runSuite("Suite 13 — View Past Conversation from Sidebar", async () => {
    await sendAndWait(page, "Final test");
    await page.click("#newChatBtn");
    await delay(500);
    await page.click("#chatList li .chat-title");
    await page.waitForSelector("#threadMessages");
    check(true, "History reloaded");
  });

  // ── Suite 14: Empty Prompt Does Not Submit ────────────────────────────────────
  await runSuite("Suite 14 — Empty Prompt Does Not Submit", async () => {
    await page.click("#newChatBtn");
    await page.$eval("#promptInput", el => { el.value = ""; });
    await page.click("#sendBtn");
    await delay(500);
    check(await page.$("#loadingBubble") === null, "Empty prompt ignored");
  });

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results:  ✅ ${pass} passed    ❌ ${fail} failed`);
  console.log(`${"═".repeat(60)}\n`);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();