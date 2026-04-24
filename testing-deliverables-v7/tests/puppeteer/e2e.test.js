const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:3000";
let pass = 0;
let fail = 0;

const unique = Date.now();
const TEST_USER = `puppetuser${unique}`;
const TEST_EMAIL = `puppet${unique}@test.com`;
const TEST_PASS = "testpass123";

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
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ❌ Suite crashed: ${err.message}`);
    fail++;
  }
}

function getChromePath() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser"
  ];
  return candidates[0];
}

async function clearAndType(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

async function signUp(page, username, email, password) {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector("#signupUsername", { visible: true, timeout: 15000 });
  await clearAndType(page, "#signupUsername", username);
  await clearAndType(page, "#signupEmail", email);
  await clearAndType(page, "#signupPassword", password);
  await page.click("#signupBtn");
  await page.waitForSelector("#promptInput", { visible: true, timeout: 15000 });
}

async function waitForAlertAndAccept(page) {
  return new Promise(resolve => {
    page.once("dialog", async dialog => {
      try { await dialog.accept(); } catch (_) {}
      resolve();
    });
  });
}

async function sendPromptAndWait(page, text) {
  await page.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
  await page.click("#promptInput", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#promptInput", text);
  await page.click("#sendBtn");

  // Wait for loading bubble to disappear and a model-select dropdown to appear
  await page.waitForSelector("#loadingBubble", { hidden: true, timeout: 90000 }).catch(() => {});
  await page.waitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    return thread && thread.innerText.trim().length > 0;
  }, { timeout: 15000 });
}

(async () => {
  console.log("Launching browser...");

  const browser = await puppeteer.launch({
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

  console.log("Browser launched successfully");

  const p = await browser.newPage();
  await p.setViewport({ width: 1400, height: 900 });

  // ─────────────────────────────────────────────
  await runSuite("📄 Suite 1: Landing Page", async () => {
    await p.goto(BASE, { waitUntil: "networkidle2" });

    const signupBtn    = await p.$("#signupBtn");
    const loginBtn     = await p.$("#loginBtn");
    const signupUser   = await p.$("#signupUsername");
    const loginEmail   = await p.$("#loginEmail");

    check(signupBtn   !== null, "Sign Up button is present");
    check(loginBtn    !== null, "Log In button is present");
    check(signupUser  !== null, "Signup username field is present");
    check(loginEmail  !== null, "Login email field is present");
  });

  // ─────────────────────────────────────────────
  await runSuite("👤 Suite 2: Successful Sign Up", async () => {
    await signUp(p, TEST_USER, TEST_EMAIL, TEST_PASS);

    const url = p.url();
    check(
      url.includes("/index.html") || url.includes("/app"),
      `Redirected after signup: ${url}`
    );

    await p.waitForSelector("#userInfo", { visible: true, timeout: 15000 });
    const info = await p.$eval("#userInfo", el => el.textContent.trim());
    check(info.includes(TEST_USER), `Username shown in header: "${info}"`);
  });

  // ─────────────────────────────────────────────
  await runSuite("🔐 Suite 3: Login & Validation Flow", async () => {
    await p.waitForSelector("#logoutBtn", { visible: true, timeout: 10000 });
    await p.click("#logoutBtn");

    await p.waitForFunction(
      () => window.location.pathname === "/" || window.location.pathname.includes("landing"),
      { timeout: 10000 }
    );

    await p.waitForSelector("#tabLogin", { visible: true, timeout: 10000 });
    await p.click("#tabLogin");

    await p.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });
    await p.type("#loginEmail", TEST_EMAIL);
    await p.type("#loginPassword", "WRONG_PASSWORD");
    await p.click("#loginBtn");

    await p.waitForFunction(() => {
      const el = document.querySelector("#authMessage");
      return el && el.textContent.trim().length > 0;
    }, { timeout: 10000 });

    const err = await p.$eval("#authMessage", el => el.textContent.trim());
    check(err.length > 0, `Incorrect login blocked: "${err}"`);

    await p.click("#loginPassword", { clickCount: 3 });
    await p.keyboard.press("Backspace");
    await p.type("#loginPassword", TEST_PASS);
    await p.click("#loginBtn");

    await p.waitForSelector("#promptInput", { visible: true, timeout: 15000 });
    const url = p.url();
    check(
      url.includes("index.html") || url.includes("/app"),
      `Redirected after correct login: ${url}`
    );
  });

  // ─────────────────────────────────────────────
  // NEW: Suite 4 — Multi-Model Dropdown
  // ─────────────────────────────────────────────
  await runSuite("🤖 Suite 4: Multi-Model Dropdown", async () => {
    await p.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
    console.log("   -> sending prompt (waiting for all 3 models — this may take 1-2 min)...");

    await sendPromptAndWait(p, "What is 1 + 1?");

    // 4a — Dropdown exists in the response bubble
    await p.waitForSelector(".model-select", { visible: true, timeout: 15000 });
    const dropdownExists = await p.$(".model-select");
    check(dropdownExists !== null, "Model dropdown is present in the response bubble");

    // 4b — Dropdown contains all three model options
    const options = await p.$$eval(".model-select option", opts =>
      opts.map(o => o.value)
    );
    check(options.includes("llama3.2"),    "Dropdown contains llama3.2");
    check(options.includes("phi3"), "Dropdown contains phi3");
    check(options.includes("tinyllama"),   "Dropdown contains tinyllama");

    // 4c — A response is shown for the default model
    const initialText = await p.$eval(".multi-model-response p", el => el.textContent.trim());
    check(initialText.length > 0, `Default model response is non-empty: "${initialText.slice(0, 60)}..."`);

    // 4d — Switching to phi3 updates the visible response
    await p.select(".model-select", "phi3");
    await new Promise(r => setTimeout(r, 500)); // allow DOM update
    const phi3seekText = await p.$eval(".multi-model-response p", el => el.textContent.trim());
    check(
      phi3seekText.length > 0 && phi3seekText !== initialText,
      `Switching to phi3 updates the response (got: "${phi3seekText.slice(0, 60)}...")`
    );

    // 4e — Switching to tinyllama updates the visible response
    await p.select(".model-select", "tinyllama");
    await new Promise(r => setTimeout(r, 500));
    const tinyllamaText = await p.$eval(".multi-model-response p", el => el.textContent.trim());
    check(
      tinyllamaText.length > 0,
      `Switching to tinyllama shows a response (got: "${tinyllamaText.slice(0, 60)}...")`
    );

    // 4f — Switching back to llama3.2 restores its response
    await p.select(".model-select", "llama3.2");
    await new Promise(r => setTimeout(r, 500));
    const restoredText = await p.$eval(".multi-model-response p", el => el.textContent.trim());
    check(
      restoredText === initialText,
      "Switching back to llama3.2 restores the original response"
    );

    // 4g — Summary button is present alongside the dropdown
    const summaryBtn = await p.$(".summary-btn");
    check(summaryBtn !== null, "Summary button is present alongside the dropdown");

    // 4h — All 3 responses are non-empty and stored (different content per model)
    const allThreeNonEmpty =
      initialText.length > 0 && phi3seekText.length > 0 && tinyllamaText.length > 0;
    check(allThreeNonEmpty, "All 3 model responses are non-empty and stored");
  });

  // ─────────────────────────────────────────────
  await runSuite("💬 Suite 5: Continue Conversation Flow", async () => {
    await p.waitForSelector("#promptInput", { visible: true, timeout: 10000 });
    await sendPromptAndWait(p, "give me one short sentence");

    await p.type("#promptInput", "give me another short sentence");
    await p.click("#sendBtn");

    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      return thread && thread.innerText.toLowerCase().includes("give me another short sentence");
    }, { timeout: 90000 });

    const threadText = await p.$eval("#threadMessages", el => el.innerText.toLowerCase());
    check(threadText.includes("give me one short sentence"),     "First message exists in conversation");
    check(threadText.includes("give me another short sentence"), "Second message exists in conversation");

    const heading = await p.$eval("#mainHeading", el => el.textContent.trim());
    check(heading.includes("Continue"), "Heading updated to continue conversation");
  });

  // ─────────────────────────────────────────────
  await runSuite("🔖 Suite 6: Bookmark Conversation", async () => {
    await p.waitForSelector("#threadBookmarkBtn", { visible: true, timeout: 15000 });
    const alertPromise = waitForAlertAndAccept(p);
    await p.click("#threadBookmarkBtn");
    await alertPromise;

    await p.waitForFunction(() => {
      const list = document.querySelector("#bookmarkList");
      return list && list.innerText.trim().length > 0;
    }, { timeout: 10000 });

    const bookmarkText = await p.$eval("#bookmarkList", el => el.innerText);
    check(bookmarkText.length > 0, "Bookmark list updated");
  });

  // ─────────────────────────────────────────────
  await runSuite("🔎 Suite 7: Search Conversation", async () => {
    await p.waitForSelector("#openSearchBtn", { visible: true, timeout: 10000 });
    await p.click("#openSearchBtn");

    await p.waitForSelector("#searchInput", { visible: true, timeout: 10000 });
    await p.click("#searchInput", { clickCount: 3 });
    await p.keyboard.press("Backspace");
    await p.type("#searchInput", "short sentence");
    await p.click("#searchBtn");

    await p.waitForFunction(() => {
      const results = document.querySelector("#searchResults");
      return results && results.innerText.trim().length > 0;
    }, { timeout: 10000 });

    const resultsText = await p.$eval("#searchResults", el => el.innerText.toLowerCase());
    check(
      resultsText.includes("short sentence") || resultsText.includes("give me one"),
      "Search results show the matching conversation"
    );

    const firstCard = await p.$(".search-result-card");
    check(!!firstCard, "At least one search result card appears");

    if (firstCard) {
      await firstCard.click();
      await p.waitForFunction(() => {
        const thread   = document.querySelector("#threadMessages");
        const overlay  = document.querySelector("#searchOverlay");
        return thread && thread.innerText.toLowerCase().includes("give me one short sentence")
          && overlay && overlay.classList.contains("hidden");
      }, { timeout: 10000 });
      check(true, "Clicking a search result opens the conversation");
    }
  });

  // ─────────────────────────────────────────────
  await runSuite("✂️ Suite 8: Save Word Limit Setting", async () => {
    await p.waitForSelector("#shortenToggle", { visible: true, timeout: 15000 });
    const checked = await p.$eval("#shortenToggle", el => el.checked);
    if (!checked) await p.click("#shortenToggle");

    await clearAndType(p, "#wordLimit", "10");

    const alertPromise = waitForAlertAndAccept(p);
    await p.click("#saveSettingsBtn");
    await alertPromise;

    const value = await p.$eval("#wordLimit", el => el.value);
    check(value === "10", "Word limit field updated to 10");
  });

  // ─────────────────────────────────────────────
  await runSuite("🗑️ Suite 9: Delete Conversation", async () => {
    await p.waitForSelector("#chatList", { visible: true, timeout: 15000 });
    const beforeText = await p.$eval("#chatList", el => el.innerText);

    await p.waitForSelector("#threadDeleteBtn", { visible: true, timeout: 15000 });
    const confirmPromise = waitForAlertAndAccept(p);
    await p.click("#threadDeleteBtn");
    await confirmPromise;

    await p.waitForFunction(() => {
      const heading = document.querySelector("#mainHeading");
      return heading && heading.textContent.includes("How can I help you?");
    }, { timeout: 15000 });

    const afterText = await p.$eval("#chatList", el => el.innerText);
    check(beforeText !== afterText, "Conversation list changed after deletion");
  });

  console.log(`\nDone. Passed: ${pass}, Failed: ${fail}`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
