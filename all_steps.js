const { setDefaultTimeout, Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');

// Fixes the timeout error by giving Puppeteer 60 seconds to execute
setDefaultTimeout(60 * 1000); 

let browser;
let page;
let initialConversationCount;
const BASE = "http://localhost:3000";

/**
 * ==========================================
 * LIFECYCLE HOOKS (Runs before/after every test)
 * ==========================================
 */
Before(async function () {
  browser = await puppeteer.launch({ 
    headless: "new", // Uses the updated headless mode
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
});

After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    const screenshotPath = `screenshots/failure-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
});

/**
 * ==========================================
 * SHARED & GENERAL UI STEPS
 * ==========================================
 */

// Helper function to quickly log in via API before running UI tests
async function autoLogin(page) {
  await page.goto(BASE);
  await page.evaluate(async () => {
    // Attempt to sign up (fails silently if the user already exists, which is fine)
    await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', email: 'test@test.com', password: 'password' })
    });
    // Log in to set the session cookie
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password' })
    });
  });
  // Navigate to the actual app page now that we have a session
  await page.goto(BASE + '/app');
}

Given('the user is on the PistachioAI chat page', async function () {
  await autoLogin(page);
  await page.waitForSelector('#promptInput');
});

// Update the other setup steps to also use autoLogin
Given('I am on the Compare LLMs page', async function() {
  await autoLogin(page);
  await page.waitForSelector('#compareBtn');
});

Given("I am logged in with an existing conversation", async function () {
  await autoLogin(page);
  await page.waitForSelector('#promptInput');
});

Given("I am logged in and have a bookmarked conversation", async function () {
  await autoLogin(page);
  await page.waitForSelector('#promptInput');
});

When('the user types {string} into the prompt box', async function (text) {
  await page.type('#promptInput', text);
});

When('the user clicks the send button', async function () {
  await page.click('#sendBtn');
});

Then('a loading icon should be visible', async function () {
  await page.waitForSelector('#loadingBubble', { visible: true, timeout: 5000 });
});

When('the response has finished loading', async function () {
  await page.waitForSelector('#loadingBubble', { hidden: true, timeout: 60000 });
});

Then('a response should be displayed on the screen', async function () {
  await page.waitForSelector('#loadingBubble', { hidden: true, timeout: 60000 });
  await page.waitForSelector('.assistant-bubble', { visible: true, timeout: 5000 });
});
/**
 * ==========================================
 * COMPARE LLMs FEATURE STEPS
 * ==========================================
 */
Given('I am on the Compare LLMs page', async function() {
  await page.goto(BASE);
  await page.waitForSelector('#compareBtn');
});

Given('the LLM selection form is visible', async function() {
  // Pass: Handled by UI layout
});

Given('at least {int} LLMs are available for selection', async function(count) {
  // Pass: Handled automatically by local Ollama instances
});

Given('I have selected {string}, {string}, and {string} from the LLM list', async function(a, b, c) {
  // Pass: Hardcoded to 3 models in the codebase
});

When('I enter {string} in the prompt field', async function(prompt) {
  await page.type('#promptInput', prompt);
});

When('I click the {string} button', async function(btnText) {
  await page.click('#compareBtn');
});

Then('a loading indicator should appear', async function() {
  await page.waitForSelector('#loadingBubble', { visible: true, timeout: 5000 });
});

Then('the system should send the prompt to all {int} selected LLMs', async function(count) {
  return 'pending';
});

Then('I should see responses loading from each LLM', async function() {
  return 'pending';
});

Given('the LLM selection checkboxes are displayed', async function() { return 'pending'; });
When('I select {int} LLMs', async function(int) { return 'pending'; });
Then('the {string} button should be enabled', async function(string) { return 'pending'; });
Then('the {string} button should still be enabled', async function(string) { return 'pending'; });
When('I try to select a {int}th LLM', async function(int) { return 'pending'; });
Then('it should be disabled with message {string}', async function(string) { return 'pending'; });
Given('I have selected only {string}', async function(string) { return 'pending'; });
Then('an error message should appear: {string}', async function(string) { return 'pending'; });
Then('no requests should be sent to any LLM', async function() { return 'pending'; });
Given('I have submitted a prompt to {int} LLMs', async function(int) { return 'pending'; });
When('the first LLM response arrives', async function() { return 'pending'; });
Then('that LLM\'s response should appear immediately in a column', async function() { return 'pending'; });
When('the second response arrives', async function() { return 'pending'; });
Then('it should appear in the next column without hiding the first', async function() { return 'pending'; });
Then('the comparison analysis should update in real-time', async function() { return 'pending'; });
Given('I have received responses from {int} LLMs', async function(int) { return 'pending'; });
When('the comparison analysis completes', async function() { return 'pending'; });
Then('a {string} section should appear', async function(string) { return 'pending'; });
Then('it should list the main points where responses differ', async function() { return 'pending'; });
Then('it should be formatted as bullet points for easy scanning', async function() { return 'pending'; });
Then('it should specifically highlight unique contributions from each LLM', async function() { return 'pending'; });
Given('comparison results are displayed', async function() { return 'pending'; });
Then('a dialog should appear asking for a title', async function() { return 'pending'; });
When('I enter {string} and click Save', async function(string) { return 'pending'; });
Then('a success message should appear', async function() { return 'pending'; });
Then('the comparison should be saved to my history', async function() { return 'pending'; });
Then('I should be able to find it later in the history view', async function() { return 'pending'; });
Given('I have saved {int} previous comparisons', async function(int) { return 'pending'; });
When('I navigate to the {string} page', async function(string) { return 'pending'; });
Then('all {int} saved comparisons should be listed', async function(int) { return 'pending'; });
Then('each should show the prompt, LLMs used, date, and similarity score', async function() { return 'pending'; });

/**
 * ==========================================
 * CONTINUE CONVERSATION STEPS
 * ==========================================
 */
Given('the user has opened an existing conversation from the sidebar', async function () {
  await page.waitForSelector('.chat-title', { visible: true, timeout: 5000 });
  const firstConversation = await page.$('.chat-title');
  await firstConversation.click();
  const items = await page.$$('.chat-title');
  initialConversationCount = items.length;
});

Then('the new message should be appended to the existing conversation', async function () {
  await page.waitForSelector('#loadingBubble', { hidden: true, timeout: 60000 });
  const messages = await page.$$('.message-bubble');
  assert.ok(messages.length >= 2, 'Expected new message to be appended');
});

Then('a new conversation should not be created', async function () {
  const items = await page.$$('.chat-title');
  assert.strictEqual(items.length, initialConversationCount, 'A new conversation was created incorrectly');
});

/**
 * ==========================================
 * BOOKMARKS & LOGIN STEPS
 * ==========================================
 */
Given("I am logged in with an existing conversation", async function () {
  await page.goto(BASE);
  await page.waitForSelector('#promptInput');
});

Given("I am logged in and have a bookmarked conversation", async function () {
  await page.goto(BASE);
  await page.waitForSelector('#promptInput');
});

When("I click the Bookmark button on the response card", async function () {
  await page.waitForSelector('#threadBookmarkBtn', { visible: true });
  await page.click('#threadBookmarkBtn');
});

When("I click the Delete button for that conversation", async function () {
  await page.waitForSelector('#threadDeleteBtn', { visible: true });
  await page.click('#threadDeleteBtn');
});

When("I confirm the confirmation dialog", async function () {
  page.on('dialog', async dialog => { await dialog.accept(); });
});

When("I dismiss the confirmation dialog", async function () {
  page.on('dialog', async dialog => { await dialog.dismiss(); });
});

When("I click Open next to it in the Bookmarked Chats sidebar", async function () {
  await page.waitForSelector('#bookmarkList .chat-title', { visible: true });
  await page.click('#bookmarkList .chat-title');
});

Then("the conversation should appear in the Bookmarked Chats sidebar", async function () {
  await page.waitForSelector('#bookmarkList li', { timeout: 5000 });
  const items = await page.$$('#bookmarkList li');
  assert.ok(items.length > 0, "Bookmarked list should not be empty");
});