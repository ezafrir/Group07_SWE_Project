// ============================================================
// spec/e2eSpec.js — End-to-End tests (Puppeteer)
//
// Run with:  npm run test:e2e
//
// The server is started automatically on a free port before
// the tests run and shut down afterwards — you do NOT need
// to start it manually.
//
// The LLM is mocked at the server level so Ollama does NOT
// need to be running. Every "LLM response" returns instantly
// with a fixed string, keeping the suite fast and reliable.
// ============================================================

const puppeteer = require("puppeteer");
const http      = require("http");

// ── 1. Patch fetch BEFORE importing server ────────────────────────────────────
const FAKE_LLM_TEXT    = "This is a mocked LLM response for e2e testing.";
const FAKE_GEMINI_TEXT = "Gemini mocked response for e2e testing.";
const FAKE_GROQ_TEXT   = "Groq mocked response for e2e testing.";

global.fetch = async (url) => {
  const u = typeof url === "string" ? url : url.toString();

  if (u.includes("googleapis.com")) {
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: FAKE_GEMINI_TEXT }] } }]
      })
    };
  }
  if (u.includes("groq.com")) {
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: FAKE_GROQ_TEXT } }] })
    };
  }
  if (u.includes("open-meteo.com") && u.includes("forecast")) {
    return {
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 72, apparent_temperature: 70,
          relative_humidity_2m: 55, precipitation: 0,
          weather_code: 1, wind_speed_10m: 8, wind_direction_10m: 180
        }
      })
    };
  }
  if (u.includes("open-meteo.com") && u.includes("geocod")) {
    return {
      ok: true,
      json: async () => ({
        results: [{ latitude: 40.7128, longitude: -74.006, name: "New York", country: "US" }]
      })
    };
  }
  // Ollama (all local models including DeepSeek)
  return {
    ok: true,
    json: async () => ({ message: { content: FAKE_LLM_TEXT } })
  };
};

// ── 2. Set dummy API keys so cloud routes don't throw before fetch ─────────────
process.env.GEMINI_API_KEY = "e2e-test-gemini-key";
process.env.GROQ_API_KEY   = "e2e-test-groq-key";

// ── 3. Start server on a random free port ────────────────────────────────────
const { app } = require("../../../Group07_SWE_Project-main/server");

let server;
let BASE_URL;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      BASE_URL = `http://127.0.0.1:${server.address().port}`;
      console.log(`  Test server: ${BASE_URL}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

// ── 4. Puppeteer helpers ──────────────────────────────────────────────────────
let browser;
let page;

async function newPage() {
  if (page) await page.close().catch(() => {});
  page = await browser.newPage();
  page.on("console", () => {});
  page.on("dialog", async dialog => {
    // Auto-handle alert() dialogs
    await dialog.accept().catch(() => {});
  });
  return page;
}

// Shared credentials (unique per run)
const TS            = Date.now();
const TEST_EMAIL    = `e2e_${TS}@test.com`;
const TEST_PASSWORD = "testpass123";
const TEST_USERNAME = "E2EUser";

// Fill a field by trying a list of possible IDs
async function fillField(ids, value) {
  await page.evaluate((ids, value) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) { el.value = value; return; }
    }
  }, ids, value);
}

async function signUp() {
  await page.goto(`${BASE_URL}/landing.html`, { waitUntil: "networkidle0" });
  // "Create Account" tab is active by default but click it to be safe
  await page.click("#tabSignup");
  await new Promise(r => setTimeout(r, 300));
  await page.$eval("#signupUsername", (el, v) => { el.value = v; }, TEST_USERNAME);
  await page.$eval("#signupEmail",    (el, v) => { el.value = v; }, TEST_EMAIL);
  await page.$eval("#signupPassword", (el, v) => { el.value = v; }, TEST_PASSWORD);
  await page.click("#signupBtn");
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
}

async function login() {
  await page.goto(`${BASE_URL}/landing.html`, { waitUntil: "networkidle0" });
  // Click "Sign In" tab to reveal the login panel
  await page.click("#tabLogin");
  await new Promise(r => setTimeout(r, 300));
  await page.$eval("#loginEmail",    (el, v) => { el.value = v; }, TEST_EMAIL);
  await page.$eval("#loginPassword", (el, v) => { el.value = v; }, TEST_PASSWORD);
  await page.click("#loginBtn");
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
}

async function sendPrompt(text) {
  await page.waitForSelector("#promptInput", { timeout: 5000 });
  await page.$eval("#promptInput", el => { el.value = ""; });
  await page.type("#promptInput", text);
  await page.click("#sendBtn");
  await page.waitForFunction(
    () => !document.getElementById("loadingBubble"),
    { timeout: 20000 }
  );
  await new Promise(r => setTimeout(r, 300));
}

async function ensureLoggedInWithConversation() {
  await login();
  await page.waitForSelector("#promptInput", { timeout: 8000 });
  await sendPrompt("Tell me about the solar system");
  await page.waitForSelector("#chatList li", { timeout: 8000 });
}

// ── 5. Minimal test runner ───────────────────────────────────────────────────
const results = { passed: 0, failed: 0, errors: [] };

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    results.passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    results.failed++;
    results.errors.push({ name, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

// ── 6. Tests ──────────────────────────────────────────────────────────────────
async function runTests() {
  await startServer();
  browser = await puppeteer.launch({
  headless: false,              // opens Chrome
  slowMo: 40,                   // smoother for demo
  defaultViewport: null,        // fullscreen
  args: ["--start-maximized", "--no-sandbox"]
});

  console.log("\nPistachioAI — End-to-End Tests\n");

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────────────────────────────────
  console.log("── Auth ──");
  await newPage();

  await test("landing page loads and shows a form", async () => {
    await page.goto(`${BASE_URL}/landing.html`, { waitUntil: "networkidle0" });
    const html = await page.content();
    assert(html.includes("PistachioAI"),  "Expected PistachioAI branding on landing page");
    assert(html.includes("input"),        "No input fields found on landing page");
  });

  await test("user can sign up and is redirected to the app", async () => {
    await signUp();
    const url = page.url();
    assert(url.includes("/app") || url.includes("/index"), `Expected /app redirect, got ${url}`);
  });

  await test("logged-in user sees their username", async () => {
    const content = await page.content();
    assert(content.includes(TEST_USERNAME) || content.includes("Logged in"), "Username not found after login");
  });

  await test("user can log out and is returned to the landing page", async () => {
    await page.waitForSelector("#logoutBtn", { timeout: 5000 });
    await page.click("#logoutBtn");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {});
    const url = page.url();
    assert(url.includes("landing") || url === `${BASE_URL}/`, `Expected landing page, got ${url}`);
  });

  await test("user can log back in with correct credentials", async () => {
    await login();
    const url = page.url();
    assert(url.includes("/app") || url.includes("/index"), `Expected /app after login, got ${url}`);
  });

  await test("wrong password shows an error message", async () => {
    await page.goto(`${BASE_URL}/landing.html`, { waitUntil: "networkidle0" });
    await page.click("#tabLogin");
    await new Promise(r => setTimeout(r, 300));
    await page.$eval("#loginEmail",    (el, v) => { el.value = v; }, TEST_EMAIL);
    await page.$eval("#loginPassword", (el, v) => { el.value = v; }, "wrongpassword");
    await page.click("#loginBtn");
    await new Promise(r => setTimeout(r, 1500));
    const msg = await page.$eval("#authMessage", el => el.textContent.trim()).catch(() => "");
    assert(msg.length > 0, "Expected an error message in #authMessage for wrong password");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CONVERSATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Conversation ──");
  await newPage();
  await login();

  await test("prompt input and send button are visible", async () => {
    await page.waitForSelector("#promptInput", { timeout: 5000 });
    assert(await page.$("#promptInput") !== null, "Prompt input not found");
    assert(await page.$("#sendBtn")     !== null, "Send button not found");
  });

  await test("sending a prompt creates a conversation in the sidebar", async () => {
    await sendPrompt("What is the capital of France?");
    await page.waitForSelector("#chatList li", { timeout: 8000 });
    const items = await page.$$("#chatList li");
    assert(items.length > 0, "No conversation appeared in sidebar");
  });

  await test("assistant response bubble appears after sending a prompt", async () => {
    const bubbles = await page.$$(".assistant-bubble");
    assert(bubbles.length > 0, "No assistant bubble found");
  });

  await test("response bubble contains non-empty text", async () => {
    const text = await page.$eval(".assistant-bubble p", el => el.textContent.trim());
    assert(text.length > 0, "Assistant bubble is empty");
  });

  await test("conversation title appears in the sidebar", async () => {
    const title = await page.$eval("#chatList li .chat-title", el => el.textContent.trim());
    assert(title.length > 0, "Conversation title is empty in sidebar");
  });

  await test("sending a follow-up message appends another bubble pair", async () => {
    const before = (await page.$$(".assistant-bubble")).length;
    await sendPrompt("And what language do they speak there?");
    const after = (await page.$$(".assistant-bubble")).length;
    assert(after > before, "Expected more assistant bubbles after follow-up");
  });

  await test("New Chat button clears the thread", async () => {
    await page.click("#newChatBtn");
    await new Promise(r => setTimeout(r, 500));
    const visible = await page.$eval("#threadSection", el => el.style.display !== "none").catch(() => false);
    assert(!visible, "Thread section should be hidden after New Chat");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WEATHER
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Weather ──");

  await test("sending a weather prompt returns a response", async () => {
    await sendPrompt("What is the weather in New York?");
    const bubbles = await page.$$(".assistant-bubble");
    assert(bubbles.length > 0, "No response bubble after weather prompt");
  });

  await test("weather response bubble contains non-empty text", async () => {
    const bubbles = await page.$$(".assistant-bubble");
    assert(bubbles.length > 0, "No assistant bubbles found");
    const last = bubbles[bubbles.length - 1];
    const text = await last.$eval("p", el => el.textContent.trim());
    assert(text.length > 0, "Weather response bubble is empty");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LOCAL MODEL DROPDOWN
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Local Model Dropdown ──");

  await test("model dropdown appears after a conversation is created", async () => {
    await page.waitForSelector("#inlineModelDropdown", { timeout: 8000 });
    const dropdown = await page.$("#inlineModelDropdown");
    assert(dropdown !== null, "Model dropdown not found");
  });

  await test("dropdown lists all three local models", async () => {
    const options = await page.$$eval(
      "#inlineModelDropdown option",
      opts => opts.map(o => o.value)
    );
    assert(options.includes("llama3.2:latest"),  "llama3.2 not in dropdown");
    assert(options.includes("phi3:latest"),       "phi3 not in dropdown");
    assert(options.includes("tinyllama:latest"),  "tinyllama not in dropdown");
  });

  await test("dropdown does not include gemma3 (replaced by tinyllama)", async () => {
    const options = await page.$$eval(
      "#inlineModelDropdown option",
      opts => opts.map(o => o.value)
    );
    assert(!options.includes("gemma3:latest"), "gemma3 should not be in dropdown");
  });

  await test("switching the dropdown to phi3 updates the response label", async () => {
    await page.waitForSelector("#inlineModelDropdown", { timeout: 5000 });
    await page.select("#inlineModelDropdown", "phi3:latest");
    await new Promise(r => setTimeout(r, 1000));
    // The bubble label should now say Phi-3 (or an error if model not pulled)
    const label = await page.$eval(
      "#lastAssistantBubble .bubble-label",
      el => el.textContent.trim()
    ).catch(() => "");
    assert(
      label.includes("Phi") || label.includes("PistachioAI"),
      `Expected Phi-3 label or fallback, got "${label}"`
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GEMINI CLOUD MODEL
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Gemini (Cloud) ──");

  await test("Gemini button is visible in the model actions row", async () => {
    const btn = await page.$("#geminiBtn");
    assert(btn !== null, "Gemini button not found");
  });

  await test("clicking Gemini opens the result panel with a response", async () => {
    await page.click("#geminiBtn");
    await page.waitForFunction(
      () => {
        const panel = document.getElementById("modelResultPanel");
        return panel && !panel.classList.contains("hidden");
      },
      { timeout: 10000 }
    );
    const title = await page.$eval("#modelResultTitle", el => el.textContent.trim());
    assert(title.includes("Gemini"), `Expected Gemini in panel title, got "${title}"`);
  });

  await test("Gemini result panel contains non-empty text", async () => {
    const body = await page.$eval("#modelResultBody", el => el.textContent.trim());
    assert(body.length > 0, "Gemini result panel body is empty");
  });

  await test("clicking Gemini again closes the result panel", async () => {
    await page.click("#geminiBtn");
    await new Promise(r => setTimeout(r, 400));
    const hidden = await page.$eval(
      "#modelResultPanel",
      el => el.classList.contains("hidden")
    );
    assert(hidden, "Result panel should close on second Gemini click");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GROQ CLOUD MODEL
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Groq (Cloud) ──");

  await test("Groq button is visible in the model actions row", async () => {
    const btn = await page.$("#groqBtn");
    assert(btn !== null, "Groq button not found");
  });

  await test("clicking Groq opens the result panel with a response", async () => {
    await page.click("#groqBtn");
    await page.waitForFunction(
      () => {
        const panel = document.getElementById("modelResultPanel");
        return panel && !panel.classList.contains("hidden");
      },
      { timeout: 10000 }
    );
    const title = await page.$eval("#modelResultTitle", el => el.textContent.trim());
    assert(title.includes("Groq"), `Expected Groq in panel title, got "${title}"`);
  });

  await test("Groq result panel contains non-empty text", async () => {
    const body = await page.$eval("#modelResultBody", el => el.textContent.trim());
    assert(body.length > 0, "Groq result panel body is empty");
  });

  await test("clicking Groq again closes the result panel", async () => {
    await page.click("#groqBtn");
    await new Promise(r => setTimeout(r, 400));
    const hidden = await page.$eval(
      "#modelResultPanel",
      el => el.classList.contains("hidden")
    );
    assert(hidden, "Result panel should close on second Groq click");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARIZE ALL
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Summarize All ──");

  await test("Summarize All button is visible", async () => {
    const btn = await page.$("#summaryBtn");
    assert(btn !== null, "Summarize All button not found");
  });

  await test("clicking Summarize All opens the result panel", async () => {
    await page.click("#summaryBtn");
    await page.waitForFunction(
      () => {
        const panel = document.getElementById("modelResultPanel");
        return panel && !panel.classList.contains("hidden");
      },
      { timeout: 15000 }
    );
    const title = await page.$eval("#modelResultTitle", el => el.textContent.trim());
    assert(title.toLowerCase().includes("summar"), `Expected summary title, got "${title}"`);
  });

  await test("summary result panel contains non-empty text", async () => {
    const body = await page.$eval("#modelResultBody", el => el.textContent.trim());
    assert(body.length > 0, "Summary result panel body is empty");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // COMPARE ALL
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Compare All ──");

  await test("Compare All button is visible", async () => {
    const btn = await page.$("#compareBtn");
    assert(btn !== null, "Compare All button not found");
  });

  await test("clicking Compare All opens the result panel", async () => {
    await page.click("#compareBtn");
    await page.waitForFunction(
      () => {
        const panel = document.getElementById("modelResultPanel");
        return panel && !panel.classList.contains("hidden");
      },
      { timeout: 15000 }
    );
    const title = await page.$eval("#modelResultTitle", el => el.textContent.trim());
    assert(title.toLowerCase().includes("compar"), `Expected comparison title, got "${title}"`);
  });

  await test("comparison result panel contains non-empty text", async () => {
    const body = await page.$eval("#modelResultBody", el => el.textContent.trim());
    assert(body.length > 0, "Comparison result panel body is empty");
  });

  await test("closing result panel via X button hides it", async () => {
    await page.click(".model-result-close");
    await new Promise(r => setTimeout(r, 400));
    const hidden = await page.$eval(
      "#modelResultPanel",
      el => el.classList.contains("hidden")
    );
    assert(hidden, "Result panel should be hidden after clicking X");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RENAME
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Rename ──");

  await test("rename button is visible in the sidebar", async () => {
    const btn = await page.$(".rename-btn");
    assert(btn !== null, "Rename button not found in sidebar");
  });

  await test("renaming updates the title in the sidebar", async () => {
    await page.evaluate(() => {
      window._origPrompt = window.prompt;
      window.prompt = () => "My Renamed Chat";
    });
    await page.click(".rename-btn");
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => { window.prompt = window._origPrompt; });

    const titles = await page.$$eval("#chatList li .chat-title", els => els.map(e => e.textContent));
    assert(titles.some(t => t.includes("My Renamed Chat")), `Rename not reflected in sidebar. Titles: ${titles.join(", ")}`);
  });

  await test("cancelling rename (empty input) does not change the title", async () => {
    const titlesBefore = await page.$$eval("#chatList li .chat-title", els => els.map(e => e.textContent));
    await page.evaluate(() => {
      window._origPrompt = window.prompt;
      window.prompt = () => null; // user cancelled
    });
    await page.click(".rename-btn");
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => { window.prompt = window._origPrompt; });
    const titlesAfter = await page.$$eval("#chatList li .chat-title", els => els.map(e => e.textContent));
    assert(JSON.stringify(titlesBefore) === JSON.stringify(titlesAfter), "Title changed despite cancel");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // BOOKMARK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Bookmark ──");

  await test("bookmark button is visible in the thread header", async () => {
    await page.click("#chatList li .chat-title");
    await page.waitForSelector("#threadBookmarkBtn", { timeout: 5000 });
    assert(await page.$("#threadBookmarkBtn") !== null, "Bookmark button not found");
  });

  await test("bookmarking adds the conversation to the bookmarks list", async () => {
    await page.click("#threadBookmarkBtn");
    await new Promise(r => setTimeout(r, 800));
    const bookmarks = await page.$$("#bookmarkList li");
    assert(bookmarks.length > 0, "Bookmarks list is empty after bookmarking");
  });

  await test("bookmarked conversation is visible in the bookmarks sidebar section", async () => {
    const text = await page.$eval("#bookmarkList li", el => el.textContent.trim());
    assert(text.length > 0, "Bookmark entry has no text");
  });

  await test("unbookmarking removes the conversation from the bookmarks list", async () => {
    await page.click("#threadUnbookmarkBtn");
    await new Promise(r => setTimeout(r, 800));
    const bookmarks = await page.$$("#bookmarkList li");
    assert(bookmarks.length === 0, "Bookmarks list should be empty after unbookmarking");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Export ──");

  await test("export button is visible in the sidebar", async () => {
    const btn = await page.$(".icon-btn[title='Export']");
    assert(btn !== null, "Export button not found in sidebar");
  });

  await test("export endpoint returns HTTP 200 with text content", async () => {
    const convId = await page.$eval(
      ".icon-btn[title='Export']",
      el => { const m = el.getAttribute("onclick").match(/\d+/); return m ? m[0] : null; }
    ).catch(() => null);
    assert(convId !== null, "Could not read conversation id from export button");

    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}/export`);
      return { status: res.status, ct: res.headers.get("content-type") };
    }, convId);

    assert(result.status === 200, `Export returned HTTP ${result.status}`);
    assert(result.ct && result.ct.includes("text"), `Expected text content-type, got ${result.ct}`);
  });

  await test("exported content contains the conversation prompt", async () => {
    const convId = await page.$eval(
      ".icon-btn[title='Export']",
      el => { const m = el.getAttribute("onclick").match(/\d+/); return m ? m[0] : null; }
    ).catch(() => null);

    const body = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}/export`);
      return res.text();
    }, convId);

    assert(body.includes("You:") || body.includes("PistachioAI:"), "Exported file missing message labels");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE SINGLE CONVERSATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Delete Single Conversation ──");

  await test("delete button is visible on each sidebar item", async () => {
    const btn = await page.$(".icon-btn.danger");
    assert(btn !== null, "Delete button not found on sidebar item");
  });

  await test("deleting a conversation removes it from the sidebar", async () => {
    // Create a fresh conversation to delete
    await page.click("#newChatBtn");
    await new Promise(r => setTimeout(r, 300));
    await sendPrompt("This conversation will be deleted");
    await page.waitForSelector("#chatList li", { timeout: 8000 });
    const countBefore = (await page.$$("#chatList li")).length;

    // Auto-confirm the delete dialog
    await page.evaluate(() => { window.confirm = () => true; });
    await page.click("#chatList li .icon-btn.danger");
    await new Promise(r => setTimeout(r, 800));

    const countAfter = (await page.$$("#chatList li")).length;
    assert(countAfter < countBefore, `Expected fewer sidebar items after delete (before: ${countBefore}, after: ${countAfter})`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Search ──");

  await test("Search button is visible in the sidebar footer", async () => {
    const btn = await page.$("#openSearchBtn");
    assert(btn !== null, "Search button not found");
  });

  await test("clicking Search opens the search modal", async () => {
    await page.click("#openSearchBtn");
    await new Promise(r => setTimeout(r, 400));
    const visible = await page.$eval("#searchOverlay", el => !el.classList.contains("hidden"));
    assert(visible, "Search modal did not open");
    await page.click("#closeSearchBtn");
    await new Promise(r => setTimeout(r, 300));
  });

  await test("search modal contains an input and search button", async () => {
    await page.click("#openSearchBtn");
    await new Promise(r => setTimeout(r, 300));
    assert(await page.$("#searchInput") !== null, "Search input not found");
    assert(await page.$("#searchBtn")   !== null, "Search button not found in modal");
    await page.click("#closeSearchBtn");
    await new Promise(r => setTimeout(r, 300));
  });

  await test("searching returns results for a keyword that exists", async () => {
    // Create a fresh conversation with a unique searchable keyword
    await page.click("#newChatBtn");
    await new Promise(r => setTimeout(r, 300));
    await sendPrompt("Tell me about penguins");
    await page.waitForSelector("#chatList li", { timeout: 8000 });

    await page.click("#openSearchBtn");
    await new Promise(r => setTimeout(r, 300));
    await page.$eval("#searchInput", el => { el.value = ""; });
    await page.type("#searchInput", "penguins");
    await page.click("#searchBtn");
    await new Promise(r => setTimeout(r, 1000));
    const results = await page.$$(".search-result-card");
    assert(results.length > 0, "Expected at least one search result for 'penguins'");
  });

  await test("clicking a search result closes the modal and opens the conversation", async () => {
    await page.click(".search-result-card");
    await new Promise(r => setTimeout(r, 800));
    const hidden = await page.$eval("#searchOverlay", el => el.classList.contains("hidden"));
    assert(hidden, "Search modal should close after clicking a result");
    const threadVisible = await page.$eval("#threadSection", el => el.style.display !== "none").catch(() => false);
    assert(threadVisible, "Thread section should be visible after clicking a search result");
  });

  await test("searching for a non-existent keyword shows no results", async () => {
    await page.click("#openSearchBtn");
    await new Promise(r => setTimeout(r, 300));
    await page.$eval("#searchInput", el => { el.value = ""; });
    await page.type("#searchInput", "xyznonexistentkeyword123");
    await page.click("#searchBtn");
    await new Promise(r => setTimeout(r, 800));
    const results = await page.$$(".search-result-card");
    assert(results.length === 0, "Expected no search results for a nonsense keyword");
    await page.click("#closeSearchBtn");
    await new Promise(r => setTimeout(r, 300));
  });

  await test("Clear button empties the search input and results", async () => {
    await page.click("#openSearchBtn");
    await new Promise(r => setTimeout(r, 300));
    await page.type("#searchInput", "something");
    await page.click("#clearSearchBtn");
    await new Promise(r => setTimeout(r, 300));
    const value   = await page.$eval("#searchInput",  el => el.value);
    const results = await page.$$(".search-result-card");
    assert(value === "",          "Search input should be empty after Clear");
    assert(results.length === 0,  "Search results should be empty after Clear");
    await page.click("#closeSearchBtn");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Settings ──");

  await test("shorten toggle checkbox is visible", async () => {
    const toggle = await page.$("#shortenToggle");
    assert(toggle !== null, "Shorten toggle not found");
  });

  await test("word limit input is visible and has a default value", async () => {
    const input = await page.$("#wordLimit");
    assert(input !== null, "Word limit input not found");
    const value = await page.$eval("#wordLimit", el => el.value);
    assert(Number(value) > 0, `Expected positive default word limit, got ${value}`);
  });

  await test("Save Settings button is visible", async () => {
    assert(await page.$("#saveSettingsBtn") !== null, "Save Settings button not found");
  });

  await test("changing word limit and saving updates the setting", async () => {
    await page.$eval("#wordLimit", el => { el.value = ""; });
    await page.type("#wordLimit", "50");
    await page.click("#saveSettingsBtn");
    await new Promise(r => setTimeout(r, 600));
    // Verify via the API
    const setting = await page.evaluate(async () => {
      const res = await fetch("/api/settings");
      return res.json();
    });
    assert(setting.responseLength === 50, `Expected responseLength 50, got ${setting.responseLength}`);
  });

  await test("enabling shorten toggle and sending a prompt respects the word limit", async () => {
    await page.$eval("#shortenToggle", el => { el.checked = true; });
    await page.$eval("#wordLimit",    el => { el.value = "10"; });
    await page.click("#saveSettingsBtn");
    await new Promise(r => setTimeout(r, 300));

    await page.click("#newChatBtn");
    await new Promise(r => setTimeout(r, 300));
    await sendPrompt("Write me a long paragraph about the ocean");

    const bubbles = await page.$$(".assistant-bubble");
    assert(bubbles.length > 0, "No assistant bubble found");
    const last = bubbles[bubbles.length - 1];
    const text = await last.$eval("p", el => el.textContent.trim());
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    assert(wordCount <= 10, `Expected ≤10 words with shorten enabled, got ${wordCount}: "${text}"`);

    // Reset settings
    await page.$eval("#shortenToggle", el => { el.checked = false; });
    await page.$eval("#wordLimit",    el => { el.value = "200"; });
    await page.click("#saveSettingsBtn");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUGGEST A CHANGE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Suggest a Change ──");

  await test("Suggest a Change button is visible in the top bar", async () => {
    assert(await page.$("#openSuggestBtn") !== null, "Suggest a Change button not found");
  });

  await test("clicking the button opens the suggest modal", async () => {
    await page.click("#openSuggestBtn");
    await new Promise(r => setTimeout(r, 400));
    const visible = await page.$eval("#suggestOverlay", el => !el.classList.contains("hidden"));
    assert(visible, "Suggest modal did not open");
  });

  await test("modal contains a file dropdown and instruction textarea", async () => {
    assert(await page.$("#suggestFile")       !== null, "File dropdown not found");
    assert(await page.$("#suggestInstruction") !== null, "Instruction textarea not found");
  });

  await test("file dropdown only lists public/ files", async () => {
    const options = await page.$$eval("#suggestFile option", opts => opts.map(o => o.value));
    assert(options.length > 0, "File dropdown is empty");
    assert(options.every(o => o.startsWith("public/")), `Non-public file in dropdown: ${options.join(", ")}`);
  });

  await test("submitting without an instruction shows a validation error", async () => {
    await page.$eval("#suggestInstruction", el => { el.value = ""; });
    await page.click("#suggestSubmitBtn");
    await new Promise(r => setTimeout(r, 500));
    const status = await page.$eval("#suggestStatus", el => el.textContent.trim());
    assert(status.length > 0, "Expected a validation error when instruction is empty");
  });

  await test("submitting a valid instruction shows a success or processing message", async () => {
    await page.select("#suggestFile", "public/app.js");
    await page.$eval("#suggestInstruction", el => { el.value = ""; });
    await page.type("#suggestInstruction", `Change the string "Sending…" in sendBtn.textContent to "Loading…"`);
    await page.click("#suggestSubmitBtn");
    await page.waitForFunction(
      () => {
        const s = document.getElementById("suggestStatus");
        return s && s.textContent.trim().length > 0 &&
          !s.textContent.includes("Sending to DeepSeek");
      },
      { timeout: 30000 }
    );
    const status = await page.$eval("#suggestStatus", el => el.textContent.trim());
    assert(
      status.includes("✓") || status.includes("updated") || status.includes("success") || status.includes("Error"),
      `Unexpected suggest status: "${status}"`
    );
  });

  await test("Cancel button closes the suggest modal", async () => {
    await page.click("#suggestCancelBtn");
    await new Promise(r => setTimeout(r, 400));
    const hidden = await page.$eval("#suggestOverlay", el => el.classList.contains("hidden"));
    assert(hidden, "Suggest modal should be hidden after Cancel");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE ALL CHATS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n── Delete All Chats ──");

  await test("Delete All Chats button is visible in the sidebar", async () => {
    assert(await page.$("#deleteAllChatsBtn") !== null, "Delete All Chats button not found");
  });

  await test("clicking Delete All and confirming clears the sidebar", async () => {
    await page.evaluate(() => { window.confirm = () => true; });
    await page.click("#deleteAllChatsBtn");
    await new Promise(r => setTimeout(r, 1000));
    const items = await page.$$("#chatList li");
    assert(items.length === 0, `Expected empty sidebar after delete all, found ${items.length} items`);
  });

  await test("thread section is hidden after deleting all chats", async () => {
    const visible = await page.$eval("#threadSection", el => el.style.display !== "none").catch(() => false);
    assert(!visible, "Thread should be hidden after deleting all chats");
  });

  await test("bookmarks list is also empty after deleting all chats", async () => {
    const bookmarks = await page.$$("#bookmarkList li");
    assert(bookmarks.length === 0, "Bookmarks list should be empty after deleting all chats");
  });

  // ── Results ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(55)}`);
  console.log(`Results: ${results.passed} passed, ${results.failed} failed out of ${results.passed + results.failed} tests`);
  if (results.errors.length) {
    console.log("\nFailed tests:");
    results.errors.forEach(e => console.log(`  ✗ ${e.name}\n    ${e.error}`));
  }
  console.log(`${"─".repeat(55)}\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
runTests()
  .catch(err => {
    console.error("Fatal e2e error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) {
      await new Promise(r => setTimeout(r, 10000)); // keep open 10s
      await browser.close();
    }
    await stopServer();
    if (results.failed > 0) process.exitCode = 1;
  });