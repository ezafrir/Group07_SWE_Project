// Run this with:  node find-chrome.js
// It will tell you exactly where Chrome is on your machine.

const fs = require("fs");

const candidates = [
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Chromium\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

console.log("Searching for Chrome / Edge on this machine...\n");

let found = false;
for (const p of candidates) {
  if (p && fs.existsSync(p)) {
    console.log("✅ FOUND:", p);
    console.log("\nPaste this path into steps.js and e2e.test.js as your executablePath.");
    found = true;
  } else {
    console.log("❌ not found:", p);
  }
}

if (!found) {
  console.log("\nNo browser found automatically.");
  console.log("Open Chrome, go to chrome://version and look for 'Executable Path'.");
}
