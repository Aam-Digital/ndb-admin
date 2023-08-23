import { Module } from '@nestjs/common';
import { CouchdbAdminController } from './couchdb/couchdb-admin.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CouchdbService } from './couchdb/couchdb.service';
import { KeycloakService } from './couchdb/keycloak.service';
import { MigrationController } from './couchdb/migration.controller';

@Module({
  imports: [HttpModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CouchdbAdminController, MigrationController],
  providers: [CouchdbService, KeycloakService],
})
export class AppModule {}
