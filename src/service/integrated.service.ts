import { Injectable, Logger } from '@nestjs/common';
import { recognizeText } from 'src/utils/ocr.util';
import type { Page } from 'playwright';
import * as CryptoJS from 'crypto-js';
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
export class IntegratedService {
  private readonly logger = new Logger(IntegratedService.name);

  async getAllotment(
    pancardNumber: string,
    allotmentCompanyCode: string,
    registrarWebsite: string,
    allotmentUrl: string,
  ): Promise<StatusModel> {
    const { browser, page } = await ChromiumFactory.createPage();
    try {
      // 1️⃣ Establish session
      await page.goto(registrarWebsite, {
        waitUntil: 'networkidle',
      });

      // 2️⃣ Prepare form
      await this.prepareForm(page, pancardNumber, allotmentCompanyCode);

      // 3️⃣ CAPTCHA retry loop
      for (let attempt = 1; attempt <= 3; attempt++) {
        this.logger.log(`Captcha attempt ${attempt}`);

        const captchaText = await this.solveCaptcha(page);
        if (!captchaText) continue;

        const rawHtml = await this.callEncryptedApi(
          page,
          pancardNumber,
          allotmentCompanyCode,
          captchaText,
          allotmentUrl,
        );
        this.logger.log(rawHtml);
        if (rawHtml.includes('Captcha Mismatch')) {
          this.logger.warn('Captcha mismatch');
          continue;
        }

        if (!rawHtml.includes('commondiv')) {
          this.logger.warn('Unexpected response format');
          continue;
        }

        const parsed = await this.parseResponse(page, rawHtml);
        return this.mapToStatus(parsed);
      }

      throw new Error('Captcha failed after maximum attempts');
    } catch (error) {
      this.logger.error(
        `Integrated error | PAN: ${pancardNumber} | Company: ${allotmentCompanyCode}`,
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
    await page.selectOption('#AllotOption', 'IPO');
    await page.waitForSelector('#CompDdl2');

    await page.evaluate((code) => {
      const ddl = document.querySelector<HTMLSelectElement>('#CompDdl2');
      if (!ddl) return;
      ddl.value = code;
      ddl.dispatchEvent(new Event('change', { bubbles: true }));
    }, companyCode);

    await page.selectOption('#ChoiceDdl2', '3');
    await page.fill('#Pan_txt2', pancardNumber);
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

    const raw = ocr.data.text.replace(/\s+/g, '').toLowerCase();

    const expression = this.normalizeExpression(raw);
    if (!expression) return null;

    const result = this.evaluateExpression(expression);
    if (result === null) return null;

    await page.fill('#Captcha_Txt', String(result));
    this.logger.log(`CAPTCHA: ${expression} = ${result}`);

    return String(result);
  }

  private normalizeExpression(text: string): string | null {
    return (
      text
        .replace(/plus|add|addition/g, '+')
        .replace(/minus|subtract|subtraction/g, '-')
        .replace(/x|×|multiply|multiplication/g, '*')
        .replace(/÷|divide|division/g, '/')
        .replace(/=/g, '')
        .match(/\d+[+\-*/]\d+/)?.[0] ?? null
    );
  }

  private evaluateExpression(expr: string): number | null {
    const m = expr.match(/(\d+)([+\-*/])(\d+)/);
    if (!m) return null;

    const a = Number(m[1]);
    const b = Number(m[3]);

    switch (m[2]) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
      case 'x':
      case '×':
        return a * b;
      case '/':
        return b === 0 ? null : Math.floor(a / b);
      default:
        return null;
    }
  }

  private async callEncryptedApi(
    page: Page,
    pancard: string,
    companyCode: string,
    captchaText: string,
    allotmentUrl: string,
  ): Promise<string> {
    return page.evaluate(
      async ({ pancard, companyCode, captchaText, url }) => {
        const key = CryptoJS.enc.Latin1.parse('8c7e9a2f1b4d6e35');
        const iv = CryptoJS.enc.Latin1.parse('f0d1a3b5c7e92846');

        const raw =
          'Req=3' +
          '&Comp=' +
          companyCode +
          '&AppNum=' +
          '&Choice=3' +
          '&PANNO=' +
          pancard +
          '&DPClit=' +
          '&TYPE=IPO' +
          '&Captcha=' +
          captchaText;

        const encrypted = CryptoJS.AES.encrypt(raw, key, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }).toString();

        // ✅ use `url`, NOT `allotmentUrl`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'EncryptedData=' + encodeURIComponent(encrypted),
        });

        return res.text();
      },
      {
        pancard,
        companyCode,
        captchaText,
        url: allotmentUrl,
      },
    );
  }

  private parseResponse(
    page: Page,
    html: string,
  ): Promise<IntegratedParsedResponse> {
    return page.evaluate((htmlString) => {
      const temp = document.createElement('div');
      temp.innerHTML = htmlString;

      const read = (label: string): string | null => {
        const el = [...temp.querySelectorAll('.commondiv')].find((d) =>
          d.textContent?.includes(label),
        );

        return el
          ? (el
              .querySelector('.rightdiv')
              ?.textContent?.replace(':', '')
              .trim() ?? null)
          : null;
      };

      return {
        name: read('Name'),
        applied: Number(read('Applied') ?? 0),
        allotted: Number(read('Allotted') ?? 0),
      };
    }, html);
  }

  private mapToStatus(result: IntegratedParsedResponse): StatusModel {
    const applied = parseNumber(result.applied) || 0;
    const allotted = parseNumber(result.allotted) || 0;

    if (!applied || applied <= 0) {
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

interface IntegratedParsedResponse {
  name: string | null;
  applied: number;
  allotted: number;
}
