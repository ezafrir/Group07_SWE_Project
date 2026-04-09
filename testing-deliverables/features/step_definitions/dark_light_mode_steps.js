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
  await page.waitForSelector('#theme-toggle');
});

Given('the UI is currently in light mode', async function () {
  const bodyClass = await page.$eval('body', el => el.className);
  // If already in dark mode, click to switch to light first
  if (bodyClass.includes('dark')) {
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);
  }
});

Given('the UI is currently in dark mode', async function () {
  const bodyClass = await page.$eval('body', el => el.className);
  // If not in dark mode, click to switch to dark first
  if (!bodyClass.includes('dark')) {
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);
  }
});

When('the user clicks the dark\\/light mode toggle button', async function () {
  await page.click('#theme-toggle');
  await page.waitForTimeout(300); // allow CSS transition
});

Then('the UI theme should change to dark mode', async function () {
  const bodyClass = await page.$eval('body', el => el.className);
  if (!bodyClass.includes('dark')) {
    throw new Error('Expected body to have "dark" class after toggling to dark mode');
  }
});

Then('the UI theme should change to light mode', async function () {
  const bodyClass = await page.$eval('body', el => el.className);
  if (bodyClass.includes('dark')) {
    throw new Error('Expected body to NOT have "dark" class after toggling to light mode');
  }
});
