import {Controller, Post} from '@nestjs/common';
import {Couchdb, CouchdbService} from '../couchdb/couchdb.service';
import * as credentials from '../assets/credentials.json';
import {ApiOperation} from '@nestjs/swagger';
import {ConfigMigrationService} from './config-migration/config-migration.service';

@Controller('migration')
export class MigrationController {

  constructor(
    private couchdbService: CouchdbService,
    private configMigrationService: ConfigMigrationService,
  ) {}

  @ApiOperation({
    description:
      'Transform any legacy config formats to their latest formats. If already in new formats, this will have no effect.',
  })
  @Post('latest-config-formats')
  async migrateToLatestConfigFormats() {
    return this.couchdbService.runForAllOrgs(credentials, (couchdb: Couchdb) =>
      this.configMigrationService.migrateToLatestConfigFormats(couchdb),
    );
  }
}
