/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { readFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const provider = new NodeTracerProvider();
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new NestInstrumentation({
        enabled: true,
      }),
    ],
  })

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    httpsOptions: {
      ca: readFileSync(process.env.ROOT_CA_PATH as string),
      key: readFileSync(join(__dirname, '../../../apps/web/certificates/localhost-key.pem')),
      cert: readFileSync(join(__dirname, '../../../apps/web/certificates/localhost.pem')),
    },
  });
  app.enableCors();
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.startAllMicroservices();
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: https://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
