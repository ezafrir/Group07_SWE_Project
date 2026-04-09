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

Then('a loading icon should be visible', async function () {
  await page.waitForSelector('#loading-icon', { visible: true, timeout: 5000 });
});

Then('a response should be displayed on the screen', async function () {
  // Wait for the loading icon to disappear, then check for a response
  await page.waitForSelector('#loading-icon', { hidden: true, timeout: 30000 });
  await page.waitForSelector('.response-message', { visible: true, timeout: 5000 });

  const response = await page.$('.response-message');
  if (!response) throw new Error('No response message found on screen');
});
