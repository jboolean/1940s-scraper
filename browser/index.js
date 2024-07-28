const { Solver } = require("@2captcha/captcha-solver");
const { readFileSync, readdirSync } = require("fs");
const path = require("path");
const { launch } = require("puppeteer");
const { normalizeUserAgent } = require("./normalize-ua.js");
const tmp = require("tmp-promise");

tmp.setGracefulCleanup();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const preloadFile = readFileSync(
  path.resolve(__dirname, "./inject.js"),
  "utf8"
);

class ScrapeBrowser {
  constructor(
    { proxy, twoCaptchaApiKey } = {
      twoCaptchaApiKey: process.env.TWO_CAPTCHA_API_KEY,
      proxy: process.env.PROXY,
    }
  ) {
    this.solver = new Solver(twoCaptchaApiKey);
    this.proxy = proxy;
  }

  async launch() {
    // If you are using `headless: true` mode, you need to fix userAgent. NormalizeUserAgent is used for this purpose.
    const initialUserAgent = await normalizeUserAgent();

    const browser = await launch({
      headless: false,
      devtools: true,
      args: [
        `--user-agent=${initialUserAgent}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        this.proxy ? `--proxy-server=${this.proxy}` : "",
        // "--window-size=1920,1080",
      ],
    });
    this.browser = browser;
  }

  async injectCloudflareSolver(page) {
    await page.evaluateOnNewDocument(preloadFile);
    await page.evaluate(preloadFile);

    // Solve captchas
    // Here we intercept the console messages to catch the message logged by inject.js script
    page.on("console", async (msg) => {
      const txt = msg.text();
      if (!txt.includes("intercepted-params:")) {
        return;
      }
      const params = JSON.parse(txt.replace("intercepted-params:", ""));

      try {
        await sleep(5000);
        console.log(`Solving the captcha...`);
        // console.log(params);
        const res = await this.solver.cloudflareTurnstile({
          ...params,
          ...(this.proxy ? { proxy: this.proxy } : {}),
        });
        console.log(`Solved the captcha ${res.id}`);
        await page.evaluate((token) => {
          cfCallback(token);
        }, res.data);
      } catch (e) {
        console.error("Could not solve the captcha", e);
      }
    });
  }

  async close() {
    await this.browser.close();
  }

  async goToDownloadUrl(url) {
    const page = await this.browser.newPage();
    // We create a temporary directory to store the downloaded file
    const downloadPath = await tmp.dir({ unsafeCleanup: true });

    try {
      const client = await page._client();
      await client.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadPath.path,
      });
      await this.injectCloudflareSolver(page);

      let headers;
      page.on("response", async (response) => {
        if (response.url() === url) {
          headers = response.headers();
        }
      });

      // await page.goto(url);

      // For some reason using page.goto(url) crashes the browser
      await page.evaluate((url) => {
        location.href = url;
      }, url);

      // Wait for file to appear in downloadPath
      const expire = Date.now() + 60000;
      let file;
      while (!file && Date.now() < expire) {
        file = readdirSync(downloadPath.path).find(
          (f) => !f.endsWith(".crdownload")
        );
        if (!file) {
          await sleep(1000);
        }
      }

      if (!file) {
        throw new Error("Did not find a downloaded file in time");
      }

      return {
        name: file,
        data: readFileSync(path.resolve(downloadPath.path, file)),
        headers,
      };
    } finally {
      await page.close();
      await downloadPath.cleanup();
    }
  }

  async goToAndGetHtml(url) {
    const page = await this.browser.newPage();
    try {
      await this.injectCloudflareSolver(page);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await sleep(2000);
      const expire = Date.now() + 60000;
      while (Date.now() < expire) {
        const html = await page.content();
        const hasCaptcha = await page.evaluate(() => {
          // Check if window.turnstile is defined
          return typeof window.turnstile !== "undefined";
        });

        if (hasCaptcha) {
          console.log("Captcha detected,waiting...");
          await sleep(1000);
        } else {
          return html;
        }
      }
      throw new Error("Did not get the html in time");
    } finally {
      await page.close();
    }
  }
}

module.exports = ScrapeBrowser;
