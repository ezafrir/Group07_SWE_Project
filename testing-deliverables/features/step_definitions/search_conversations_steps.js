const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

let browser;
let page;

Before(async function () {
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
});

After(async function () {
  await browser.close();
});

Given('the user is on the PistachioAI chat page', async function () {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('#prompt-input');
});

Given('multiple conversations exist in the sidebar', async function () {
  await page.waitForSelector('.sidebar-conversation-item', { visible: true, timeout: 5000 });

  const items = await page.$$('.sidebar-conversation-item');
  if (items.length < 2) {
    throw new Error('Need at least 2 conversations in the sidebar to test search — seed your DB');
  }
});

When('the user types {string} into the search bar', async function (keyword) {
  await page.waitForSelector('#search-input');
  await page.type('#search-input', keyword);
});

Then('only conversations containing {string} should be displayed in the sidebar', async function (keyword) {
  await page.waitForTimeout(500); // give filter time to apply

  const items = await page.$$('.sidebar-conversation-item');
  if (items.length === 0) {
    throw new Error(`No conversations shown after searching for "${keyword}"`);
  }

  // Check that every visible item contains the keyword (case-insensitive)
  for (const item of items) {
    const text = await page.evaluate(el => el.textContent.toLowerCase(), item);
    if (!text.includes(keyword.toLowerCase())) {
      throw new Error(`Sidebar item "${text}" does not match search keyword "${keyword}"`);
    }
  }
});

// --- Steps for second scenario ---

Given('the user has searched for {string} in the search bar', async function (keyword) {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('#search-input');
  await page.type('#search-input', keyword);
  await page.waitForTimeout(500);
});

Given('matching conversations are displayed', async function () {
  const items = await page.$$('.sidebar-conversation-item');
  if (items.length === 0) throw new Error('No search results found');
});

When('the user clicks on one of the search results', async function () {
  const firstResult = await page.$('.sidebar-conversation-item');
  await firstResult.click();
});

Then('that conversation should be loaded and displayed', async function () {
  await page.waitForSelector('.chat-message', { visible: true, timeout: 5000 });

  const messages = await page.$$('.chat-message');
  if (messages.length === 0) throw new Error('No messages displayed after opening search result');
});
