import { BrowserType, chromium, LaunchOptions } from 'playwright';

export const PLAYWRIGHT_TIMEOUT = 60_000;

export const chromiumLaunchOptions: LaunchOptions = {
  headless: false, // set false for debugging
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-size=1920,1080',
  ],
};

export const browserType: BrowserType = chromium;

export const contextOptions = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

  viewport: { width: 1920, height: 1080 },
  javaScriptEnabled: true,
  ignoreHTTPSErrors: true,
  locale: 'en-US',
  timezoneId: 'Asia/Kolkata',

  permissions: ['geolocation'],
};
