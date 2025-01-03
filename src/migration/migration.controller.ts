import { Controller, Post } from '@nestjs/common';
import { Couchdb, CouchdbService } from '../couchdb/couchdb.service';
import { ApiOperation } from '@nestjs/swagger';
import { ConfigMigrationService } from './config-migration/config-migration.service';
import { CredentialsService } from '../credentials/credentials.service';

@Controller('migration')
export class MigrationController {
  constructor(
    private couchdbService: CouchdbService,
    private configMigrationService: ConfigMigrationService,
    private credentialsService: CredentialsService,
  ) {}

  @ApiOperation({
    description:
      'Transform any legacy config formats to their latest formats. If already in new formats, this will have no effect.',
  })
  @Post('latest-config-formats')
  async migrateToLatestConfigFormats() {
    return this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      (couchdb: Couchdb) =>
        this.configMigrationService.migrateToLatestConfigFormats(couchdb),
    );
  }
}
