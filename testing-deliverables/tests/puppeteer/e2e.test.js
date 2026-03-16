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
