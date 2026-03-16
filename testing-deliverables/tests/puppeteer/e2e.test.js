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
 * Each suite uses a fresh browser page so sessions never bleed between tests.
 * Exit code 0 = all passed, 1 = at least one failure.
 */

const puppeteer = require("puppeteer");

const BASE = "http://localhost:3000";
let pass = 0;
let fail = 0;

// ── Tiny assertion helper ─────────────────────────────────────────────────────

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

// ── Run all suites ─────────────────────────────────────────────────────────────

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  async function newPage() {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 800 });
    return p;
  }

  // Helper: sign up and land on /app
  async function signUp(p, username, email, password) {
    await p.goto(BASE, { waitUntil: "networkidle0" });
    await p.waitForSelector("#signupUsername", { visible: true });
    await p.type("#signupUsername", username);
    await p.type("#signupEmail", email);
    await p.type("#signupPassword", password);
    await p.click("#signupBtn");
    await p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
  }

  // ── Suite 1: Landing Page ───────────────────────────────────────────────────
  console.log("\n📄  Suite 1: Landing Page");
  {
    const p = await newPage();
    await p.goto(BASE, { waitUntil: "networkidle0" });

    const h1 = await p.$eval("h1", el => el.textContent.trim());
    check(h1.includes("LLM Web Interface"), "h1 contains 'LLM Web Interface'");
    check(await p.$("#signupBtn") !== null, "Sign Up button is present");
    check(await p.$("#loginBtn") !== null,  "Log In button is present");

    await p.close();
  }

  // ── Suite 2: Successful Sign Up ─────────────────────────────────────────────
  console.log("\n👤  Suite 2: Successful Sign Up");
  {
    const p = await newPage();
    await signUp(p, "puppetuser", "puppet@test.com", "testpass");

    check(p.url().includes("index.html"), "Redirected to index.html after signup");
    const info = await p.$eval("#userInfo", el => el.textContent.trim());
    check(info.includes("puppetuser"), `Username shown in header: "${info}"`);

    await p.close();
  }

  // ── Suite 3: Duplicate Email ────────────────────────────────────────────────
  /*console.log("\n⚠️   Suite 3: Duplicate Email Error");
  {
    const p = await newPage();
    await signUp(p, "first", "dup@test.com", "pass");
    await p.evaluate(async () => await fetch("/api/logout", { method: "POST" }));

    await p.goto(BASE, { waitUntil: "networkidle0" });
    await p.type("#signupUsername", "second");
    await p.type("#signupEmail",    "dup@test.com");
    await p.type("#signupPassword", "pass");
    await p.click("#signupBtn");
    await pause(500);

    const err = await p.$eval("#authMessage", el => el.textContent.trim());
    check(err === "Account already exists.", `Correct duplicate error: "${err}"`);

    await p.close();
  }*/

// ── Suite 4: Login ──────────────────────────────────────────────────────────
  console.log("\n🔑  Suite 4: Login");
  {
    const p = await newPage();
    // 1. Create the user
    await signUp(p, "loginuser", "login@test.com", "mypass");
    
    // 2. Log them out so we can test the Login form
    // Instead of just a fetch, let's actually click a logout button if you have one, 
    // or force a redirect to a clean BASE URL.
    await p.goto(BASE, { waitUntil: "networkidle0" });
    await p.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    // 3. Go back to Landing and wait for the Login box to be visible
    await p.goto(BASE, { waitUntil: "networkidle0" });
    await p.waitForSelector("#loginEmail", { visible: true });

    // 4. Perform the Login
    await p.type("#loginEmail",    "login@test.com");
    await p.type("#loginPassword", "mypass");
    await p.click("#loginBtn");
    
    await p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});

    check(p.url().includes("index.html"), "Redirected to index.html after login");

    await p.close();
  }

  // ── Suite 5: Invalid Login ──────────────────────────────────────────────────
  console.log("\n🚫  Suite 5: Invalid Login");
  {
    const p = await newPage();
    await p.goto(BASE, { waitUntil: "networkidle0" });
    await p.type("#loginEmail",    "nobody@test.com");
    await p.type("#loginPassword", "wrong");
    await p.click("#loginBtn");
    await pause(500);

    const err = await p.$eval("#authMessage", el => el.textContent.trim());
    check(err === "Invalid email or password.", `Correct invalid-login error: "${err}"`);

    await p.close();
  }

  // ── Suite 6: Logout ─────────────────────────────────────────────────────────
  console.log("\n🚪  Suite 6: Logout");
  {
    const p = await newPage();
    await signUp(p, "logoutuser", "logout@test.com", "pass");
    check(p.url().includes("index.html"), "On index.html before logout");
    await p.click("#logoutBtn");
    await p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    check(!p.url().includes("/app"), "Redirected away from /app after logout");

    await p.close();
  }

  // ── Suite 7: Protected Route ────────────────────────────────────────────────
  console.log("\n🔒  Suite 7: Protected Route (/app without session)");
  {
    const p = await newPage();
    await p.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
    check(!p.url().includes("/app"), "Unauthenticated user redirected away from /app");
    await p.close();
  }

  // ── Suite 8: Submit Prompt ──────────────────────────────────────────────────
  console.log("\n💬  Suite 8: Submit Prompt");
  {
    const p = await newPage();
    await signUp(p, "promptuser", "prompt@test.com", "pass");

    await p.type("#promptInput", "How do I study for an exam?");
    await p.click("#sendBtn");
    await p.waitForSelector(".responseCard", { timeout: 5000 });

    check(await p.$(".responseCard") !== null, "Response card appears after submission");
    const text = await p.$eval(".responseCard", el => el.textContent.toLowerCase());
    check(
      text.includes("study") || text.includes("exam"),
      "Response card contains study-related content"
    );

    await p.close();
  }

  // ── Suite 9: Empty Prompt ───────────────────────────────────────────────────
  console.log("\n🔕  Suite 9: Empty Prompt");
  {
    const p = await newPage();
    await signUp(p, "emptyuser", "empty@test.com", "pass");

    // Leave prompt blank and click send
    await p.click("#sendBtn");
    await pause(500);

    const cards = await p.$$(".responseCard");
    check(cards.length === 0, "No response card created for empty prompt");

    await p.close();
  }

  // ── Suite 10: Prompt Appears in Sidebar ────────────────────────────────────
  console.log("\n📋  Suite 10: Chat Sidebar Updated");
  {
    const p = await newPage();
    await signUp(p, "sidebaruser", "sidebar@test.com", "pass");

    await p.type("#promptInput", "Sidebar test prompt");
    await p.click("#sendBtn");
    await p.waitForFunction(
      () => document.querySelector("#chatList li") !== null,
      { timeout: 5000 }
    );

    const items = await p.$$("#chatList li");
    check(items.length > 0, "Submitted prompt appears in Chats sidebar");

    await p.close();
  }

  // ── Suite 11: Bookmark ──────────────────────────────────────────────────────
  console.log("\n🔖  Suite 11: Bookmark Conversation");
  {
    const p = await newPage();
    await signUp(p, "bmuser", "bm@test.com", "pass");

    await p.type("#promptInput", "Please bookmark this");
    await p.click("#sendBtn");
    await p.waitForSelector(".responseCard");

    await p.click(".responseActions button"); // Bookmark button
    await p.waitForFunction(
      () => document.querySelector("#bookmarkList li") !== null,
      { timeout: 5000 }
    );

    const items = await p.$$("#bookmarkList li");
    check(items.length > 0, "Bookmarked conversation appears in Bookmarked Chats sidebar");

    await p.close();
  }

  // ── Suite 12: Delete Conversation ──────────────────────────────────────────
  console.log("\n🗑️   Suite 12: Delete Conversation");
  {
    const p = await newPage();
    await signUp(p, "deluser", "del@test.com", "pass");

    await p.type("#promptInput", "Delete me");
    await p.click("#sendBtn");
    await p.waitForSelector("#chatList li");

    p.once("dialog", async d => await d.accept());
    const delBtn = await p.$('#chatList li button:last-child');
    await delBtn.click();
    await pause(700);

    const items = await p.$$("#chatList li");
    check(items.length === 0, "Deleted conversation removed from Chats sidebar");

    await p.close();
  }

  // ── Suite 13: Cancel Delete ─────────────────────────────────────────────────
  console.log("\n↩️   Suite 13: Cancel Delete");
  {
    const p = await newPage();
    await signUp(p, "canceluser", "cancel@test.com", "pass");

    await p.type("#promptInput", "Keep me");
    await p.click("#sendBtn");
    await p.waitForSelector("#chatList li");

    p.once("dialog", async d => await d.dismiss());
    const delBtn = await p.$('#chatList li button:last-child');
    await delBtn.click();
    await pause(500);

    const items = await p.$$("#chatList li");
    check(items.length > 0, "Conversation remains after cancelled deletion");

    await p.close();
  }

  // ── Suite 14: Response Word Limit ──────────────────────────────────────────
  console.log("\n✂️   Suite 14: Shorten Response");
  {
    const p = await newPage();
    await signUp(p, "shortuser", "short@test.com", "pass");

    // Enable shorten toggle and set limit to 5 words
    const checked = await p.$eval("#shortenToggle", el => el.checked);
    if (!checked) await p.click("#shortenToggle");

    await p.$eval("#wordLimit", el => (el.value = ""));
    await p.type("#wordLimit", "5");

    p.once("dialog", async d => await d.accept()); // alert from saveSettings
    await p.click("#saveSettingsBtn");
    await pause(400);

    await p.type("#promptInput", "Explain studying techniques in detail");
    await p.click("#sendBtn");
    await p.waitForSelector(".responseCard");

    const responseEl = await p.$(".responseCard p:nth-child(3)");
    const text = await p.evaluate(el => el.textContent, responseEl);
    const words = text.replace(/^Response:\s*/i, "").trim().split(/\s+/);
    check(words.length <= 5, `Response capped at 5 words (got ${words.length})`);

    await p.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  await browser.close();

  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Results:  ✅ Passed: ${pass}   ❌ Failed: ${fail}   Total: ${pass + fail}`);
  console.log("─".repeat(55));

  if (fail > 0) process.exit(1);
})().catch(err => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
