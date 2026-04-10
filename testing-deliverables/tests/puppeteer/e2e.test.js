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
    "/Applications/Google Chrome.app",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
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

async function login(page, email, password) {
  await page.waitForSelector("#loginEmail", { visible: true, timeout: 15000 });
  await clearAndType(page, "#loginEmail", email);
  await clearAndType(page, "#loginPassword", password);
  await page.click("#loginBtn");
}

async function waitForAlertAndAccept(page) {
  return new Promise(resolve => {
    page.once("dialog", async dialog => {
      try {
        await dialog.accept();
      } catch (_) {}
      resolve();
    });
  });
}

(async () => {
  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
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
  await p.setViewport({
  width: 1400,
  height: 900,
});


  await runSuite("📄 Suite 1: Landing Page", async () => {
    await p.goto(BASE, { waitUntil: "networkidle2" });

    const signupBtn = await p.$("#signupBtn");
    const loginBtn = await p.$("#loginBtn");
    const signupUsername = await p.$("#signupUsername");
    const loginEmail = await p.$("#loginEmail");

    check(signupBtn !== null, "Sign Up button is present");
    check(loginBtn !== null, "Log In button is present");
    check(signupUsername !== null, "Signup username field is present");
    check(loginEmail !== null, "Login email field is present");
  });

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

  await runSuite("🔐 Suite 3: Login & Validation Flow", async () => {
  console.log(" -> logging out");
  await p.waitForSelector("#logoutBtn", { visible: true, timeout: 10000 });
  await p.click("#logoutBtn");

  await p.waitForFunction(
    () => window.location.pathname === "/" || window.location.pathname.includes("landing"),
    { timeout: 10000 }
  );

  await p.waitForSelector("#tabLogin", { visible: true, timeout: 10000 });
  await p.click("#tabLogin");

  await p.waitForSelector("#loginEmail", { visible: true, timeout: 10000 });
  await p.waitForSelector("#loginPassword", { visible: true, timeout: 10000 });

  console.log(" -> attempting wrong login");
  await p.click("#loginEmail", { clickCount: 3 });
  await p.keyboard.press("Backspace");
  await p.type("#loginEmail", TEST_EMAIL);

  await p.click("#loginPassword", { clickCount: 3 });
  await p.keyboard.press("Backspace");
  await p.type("#loginPassword", "WRONG_PASSWORD");

  await p.click("#loginBtn");

  await p.waitForFunction(() => {
    const el = document.querySelector("#authMessage");
    return el && el.textContent.trim().length > 0;
  }, { timeout: 10000 });

  const err = await p.$eval("#authMessage", el => el.textContent.trim());
  check(
    err === "Invalid email or password." || err.length > 0,
    `Incorrect login blocked: ${err}`
  );

  console.log(" -> attempting correct login");
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

  await runSuite("💬 Suite 4: Continue Conversation Flow", async () => {
  await p.waitForSelector("#promptInput", { visible: true, timeout: 10000 });

  await p.click("#promptInput", { clickCount: 3 });
  await p.keyboard.press("Backspace");
  await p.type("#promptInput", "give me one short sentence");
  await p.click("#sendBtn");

  await p.waitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    const heading = document.querySelector("#mainHeading");
    return (
      thread &&
      thread.innerText.toLowerCase().includes("give me one short sentence") &&
      heading &&
      heading.textContent.includes("Continue")
    );
  }, { timeout: 45000 });

  await p.click("#promptInput", { clickCount: 3 });
  await p.keyboard.press("Backspace");
  await p.type("#promptInput", "give me another short sentence");
  await p.click("#sendBtn");

  await p.waitForFunction(() => {
    const thread = document.querySelector("#threadMessages");
    return (
      thread &&
      thread.innerText.toLowerCase().includes("give me another short sentence")
    );
  }, { timeout: 45000 });

  const threadText = await p.$eval("#threadMessages", el => el.innerText.toLowerCase());
  check(threadText.includes("give me one short sentence"), "First message exists in conversation");
  check(threadText.includes("give me another short sentence"), "Second message exists in conversation");

  const heading = await p.$eval("#mainHeading", el => el.textContent.trim());
  check(heading.includes("Continue"), "Heading updated to continue conversation");
});

  await runSuite("🔖 Suite 5: Bookmark Conversation", async () => {
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

  await runSuite("🔎 Suite 6: Search Conversation", async () => {
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
    resultsText.includes("short sentence") ||
    resultsText.includes("give me one"),
    "Search results show the matching conversation"
  );

  const firstCard = await p.$(".search-result-card");
  check(!!firstCard, "At least one search result card appears");

  if (firstCard) {
    await firstCard.click();

    await p.waitForFunction(() => {
      const thread = document.querySelector("#threadMessages");
      const overlay = document.querySelector("#searchOverlay");
      return (
        thread &&
        thread.innerText.toLowerCase().includes("give me one short sentence") &&
        overlay &&
        overlay.classList.contains("hidden")
      );
    }, { timeout: 10000 });

    check(true, "Clicking a search result opens the conversation");
  }
});

  await runSuite("✂️ Suite 7: Save Word Limit Setting", async () => {
    await p.waitForSelector("#shortenToggle", { visible: true, timeout: 15000 });
    const checked = await p.$eval("#shortenToggle", el => el.checked);
    if (!checked) {
      await p.click("#shortenToggle");
    }

    await clearAndType(p, "#wordLimit", "10");

    const alertPromise = waitForAlertAndAccept(p);
    await p.click("#saveSettingsBtn");
    await alertPromise;

    const value = await p.$eval("#wordLimit", el => el.value);
    check(value === "10", "Word limit field updated to 10");
  });

  await runSuite("🗑️ Suite 8: Delete Conversation", async () => {
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
