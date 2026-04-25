const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');

// Give the LLMs up to 60 seconds to generate responses
setDefaultTimeout(60 * 1000); 

let browser;
let page;

Before(async function () {
  browser = await puppeteer.launch({ headless: "new" });
  page = await browser.newPage();
});

After(async function () {
  if (browser) await browser.close();
});

Given('the user is on the chat interface', async function () {
  await page.goto('http://localhost:3000'); // Adjust URL if needed
  await page.waitForSelector('#promptInput');
});

When('the user enters {string} in the prompt box', async function (promptText) {
  await page.type('#promptInput', promptText);
});

When('the user clicks the {string} button', async function (buttonText) {
  // Assuming the button has an ID like #compareBtn
  await page.click('#compareBtn'); 
});

Then('the system should generate {int} distinct model responses', async function (count) {
  // Wait for the loading bubble to hide
  await page.waitForSelector('#loadingBubble', { hidden: true, timeout: 60000 });
  
  // Verify the correct number of responses rendered
  await page.waitForSelector('.assistant-bubble', { visible: true });
  const responses = await page.$$('.assistant-bubble');
  assert.strictEqual(responses.length, count, `Expected ${count} responses, but got ${responses.length}`);
});

Then('the system should display a {string} summary box', async function (boxTitle) {
  // Check for the summary container
  await page.waitForSelector('.comparison-bubble', { visible: true });
  const summaryText = await page.$eval('.comparison-bubble', el => el.textContent);
  
  // Verify it contains the right title/data
  assert.ok(summaryText.includes('Similarities & Differences'), "Summary box is missing the correct title");
});