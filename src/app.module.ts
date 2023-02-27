import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CouchdbAdminController } from './couchdb-admin/couchdb-admin.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [AppController, CouchdbAdminController],
  providers: [AppService],
})
export class AppModule {}
