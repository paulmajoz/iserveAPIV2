import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'http://156.38.152.188:8090',
      'http://156.38.152.188:8091',
      'https://iserve.royalh.co.za',
      'https://iserve2.royalh.co.za',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('iServe API V2')
    .setDescription('Unified Attendance & Community Service Tracking API')
    .setVersion('2.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`iServeAPIV2 running on port ${port}`);
}

bootstrap();
