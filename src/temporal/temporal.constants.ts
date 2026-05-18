/**
 * Shared Temporal constants used by both the Worker and the NestJS client.
 * Keep them in one place to avoid typos and drift.
 */

/** The Temporal task queue name — must match between Worker and Client */
export const TEMPORAL_TASK_QUEUE = 'ipo-scraper-queue';

/** NestJS injection token for the Temporal Client */
export const TEMPORAL_CLIENT_TOKEN = 'TEMPORAL_CLIENT';
