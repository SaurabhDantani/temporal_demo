import {
  browserType,
  chromiumLaunchOptions,
  contextOptions,
} from './playwright.config';
import { Browser, Page } from 'playwright';

export class ChromiumFactory {
  static async createPage(): Promise<{ browser: Browser; page: Page }> {
    const browser = await browserType.launch(chromiumLaunchOptions);

    const context = await browser.newContext({
      ...contextOptions,
    });

    const page = await context.newPage();

    // Anti-bot hardening
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    return { browser, page };
  }
}
