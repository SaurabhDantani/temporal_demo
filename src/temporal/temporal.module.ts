import { Module, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { TEMPORAL_CLIENT_TOKEN } from './temporal.constants';

/**
 * NestJS module that provides a Temporal Client to the rest of the app.
 *
 * The client is used by services/controllers to START workflows.
 * It connects to the local Temporal server on module init and
 * disconnects cleanly on module destroy.
 */
@Module({
  providers: [
    {
      provide: TEMPORAL_CLIENT_TOKEN,
      useFactory: async () => {
        const logger = new Logger('TemporalModule');
        try {
          const connection = await Connection.connect({
            address: 'localhost:7233',
          });
          const client = new Client({
            connection,
            namespace: 'default',
          });
          logger.log('✅ Temporal Client connected to localhost:7233');
          return client;
        } catch (err) {
          logger.error('❌ Failed to connect Temporal Client', err);
          throw err;
        }
      },
    },
  ],
  exports: [TEMPORAL_CLIENT_TOKEN],
})
export class TemporalModule {}
