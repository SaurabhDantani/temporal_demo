/**
 * Temporal Schedule — runs scraperWorkflow every 1 minute.
 *
 * Run once to CREATE the schedule:
 *   npm run schedule:create
 *
 * Run once to DELETE the schedule:
 *   npm run schedule:delete
 *
 * After creating, monitor at: http://localhost:8080/namespaces/default/schedules
 */

import { Client, Connection, ScheduleOverlapPolicy } from '@temporalio/client';
import { scraperWorkflow, type ScrapeAllotmentInput } from '../workflows/scraper.workflow';
import { TEMPORAL_TASK_QUEUE } from '../temporal.constants';

const SCHEDULE_ID = 'ipo-scraper-every-1-min';

// The list of IPO items to scrape on every tick
const IPO_ITEMS: ScrapeAllotmentInput[] = [
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

async function getClient(): Promise<Client> {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  return new Client({ connection, namespace: 'default' });
}

/**
 * Creates the schedule. Safe to call multiple times — skips if already exists.
 */
export async function createSchedule() {
  const client = await getClient();

  try {
    // One scheduled workflow per IPO item, all fired every minute
    for (const item of IPO_ITEMS) {
      const scheduleId = `${SCHEDULE_ID}-reg${item.registrarNum}-${item.allotmentCompanyCode}`;

      await client.schedule.create({
        scheduleId,

        spec: {
          // Cron: every 1 minute
          // Format: second  minute  hour  day  month  weekday
          cronExpressions: ['* * * * *'],  // every minute
        },

        action: {
          type: 'startWorkflow',
          workflowType: scraperWorkflow,
          taskQueue: TEMPORAL_TASK_QUEUE,
          args: [item],

          // Give each workflow run a unique ID using the schedule time
          workflowId: `${scheduleId}-{{.ScheduledTime}}`,
        },

        policies: {
          // If a previous run is still going when the next tick fires:
          // SKIP the new run rather than stacking up
          overlap: ScheduleOverlapPolicy.SKIP,

          // Catch up on missed runs if the Worker was down (max 1 catchup)
          catchupWindow: '1 minute',
        },
      });

      console.log(`✅ Schedule created: ${scheduleId}`);
    }

    console.log('\n📅 All schedules running every 1 minute.');
    console.log('   Monitor at: http://localhost:8080/namespaces/default/schedules');
  } catch (err: any) {
    if (err?.code === 6 || err?.message?.includes('already exists')) {
      console.log(`ℹ️  Schedules already exist. Use 'npm run schedule:delete' first to recreate.`);
    } else {
      console.error('❌ Failed to create schedule:', err.message ?? err);
      process.exit(1);
    }
  } finally {
    process.exit(0);
  }
}

/**
 * Deletes all schedules created by createSchedule().
 */
export async function deleteSchedule() {
  const client = await getClient();

  for (const item of IPO_ITEMS) {
    const scheduleId = `${SCHEDULE_ID}-reg${item.registrarNum}-${item.allotmentCompanyCode}`;
    try {
      await client.schedule.getHandle(scheduleId).delete();
      console.log(`🗑️  Deleted schedule: ${scheduleId}`);
    } catch {
      console.log(`⚠️  Schedule not found (already deleted?): ${scheduleId}`);
    }
  }

  process.exit(0);
}

// Determine action from CLI arg: node scraper.schedule.ts delete
const action = process.argv[2];
if (action === 'delete') {
  deleteSchedule();
} else {
  createSchedule();
}
