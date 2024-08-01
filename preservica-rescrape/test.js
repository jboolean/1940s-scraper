const ScrapeBrowser = require("../browser");

const scrapeBrowser = new ScrapeBrowser();

(async () => {
  await scrapeBrowser.launch();
  // await scrapeBrowser.goTo("https://www.browserscan.net/bot-detection");
  // await scrapeBrowser.goTo(
  //   "https://2captcha.com/demo/cloudflare-turnstile-challenge"
  // );

  const file = await scrapeBrowser.goToDownloadUrl(
    "https://nycrecords.access.preservica.com/download/file/IO_76bd7ffc-2a89-4ab0-8f1d-d6811e26b917"
  );

  console.log(file);

  const html = await scrapeBrowser.goToAndGetHtml(
    "https://2captcha.com/demo/cloudflare-turnstile-challenge"
  );

  console.log(html);

  await scrapeBrowser.close();
})();
