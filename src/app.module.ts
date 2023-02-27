import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CouchdbAdminController } from './couchdb-admin/couchdb-admin.controller';

@Module({
  imports: [],
  controllers: [AppController, CouchdbAdminController],
  providers: [AppService],
})
export class AppModule {}
