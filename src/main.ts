import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Strips away properties that don't have decorators in the DTO
      forbidNonWhitelisted: true, // Throws an error if non-whitelisted properties are sent
      transform: true,          // 👈 CRITICAL: Automatically transforms payloads into DTO instances
    }),
  );

  await app.listen(3000);
}
bootstrap();