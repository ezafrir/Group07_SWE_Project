const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

let browser;
let page;
let initialConversationCount;

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

Given('the user has opened an existing conversation from the sidebar', async function () {
  await page.waitForSelector('.sidebar-conversation-item', { visible: true, timeout: 5000 });
  const firstConversation = await page.$('.sidebar-conversation-item');
  await firstConversation.click();
  await page.waitForSelector('.chat-message', { visible: true, timeout: 5000 });

  // Count current sidebar conversations so we can check no new one is created
  const items = await page.$$('.sidebar-conversation-item');
  initialConversationCount = items.length;
});

When('the user types {string} into the prompt box', async function (text) {
  await page.type('#prompt-input', text);
});

When('the user clicks the send button', async function () {
  await page.click('#send-button');
});

Then('the new message should be appended to the existing conversation', async function () {
  await page.waitForSelector('#loading-icon', { hidden: true, timeout: 30000 });

  const messages = await page.$$('.chat-message');
  if (messages.length < 2) {
    throw new Error('Expected new message to be appended — fewer than 2 messages found');
  }
});

Then('a new conversation should not be created', async function () {
  const items = await page.$$('.sidebar-conversation-item');
  if (items.length !== initialConversationCount) {
    throw new Error(
      `Expected ${initialConversationCount} conversations but found ${items.length} — a new one may have been created`
    );
  }
});
