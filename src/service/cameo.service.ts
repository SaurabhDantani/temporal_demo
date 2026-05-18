import { Injectable, Logger } from '@nestjs/common';
import { recognizeText } from 'src/utils/ocr.util';
import type { Page } from 'playwright';
import { load } from 'cheerio';
import { ChromiumFactory } from 'src/playwright/chromium.factory';
import { parseNumber } from 'src/utils/number-format.util';
import {
  allotedFunction,
  notAllotedFunction,
  notAppliedFunction,
  serverErrorFunction,
  StatusModel,
} from 'src/dto/status.model';

@Injectable()
export class CameoService {
  private readonly logger = new Logger(CameoService.name);

  async getAllotment(
    pancardNumber: string,
    allotmentCompanyName: string,
    registrarWebsite: string,
  ): Promise<StatusModel> {
    const { browser, page } = await ChromiumFactory.createPage();
    try {
      this.logger.log(`Navigating to Cameo URL: ${registrarWebsite}`);
      await page.goto(registrarWebsite, {
        waitUntil: 'networkidle',
      });

      // 2️⃣ Fill the form fields
      await this.prepareForm(page, pancardNumber, 'IDX');

      // 3️⃣ CAPTCHA retry loop
      for (let attempt = 1; attempt <= 3; attempt++) {
        this.logger.log(`Captcha attempt ${attempt}`);

        const captchaText = await this.solveCaptcha(page);
        console.log('generated captchaText', captchaText);
        if (!captchaText) {
          this.logger.warn('Could not solve captcha, retrying...');
          // Reload captcha by clicking the image or reloading page
          await page.reload({ waitUntil: 'networkidle' });
          await this.prepareForm(page, pancardNumber, allotmentCompanyName);
          continue;
        }

        // 4️⃣ Submit the form
        await page.click('#btngenerate');

        // Cameo uses ASP.NET partial postbacks (AJAX), so there is often NO page navigation.
        // We wait for network idle and then a small timeout for the DOM to update.
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500); // Give the table a moment to render

        // 5️⃣ Check for captcha error and retry
        const html = await page.content();

        if (
          html.includes('Captcha') &&
          (html.includes('incorrect') ||
            html.includes('Invalid') ||
            html.includes('mismatch') ||
            html.includes('wrong'))
        ) {
          this.logger.warn('Captcha mismatch, retrying...');
          await this.prepareForm(page, pancardNumber, allotmentCompanyName);
          continue;
        }

        // 6️⃣ Parse the result
        const parsed = this.parseHtmlResult(html);
        return this.mapToStatus(parsed);
      }

      throw new Error('Captcha failed after maximum attempts');
    } catch (error) {
      this.logger.error(
        `Cameo error | PAN: ${pancardNumber} | Company: ${allotmentCompanyName}`,
        error instanceof Error ? error.stack : error,
      );
      this.logger.log('🚨 SERVER ERROR');
      return serverErrorFunction();
    } finally {
      await browser.close();
    }
  }

  private async prepareForm(
    page: Page,
    pancardNumber: string,
    companyCode: string,
  ): Promise<void> {
    this.logger.log(`Waiting for company dropdown #drpCompany...`);
    // Wait for company dropdown
    await page.waitForSelector('#drpCompany');

    // Select company - attempt to select by value first, then fallback to label
    try {
      this.logger.log(`Selecting company: ${companyCode}`);

      // Try exactly matching value
      const options = await page.$$eval('#drpCompany option', (opts) =>
        opts.map((o) => ({
          value: (o as HTMLOptionElement).value,
          text: (o as HTMLOptionElement).text,
        })),
      );

      const match = options.find(
        (o) =>
          o.value.toLowerCase() === companyCode.toLowerCase() ||
          o.text.toLowerCase().includes(companyCode.toLowerCase()),
      );

      if (match) {
        await page.selectOption('#drpCompany', match.value);
        this.logger.log(`Company matched & selected: ${match.text}`);
      } else {
        this.logger.warn(
          `Company code "${companyCode}" not found in dropdown. Form might fail or not work properly.`,
        );
        // Try fallback just in case Playwright can magically match something
        await page.selectOption('#drpCompany', companyCode).catch(() => {});
      }
    } catch (e) {
      this.logger.warn(`Failed to select company: ${e}`);
    }

    // Select PAN NO as the search type
    await page.selectOption('#ddlUserTypes', 'PAN NO');

    // Fill PAN number
    await page.fill('#txtfolio', pancardNumber);
  }

  private async solveCaptcha(page: Page): Promise<string | null> {
    await page.waitForSelector('#imgCaptcha', { timeout: 15_000 });

    const captchaUrl = await page.$eval(
      '#imgCaptcha',
      (img: HTMLImageElement) => img.src,
    );
    if (!captchaUrl) return null;

    const response = await page.request.fetch(captchaUrl);
    if (!response.ok()) return null;

    const buffer = await response.body();
    if (!buffer?.length) return null;

    const ocr = await recognizeText(buffer, 'eng');
    const raw = ocr.data.text.replace(/\s+/g, '').trim();

    if (!raw || raw.length === 0) return null;

    this.logger.log(`CAPTCHA OCR: "${raw}"`);

    // Fill captcha text into the input
    await page.fill('#txt_phy_captcha', raw);

    return raw;
  }

  /**
   * Parse the Cameo result HTML using Cheerio.
   * The page renders a result table inside #divgrid1 after form submission.
   */
  private parseHtmlResult(html: string): CameoParsedResponse {
    const $ = load(html);

    // Check for result table
    const table = $('table');
    if (!table.length) {
      return { name: null, applied: 0, allotted: 0 };
    }

    // Find the data row (skip header row)
    const rows = table.find('tbody tr, tr').toArray();

    for (const row of rows) {
      const cells = $(row)
        .find('td')
        .map((_, td) => $(td).text().trim())
        .get();

      if (cells.length < 3) continue;

      const name = cells[0] ?? null;
      const applied = this.findNumericValue(cells) || 0;
      const allotted = this.findNumericValue(cells) || 0;

      if (name && name.length > 1) {
        return { name, applied, allotted };
      }
    }

    // Fallback: Try to find data from any visible result element
    const resultText = $('#divgrid1').text();
    if (resultText && resultText.trim().length > 0) {
      this.logger.log(`Result text found: ${resultText.substring(0, 200)}`);
    }

    return { name: null, applied: 0, allotted: 0 };
  }

  /**
   * Search through cells for a numeric value near a keyword in the table header.
   */
  private findNumericValue(cells: string[]): number {
    for (let i = cells.length - 1; i >= 0; i--) {
      const num = parseNumber(cells[i]);
      if (num > 0) return num;
    }
    return 0;
  }

  private mapToStatus(result: CameoParsedResponse): StatusModel {
    const applied = parseNumber(result.applied) || 0;
    const allotted = parseNumber(result.allotted) || 0;

    if (!result.name || (!applied && !allotted)) {
      this.logger.log('❌ NOT APPLIED');
      return notAppliedFunction();
    }

    if (!allotted || allotted <= 0) {
      this.logger.log('⚠ NOT ALLOTED');
      return notAllotedFunction(result.name ?? '', applied);
    }

    this.logger.log('🎉 ALLOTED');
    return allotedFunction(result.name ?? '', applied, allotted);
  }
}

interface CameoParsedResponse {
  name: string | null;
  applied: number;
  allotted: number;
}
