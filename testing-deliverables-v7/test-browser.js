const puppeteer = require("puppeteer");

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      dumpio: true,
      protocolTimeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    console.log("Browser launched successfully");
    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "load" });
    console.log("Page opened successfully");
    await browser.close();
    console.log("Done");
  } catch (err) {
    console.error("Browser test failed:", err);
  }
})();