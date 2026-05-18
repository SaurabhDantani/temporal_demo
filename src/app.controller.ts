import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { Client } from '@temporalio/client';
import { AppService } from './app.service';
import { ScraperService } from './service/handle.result';
import { TEMPORAL_CLIENT_TOKEN, TEMPORAL_TASK_QUEUE } from './temporal/temporal.constants';
import { scraperWorkflow } from './temporal/workflows/scraper.workflow';

const data = [
  {
    pancardNumber: 'AAACU2414K',
    allotmentCompanyCode: 'TNE',
    registrarNum: 1,
    allotmentUrl: 'https://ipostatus1.cameoindia.com/',
    registrarWebsite: 'https://ipostatus1.cameoindia.com/',
  },
  {
    pancardNumber: 'AAACU2414K',
    allotmentCompanyCode: 'GUJ',
    registrarNum: 2,
    allotmentUrl: 'https://www.integratedregistry.in/IRMS_V2/IPOlink_v2.aspx',
    registrarWebsite: 'https://www.integratedregistry.in/IRMS_V2/IPOlink_v2.aspx',
  },
];

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly scraperService: ScraperService,
    @Inject(TEMPORAL_CLIENT_TOKEN) private readonly temporalClient: Client,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Original endpoint — calls services directly (no Temporal).
   * Useful for quick local testing without a Worker running.
   */
  @Get('test')
  async test() {
    const results: Array<{
      request: (typeof data)[number];
      response: unknown;
    }> = [];

    for (const item of data) {
      const result = await this.scraperService.getAllotment(
        item.pancardNumber,
        item.allotmentCompanyCode,
        item.registrarNum,
        item.allotmentUrl,
        item.registrarWebsite,
      );
      results.push({ request: item, response: result });
    }

    return results;
  }

  /**
   * Temporal-powered endpoint.
   * Starts a `scraperWorkflow` for each IPO item via Temporal and waits for results.
   * Requires the Temporal Worker (src/temporal/worker.ts) to be running.
   *
   * GET /test-temporal
   */
  @Get('test-temporal')
  async testTemporal() {
    const results: Array<{
      workflowId: string;
      request: (typeof data)[number];
      response: unknown;
    }> = [];

    for (const item of data) {
      const workflowId = `scrape-${item.registrarNum}-${item.allotmentCompanyCode}-${Date.now()}`;
      this.logger.log(`Starting workflow: ${workflowId}`);

      try {
        // Start the workflow and wait for it to complete
        const result = await this.temporalClient.workflow.execute(
          scraperWorkflow,
          {
            taskQueue: TEMPORAL_TASK_QUEUE,
            workflowId,
            args: [item],
          },
        );

        results.push({ workflowId, request: item, response: result });
      } catch (err) {
        this.logger.error(`Workflow ${workflowId} failed`, err);
        results.push({
          workflowId,
          request: item,
          response: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    return results;
  }

  /**
   * Check the state of all scheduled jobs.
   * GET /status/schedules
   */
  @Get('schedules')
  async getScheduleStatus() {
    const SCHEDULE_ID = 'ipo-scraper-every-1-min';
    const scheduleIds = [
      `${SCHEDULE_ID}-reg1-TNE`,
      `${SCHEDULE_ID}-reg2-GUJ`,
    ];

    const results: any[] = [];

    for (const scheduleId of scheduleIds) {
      try {
        const handle = this.temporalClient.schedule.getHandle(scheduleId);
        const desc = await handle.describe();

        results.push({
          scheduleId,
          status: '✅ RUNNING',
          nextRuns: desc.info.nextActionTimes?.slice(0, 3).map((t) => t.toISOString()) ?? [],
          recentRuns: desc.info.recentActions?.slice(-3).map((a) => ({
            scheduledAt: a.scheduledAt?.toISOString(),
            takenAt: a.takenAt?.toISOString(),
            workflowId: a.action.type === 'startWorkflow' ? a.action.workflow.workflowId : undefined,
          })) ?? [],
          paused: desc.state?.paused ?? false,
          scheduleInfo: JSON.stringify(desc.spec?.calendars ?? desc.spec?.intervals ?? 'unknown'),
        });
      } catch (err: any) {
        results.push({
          scheduleId,
          status: '❌ NOT FOUND — run: npm run schedule:create',
          error: err?.message ?? String(err),
        });
      }
    }

    return results;
  }

  /**
   * Check recent workflow executions.
   * GET /status/workflows?limit=10
   */
  @Get('status/workflows')
  async getWorkflowStatus() {
    const workflows: any[] = [];

    const iterator = this.temporalClient.workflow.list({
      query: `WorkflowType = "scraperWorkflow" ORDER BY StartTime DESC`,
    });

    let count = 0;
    for await (const wf of iterator) {
      workflows.push({
        workflowId: wf.workflowId,
        status: wf.status.name,           // RUNNING | COMPLETED | FAILED | TIMED_OUT
        startTime: wf.startTime?.toISOString(),
        closeTime: wf.closeTime?.toISOString() ?? 'still running...',
      });
      if (++count >= 10) break;           // Show last 10 runs
    }

    return {
      total: workflows.length,
      hint: 'Full history at http://localhost:8080',
      workflows,
    };
  }
}
