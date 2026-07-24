const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8725/collections/curvy-woman.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'c:\Users\paulf\OneDrive\Desktop\bbw4life\.tmp-verify-shots\TEST3.png', clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log('SUCCESS3');
  process.exit(0);
})();
