import { proxyActivities } from '@temporalio/workflow';
import type { ScraperActivities } from '../activities/scraper.activities';
import type { StatusModel } from 'src/dto/status.model';

// Proxy the activities — Temporal will route calls to the registered worker
const { scrapeAllotment } = proxyActivities<ScraperActivities>({
  // Must finish within 45s to fit inside the 1-minute schedule window
  startToCloseTimeout: '45 seconds',
  retry: {
    maximumAttempts: 1,   // No retries — if it fails, the next minute's run picks it up
    initialInterval: '1s',
    backoffCoefficient: 1,
  },
});

export interface ScrapeAllotmentInput {
  pancardNumber: string;
  allotmentCompanyCode: string;
  registrarNum: number;
  allotmentUrl: string;
  registrarWebsite: string;
}

/**
 * Main scraper workflow.
 * Triggered by the NestJS controller via the Temporal client.
 * Delegates the actual scraping work to the `scrapeAllotment` activity.
 */
export async function scraperWorkflow(
  input: ScrapeAllotmentInput,
): Promise<StatusModel> {
  return await scrapeAllotment(input);
}
