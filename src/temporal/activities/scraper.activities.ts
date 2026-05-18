import { Logger } from '@nestjs/common';
import { CameoService } from 'src/service/cameo.service';
import { IntegratedService } from 'src/service/integrated.service';
import type { StatusModel } from 'src/dto/status.model';
import { serverErrorFunction } from 'src/dto/status.model';
import type { ScrapeAllotmentInput } from '../workflows/scraper.workflow';

const logger = new Logger('ScraperActivities');

/**
 * Activities are plain functions registered on the Temporal Worker.
 * They run in the Worker process (NOT inside NestJS) and can use I/O,
 * browser automation, and any Node.js API.
 *
 * We instantiate services directly here because NestJS DI is not available
 * inside the Worker process.
 */

// Shared singleton instances (Worker process scope)
const cameoService = new CameoService();
const integratedService = new IntegratedService();

export async function scrapeAllotment(
  input: ScrapeAllotmentInput,
): Promise<StatusModel> {
  const {
    pancardNumber,
    allotmentCompanyCode,
    registrarNum,
    allotmentUrl,
    registrarWebsite,
  } = input;

  logger.log(
    `[Activity] scrapeAllotment | registrar=${registrarNum} | PAN=${pancardNumber} | company=${allotmentCompanyCode}`,
  );

  try {
    switch (registrarNum) {
      case 1:
        return await cameoService.getAllotment(
          pancardNumber,
          allotmentCompanyCode,
          allotmentUrl,
        );
      case 2:
        return await integratedService.getAllotment(
          pancardNumber,
          allotmentCompanyCode,
          registrarWebsite,
          allotmentUrl,
        );
      default:
        logger.error(`Unknown registrarNum: ${registrarNum}`);
        return serverErrorFunction();
    }
  } catch (err) {
    logger.error('Unexpected activity error', err);
    return serverErrorFunction();
  }
}

/** Type used by the workflow to proxy activity calls */
export type ScraperActivities = {
  scrapeAllotment: typeof scrapeAllotment;
};
