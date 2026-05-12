import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CouchdbAdminController } from './couchdb/couchdb-admin.controller';
import { CouchdbService } from './couchdb/couchdb.service';
import { SearchAndReplaceService } from './couchdb/search-and-replace/search-and-replace.service';
import { StatisticsService } from './couchdb/statistics/statistics.service';
import { CredentialsService } from './credentials/credentials.service';
import { KeycloakMigrationController } from './keycloak/keycloak-migration.controller';
import { KeycloakService } from './keycloak/keycloak.service';

@Module({
  imports: [HttpModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CouchdbAdminController, KeycloakMigrationController],
  providers: [
    CouchdbService,
    KeycloakService,
    SearchAndReplaceService,
    CredentialsService,
    StatisticsService,
  ],
})
export class AppModule {}
