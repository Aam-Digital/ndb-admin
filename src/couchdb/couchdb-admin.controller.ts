import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import * as Papa from 'papaparse';
import { Response } from 'express';
import { Couchdb, CouchdbService } from './couchdb.service';
import { BulkUpdateDto } from './bulk-update.dto';
import { SearchAndReplaceService } from './search-and-replace/search-and-replace.service';
import { CredentialsService } from '../credentials/credentials.service';
import { SystemStatistics } from './statistics/system-statistics';
import { StatisticsService } from './statistics/statistics.service';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  constructor(
    private couchdbService: CouchdbService,
    private searchAndReplaceService: SearchAndReplaceService,
    private credentialsService: CredentialsService,
    private statisticsService: StatisticsService,
  ) {}

  @ApiOperation({
    description:
      'Update all documents that match `query` by patching (i.e. Object.assign) properties of the docs with the given `replace` object.',
  })
  @Post('bulk-update')
  updateDocuments(@Body() body: BulkUpdateDto) {
    return this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) =>
        this.searchAndReplaceService.bulkUpdateAssign(couchdb, body),
    );
  }

  @Post('multiple-bulk-update')
  async runAllUpdates(@Body() body: BulkUpdateDto[]) {
    const allResults = [];
    // Running the updates one by one, to prevent too many simultaneous requests to the server
    for (const update of body) {
      const result = await this.updateDocuments(update);
      allResults.push(result);
    }
    return allResults;
  }

  @ApiOperation({
    description:
      'Find all entities of given type or ID that have content matching the "search" regex.',
  })
  @ApiQuery({
    name: 'type',
    description:
      '_id or entity type prefix of the documents in the database to be considered for the search. (":" is added to prefixes automatically, if not part of the given id / prefix parameter)',
  })
  @Get('search-entities')
  findEntities(
    @Query('search') searchString: string,
    @Query('type') type: string,
  ) {
    return this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) =>
        this.searchAndReplaceService.searchInEntities(
          couchdb,
          searchString,
          type,
        ),
    );
  }

  @ApiOperation({
    description:
      'Replace the occurrences of "search" with "replace" in all entities with given ID/type filter.',
  })
  @ApiQuery({
    name: 'search',
    description: 'Regex to be searched for replacement in entities.',
  })
  @ApiQuery({
    name: 'replace',
    description:
      'Text to be replaced for the "search" regex. This is internally using JavaScript .replace() and supports its special replacement patterns: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace',
  })
  @ApiQuery({
    name: 'type',
    description:
      '_id or entity type prefix of the documents in the database to be considered for the search. (":" is added to prefixes automatically, if not part of the given id / prefix parameter)',
  })
  @Post('edit-entities')
  editEntities(
    @Query('search') searchString: string,
    @Query('replace') replaceString: string,
    @Query('type') type: string,
  ) {
    return this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) =>
        this.searchAndReplaceService.replaceInEntities(
          couchdb,
          searchString,
          replaceString,
          type,
        ),
    );
  }

  @ApiOperation({
    description: 'Get all documents with conflicts from each database.',
  })
  @Get('conflicts')
  getConflicts() {
    const viewDoc = {
      _id: '_design/conflicts',
      views: {
        all: {
          map:
            '(doc) => { ' +
            'if (doc._conflicts) { emit(doc._conflicts, doc._id); } ' +
            '}',
        },
      },
    };
    const path = `/app/${viewDoc._id}`;
    return this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      (couchdb: Couchdb) =>
        couchdb
          .get(path)
          .catch(() => couchdb.put(path, viewDoc))
          .then(() => couchdb.get(`${path}/_view/all`))
          .then((res) => res.map(({ value }) => value)),
    );
  }

  @ApiOperation({
    description: `Get statistics of how many children and users are registered.`,
  })
  @ApiOkResponse({
    description: `Array of statistics for each administered system.`,
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: { $ref: '#/components/schemas/SystemStatistics' },
        },
      },
      'text/csv': {
        schema: {
          type: 'string',
          example: 'organization,totalUsers\nOrg1,25\nOrg2,30',
        },
      },
    },
  })
  @ApiQuery({
    name: 'format',
    description:
      'Output format for the statistics. Use "csv" for CSV format or omit for JSON. Can also be specified via Accept header.',
    required: false,
    enum: ['csv', 'json'],
  })
  @Get('statistics')
  async getStatistics(
    @Query('format') format: string = 'json',
    @Res() res?: Response,
  ): Promise<SystemStatistics[] | string | void> {
    if (format !== 'json' && format !== 'csv') {
      throw new BadRequestException('Invalid format. Use "json" or "csv".');
    }

    const statisticsData = await this.statisticsService.getStatistics();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'inline; filename="statistics.csv"');
      res.send(Papa.unparse(statisticsData));
      return;
    } else {
      res.json(statisticsData);
      return;
    }
  }
}
