import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { configureSentry } from './sentry-configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle(process.env.npm_package_name)
    .setDescription(process.env.npm_package_description)
    .setVersion(process.env.npm_package_version)
    .addServer('/', 'local')
    .addServer('/admin', 'deployed with proxy')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // load ConfigService instance to access .env and app.yaml values
  const configService = new ConfigService();
  configureSentry(app, configService);

  await app.listen(3000);
}

bootstrap();
