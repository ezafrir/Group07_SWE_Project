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

When('the user types {string} into the prompt box', async function (text) {
  await page.type('#prompt-input', text);
});

When('the user clicks the send button', async function () {
  await page.click('#send-button');
});

When('the response has finished loading', async function () {
  await page.waitForSelector('#loading-icon', { hidden: true, timeout: 30000 });
});

Then('the conversation should appear in the chat history sidebar', async function () {
  await page.waitForSelector('.sidebar-conversation-item', { visible: true, timeout: 5000 });

  const items = await page.$$('.sidebar-conversation-item');
  if (items.length === 0) {
    throw new Error('No conversations found in the sidebar after sending a message');
  }
});
