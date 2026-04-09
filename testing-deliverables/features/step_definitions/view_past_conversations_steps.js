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

Given('at least one past conversation exists in the sidebar', async function () {
  await page.waitForSelector('.sidebar-conversation-item', { visible: true, timeout: 5000 });

  const items = await page.$$('.sidebar-conversation-item');
  if (items.length === 0) {
    throw new Error('No past conversations found in the sidebar — seed your DB first');
  }
});

When('the user clicks on a conversation in the sidebar', async function () {
  const firstConversation = await page.$('.sidebar-conversation-item');
  await firstConversation.click();
});

Then("that conversation's messages should be loaded and displayed", async function () {
  await page.waitForSelector('.chat-message', { visible: true, timeout: 5000 });

  const messages = await page.$$('.chat-message');
  if (messages.length === 0) {
    throw new Error('No messages loaded after clicking a past conversation');
  }
});
