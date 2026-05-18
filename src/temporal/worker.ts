/**
 * Temporal Worker Entry Point
 *
 * Run this process SEPARATELY from the NestJS app:
 *   npx ts-node -r tsconfig-paths/register src/temporal/worker.ts
 *   OR add a script in package.json: "worker": "ts-node -r tsconfig-paths/register src/temporal/worker.ts"
 *
 * The Worker connects to the local Temporal server (localhost:7233),
 * registers the workflow and activities, and starts polling the task queue.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/scraper.activities';
import { TEMPORAL_TASK_QUEUE } from './temporal.constants';

async function runWorker() {
  // Connect to the local Temporal server
  const connection = await NativeConnection.connect({
    address: 'localhost:7233', // Local Temporal server default address
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TEMPORAL_TASK_QUEUE,

    // Point to the compiled workflow file (Temporal uses its own bundler)
    workflowsPath: require.resolve('./workflows/scraper.workflow'),

    // Register all exported activity functions
    activities,
  });

  console.log(`🚀 Temporal Worker started on task queue: "${TEMPORAL_TASK_QUEUE}"`);
  console.log(`   Connecting to: localhost:7233`);
  console.log(`   Namespace: default`);

  // Start polling — this blocks until the process is killed
  await worker.run();
}

runWorker().catch((err) => {
  console.error('❌ Worker failed to start:', err);
  process.exit(1);
});
