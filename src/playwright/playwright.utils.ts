import { Page } from 'playwright';

export async function safeGoto(page: Page, url: string, timeout = 60_000) {
  await page.goto(url, {
    timeout,
    waitUntil: 'networkidle',
  });
}

export async function blockResources(page: Page) {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });
}
