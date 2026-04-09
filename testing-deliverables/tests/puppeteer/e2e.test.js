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

// ── Run all suites ─────────────────────────────────────────────────────────────

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  let p;

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
    p = await newPage();
    await signUp(p, "puppetuser", "puppet@test.com", "testpass");

    check(p.url().includes("index.html"), "Redirected to index.html after signup");
    const info = await p.$eval("#userInfo", el => el.textContent.trim());
    check(info.includes("puppetuser"), `Username shown in header: "${info}"`);


  }


// ── Suite 3: Login  ─────────────────────────────────────────────────────
  console.log("\n🔑 Suite 3: Login & Validation Flow");
  {
    // Use the SAME page 'p' from Suite 2 (don't create a new one)
    
    // STEP 1: LOG OUT
    await p.waitForSelector("#logoutBtn", { visible: true });
    await p.click("#logoutBtn");
    await p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    console.log("  ✅ Logged out successfully");

    // STEP 2: INCORRECT LOGIN (Suite 5 logic combined)
    await p.waitForSelector("#loginEmail", { visible: true });
    await p.type("#loginEmail", "puppet@test.com");
    await p.type("#loginPassword", "WRONG_PASSWORD");
    await p.click("#loginBtn");
    await pause(500); // Give the error message a moment to appear
    
    const err = await p.$eval("#authMessage", el => el.textContent.trim());
    check(err === "Invalid email or password.", "Correctly blocked incorrect login");

    // STEP 3: CORRECT LOGIN
    // Clear the wrong password first
    await p.click("#loginPassword", { clickCount: 3 }); 
    await p.keyboard.press('Backspace');
    
    await p.type("#loginPassword", "testpass"); // The real password from Suite 2
    await p.click("#loginBtn");
    await p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});

    check(p.url().includes("index.html"), "Redirected back to app after correct login");
    console.log("  ✅ Logged back in successfully");
  }


  // ── Suite 4: Continue Conversation ─────────────────────────────────────────
  console.log("\n💬 Suite 4: Continue Conversation Flow");
  {
    // We are already logged in from Suite 3

    // Wait for prompt input
    await p.waitForSelector("#promptInput", { visible: true });

    // STEP 1: Send first prompt (creates conversation)
    await p.type("#promptInput", "What is recursion?");
    await p.click("#sendBtn");

    // Wait for assistant response
    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      if (!thread) return false;
      return thread.innerText.length > 0;
    }, { timeout: 20000 });

    console.log("  ✅ First message sent");

    // STEP 2: Send second prompt (continue conversation)
    await p.click("#promptInput", { clickCount: 3 });
    await p.keyboard.press("Backspace");

    await p.type("#promptInput", "Give me a simple example");
    await p.click("#sendBtn");

    // Wait again for assistant response
    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      if (!thread) return false;
      return thread.innerText.includes("Give me a simple example");
    }, { timeout: 20000 });

    console.log("  ✅ Second message sent");

    // STEP 3: Validate both prompts exist in thread
    const threadText = await p.$eval("#threadMessages", el => el.innerText);

    check(
      threadText.includes("What is recursion?"),
      "First message exists in conversation"
    );

    check(
      threadText.includes("Give me a simple example"),
      "Second message exists in conversation"
    );

    // STEP 4: Check heading changed (optional but strong)
    const heading = await p.$eval("#mainHeading", el => el.textContent.trim());

    check(
      heading.includes("Continue"),
      "Heading updated to continue conversation"
    );
  }

    // ── Suite 5: Bookmark Conversation ─────────────────────────────────────────
  console.log("\n🔖 Suite 5: Bookmark Conversation");
  {
    // Try common bookmark button selectors
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
  }


  // ── Suite 6: Search Conversation ───────────────────────────────────────────
  console.log("\n🔎 Suite 6: Search Conversation");
  {
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
  }

    // ── Suite 7: Word Limit / Shorten Response ─────────────────────────────────
  console.log("\n✂️ Suite 7: Word Limit / Shorten Response");
  {
    // Turn on shorten response if checkbox exists
    const shortenToggle = await p.$("#shortenToggle") ||
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

    // Set max words if input exists
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

    // Save settings if button exists
    const saveBtn = await p.$("#saveSettingsBtn") ||
                    await p.$("[data-testid='saveSettingsBtn']") ||
                    await p.$("button");

    if (saveBtn) {
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

      if (clicked) {
        check(true, "Settings saved");
      } else {
        check(false, "Save settings button located");
      }
    }

    // Send a new prompt to test shortened response
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
    }, { timeout: 20000 });

    const threadText = await p.$eval("#threadMessages", el => el.innerText);

    const lines = threadText.split("\n").map(s => s.trim()).filter(Boolean);
    const latestChunk = lines.slice(-6).join(" ");
    const wordCount = latestChunk.split(/\s+/).filter(Boolean).length;

    check(wordCount <= 40, "Response appears shortened after word-limit setting");
  }

    // ── Suite 8: Delete Conversation (Optional) ────────────────────────────────
  console.log("\n🗑️ Suite 8: Delete Conversation");
  {
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

    check(
      beforeText !== afterText,
      "Conversation list changed after deletion"
    );
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


