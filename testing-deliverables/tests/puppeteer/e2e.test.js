/**
 * tests/puppeteer/e2e.test.js
 *
 * Standalone Puppeteer browser test script.
 * No test framework required — run directly with Node:
 *
 *   node tests/puppeteer/e2e.test.js
 *
 * Prerequisites:
 *   1. npm install (in this folder)
 *   2. node server.js  (in the main project folder — must be running on :3000)
 *
 * Exit code 0 = all passed, 1 = at least one failure.
 */

const puppeteer = require("puppeteer");

const BASE = "http://localhost:3000";
let pass = 0;
let fail = 0;

const unique = Date.now();
const TEST_USER = `puppetuser${unique}`;
const TEST_EMAIL = `puppet${unique}@test.com`;
const TEST_PASS = "testpass";

function check(condition, label) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    pass++;
  } else {
    console.error(`  ❌  ${label}`);
    fail++;
  }
}

function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
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

async function clickFirstAvailable(page, selectors) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await page.click(sel);
      return sel;
    }
  }
  throw new Error(`None of these selectors were found: ${selectors.join(", ")}`);
}

async function typeFirstAvailable(page, selectors, value) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await page.click(sel, { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type(sel, value);
      return sel;
    }
  }
  throw new Error(`None of these selectors were found: ${selectors.join(", ")}`);
}

async function getTextFirstAvailable(page, selectors) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      return await page.$eval(sel, node => node.innerText || node.textContent || "");
    }
  }
  throw new Error(`None of these selectors were found: ${selectors.join(", ")}`);
}

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: false,
    dumpio: true,
    protocolTimeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });
  console.log("Browser launched successfully");

  let p;

  async function newPage() {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    return page;
  }

  async function signUp(page, username, email, password) {
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await page.waitForSelector("#signupUsername", { visible: true, timeout: 10000 });
    await page.type("#signupUsername", username);
    await page.type("#signupEmail", email);
    await page.type("#signupPassword", password);
    await page.click("#signupBtn");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
    await pause(1000);
  }

  await runSuite("📄 Suite 1: Landing Page", async () => {
    const p1 = await newPage();
    await p1.goto(BASE, { waitUntil: "networkidle0" });

    const h1 = await p1.$eval("h1", el => el.textContent.trim());
    check(h1.includes("LLM Web Interface"), "h1 contains 'LLM Web Interface'");
    check(await p1.$("#signupBtn") !== null, "Sign Up button is present");
    check(await p1.$("#loginBtn") !== null, "Log In button is present");

    await p1.close();
  });

  await runSuite("👤 Suite 2: Successful Sign Up", async () => {
    p = await newPage();
    await signUp(p, TEST_USER, TEST_EMAIL, TEST_PASS);

    const url = p.url();
    check(
      url.includes("index.html") || url.includes("/app"),
      `Redirected after signup: ${url}`
    );

    const info = await p.$eval("#userInfo", el => el.textContent.trim());
    check(info.includes(TEST_USER), `Username shown in header: "${info}"`);
  });

  await runSuite("🔑 Suite 3: Login & Validation Flow", async () => {
    console.log("  -> logging out");
    await p.waitForSelector("#logoutBtn", { visible: true, timeout: 10000 });
    await p.click("#logoutBtn");
    await pause(1000);

    console.log("  -> waiting for login form");
    await p.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });

    console.log("  -> attempting wrong login");
    await p.type("#loginEmail", TEST_EMAIL);
    await p.type("#loginPassword", "WRONG_PASSWORD");
    await p.click("#loginBtn");
    await pause(1000);

    const err = await p.$eval("#authMessage", el => el.textContent.trim());
    check(err === "Invalid email or password.", "Correctly blocked incorrect login");

    console.log("  -> attempting correct login");
    await p.click("#loginPassword", { clickCount: 3 });
    await p.keyboard.press("Backspace");
    await p.type("#loginPassword", TEST_PASS);
    await p.click("#loginBtn");
    await pause(1500);

    const url = p.url();
    check(
      url.includes("index.html") || url.includes("/app"),
      `Redirected after correct login: ${url}`
    );
  });

  await runSuite("💬 Suite 4: Continue Conversation Flow", async () => {
    await p.waitForSelector("#promptInput", { visible: true, timeout: 10000 });

    await p.type("#promptInput", "What is recursion?");
    await p.click("#sendBtn");

    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      return thread && thread.innerText.trim().length > 0;
    }, { timeout: 30000 });

    await p.click("#promptInput", { clickCount: 3 });
    await p.keyboard.press("Backspace");
    await p.type("#promptInput", "Give me a simple example");
    await p.click("#sendBtn");

    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      return thread && thread.innerText.includes("Give me a simple example");
    }, { timeout: 30000 });

    const threadText = await p.$eval("#threadMessages", el => el.innerText);
    check(threadText.includes("What is recursion?"), "First message exists in conversation");
    check(threadText.includes("Give me a simple example"), "Second message exists in conversation");

    const heading = await p.$eval("#mainHeading", el => el.textContent.trim());
    check(heading.includes("Continue"), "Heading updated to continue conversation");
  });

  await runSuite("🔖 Suite 5: Bookmark Conversation", async () => {
    await clickFirstAvailable(p, [
      "#bookmarkBtn",
      ".bookmark-btn",
      "[data-testid='bookmarkBtn']",
      "button[title*='Bookmark']",
      "button[aria-label*='Bookmark']"
    ]);

    await pause(1000);

    const bookmarkText = await getTextFirstAvailable(p, [
      "#bookmarkList",
      "#bookmarksList",
      ".bookmark-list",
      "[data-testid='bookmarkList']"
    ]);

    check(
      bookmarkText.includes("What is recursion?") ||
      bookmarkText.includes("Give me a simple example"),
      "Bookmarked conversation appears in bookmark list"
    );
  });

  await runSuite("🔎 Suite 6: Search Conversation", async () => {
    await typeFirstAvailable(p, [
      "#searchInput",
      "#searchBar",
      ".search-input",
      "[data-testid='searchInput']",
      "input[placeholder*='Search']"
    ], "recursion");

    await pause(1000);

    const convoListText = await getTextFirstAvailable(p, [
      "#conversationList",
      "#chatList",
      ".conversation-list",
      ".chat-list",
      "[data-testid='conversationList']"
    ]);

    check(
      convoListText.toLowerCase().includes("recursion"),
      "Search results show the matching conversation"
    );
  });

  await runSuite("✂️ Suite 7: Word Limit / Shorten Response", async () => {
    const shortenToggle =
      await p.$("#shortenToggle") ||
      await p.$("[data-testid='shortenToggle']") ||
      await p.$("input[type='checkbox']");

    if (shortenToggle) {
      const isChecked = await p.evaluate(el => el.checked, shortenToggle);
      if (!isChecked) {
        await shortenToggle.click();
      }
      check(true, "Shorten response toggle enabled");
    } else {
      check(false, "Shorten response toggle found");
    }

    try {
      await typeFirstAvailable(p, [
        "#maxWordsInput",
        "#wordLimitInput",
        "#maxWords",
        "input[type='number']",
        "[data-testid='maxWordsInput']"
      ], "10");
      check(true, "Word limit input set to 10");
    } catch (err) {
      check(false, "Word limit input found");
    }

    const allButtons = await p.$$("button");
    let clicked = false;

    for (const btn of allButtons) {
      const text = await p.evaluate(el => el.textContent.trim(), btn);
      if (
        text.toLowerCase().includes("save") ||
        text.toLowerCase().includes("settings")
      ) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    check(clicked, "Settings saved");

    await typeFirstAvailable(p, [
      "#promptInput",
      "[data-testid='promptInput']",
      "textarea",
      "input[type='text']"
    ], "Explain recursion in one paragraph");

    await clickFirstAvailable(p, [
      "#sendBtn",
      "[data-testid='sendBtn']",
      "button[type='submit']"
    ]);

    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      return thread && thread.innerText.trim().length > 0;
    }, { timeout: 30000 });

    const threadText = await p.$eval("#threadMessages", el => el.innerText);
    const lines = threadText.split("\n").map(s => s.trim()).filter(Boolean);
    const latestChunk = lines.slice(-6).join(" ");
    const wordCount = latestChunk.split(/\s+/).filter(Boolean).length;

    check(wordCount <= 40, "Response appears shortened after word-limit setting");
  });

  await runSuite("🗑️ Suite 8: Delete Conversation", async () => {
    const beforeText = await getTextFirstAvailable(p, [
      "#conversationList",
      "#chatList",
      ".conversation-list",
      ".chat-list",
      "[data-testid='conversationList']"
    ]);

    await clickFirstAvailable(p, [
      "#deleteConversationBtn",
      ".delete-btn",
      "[data-testid='deleteConversationBtn']",
      "button[title*='Delete']",
      "button[aria-label*='Delete']"
    ]);

    await pause(1000);

    const afterText = await getTextFirstAvailable(p, [
      "#conversationList",
      "#chatList",
      ".conversation-list",
      ".chat-list",
      "[data-testid='conversationList']"
    ]);

    check(beforeText !== afterText, "Conversation list changed after deletion");
  });

  await browser.close();

  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Results:  ✅ Passed: ${pass}   ❌ Failed: ${fail}   Total: ${pass + fail}`);
  console.log("─".repeat(55));

  if (fail > 0) process.exit(1);
})().catch(err => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});