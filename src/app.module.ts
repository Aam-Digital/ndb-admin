import { Module } from '@nestjs/common';
import { CouchdbAdminController } from './couchdb/couchdb-admin.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CouchdbService } from './couchdb/couchdb.service';
import { KeycloakService } from './keycloak/keycloak.service';
import { MigrationController } from './migration/migration.controller';
import { KeycloakMigrationController } from './keycloak/keycloak-migration.controller';
import { ConfigMigrationService } from './migration/config-migration/config-migration.service';

@Module({
  imports: [HttpModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    CouchdbAdminController,
    MigrationController,
    KeycloakMigrationController,
  ],
  providers: [CouchdbService, KeycloakService, ConfigMigrationService],
})
export class AppModule {}
