import { Module } from '@nestjs/common';
import { CouchdbAdminController } from './couchdb/couchdb-admin.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CouchdbAdminController],
})
export class AppModule {}
