import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScraperService } from './service/handle.result';
import { CameoService } from './service/cameo.service';
import { IntegratedService } from './service/integrated.service';
import { TemporalModule } from './temporal/temporal.module';

@Module({
  imports: [TemporalModule],
  controllers: [AppController],
  providers: [AppService, ScraperService, CameoService, IntegratedService],
})
export class AppModule {}
