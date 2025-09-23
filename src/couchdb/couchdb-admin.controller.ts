import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Couchdb, CouchdbService } from './couchdb.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { BulkUpdateDto } from './bulk-update.dto';
import { SearchAndReplaceService } from './search-and-replace/search-and-replace.service';
import { CredentialsService } from '../credentials/credentials.service';
import { SystemStatistics } from './system-statistics';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  constructor(
    private couchdbService: CouchdbService,
    private keycloakService: KeycloakService,
    private searchAndReplaceService: SearchAndReplaceService,
    private credentialsService: CredentialsService,
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
    isArray: true,
    type: SystemStatistics,
  })
  @ApiQuery({
    name: 'format',
    description: 'Output format for the statistics. Use "csv" for CSV format or omit for JSON.',
    required: false,
    enum: ['csv'],
  })
  @Get('statistics')
  async getStatistics(
    @Query('format') format?: string,
    @Res() res?: Response,
  ): Promise<SystemStatistics[] | void> {
    const token = await this.keycloakService.getKeycloakToken();
    const allUsers =
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"';
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';
    const activeChildren = '/app/_find';

    const results = await this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) => {
        const users = await this.keycloakService
          .getUsersFromKeycloak(couchdb.url.split('.')[0], token)
          .catch(() => couchdb.get(allUsers));
        const children = await couchdb.get(allChildren);
        const active: any = await couchdb.post(
          activeChildren,
          activeChildrenFilter,
        );
        return {
          name: couchdb.url,
          users: users.length,
          childrenTotal: children.length,
          childrenActive: active.length,
        };
      },
    );

    const statisticsData: SystemStatistics[] = Object.values(results).filter(
      (result): result is SystemStatistics => 
        typeof result === 'object' && 
        result !== null && 
        'name' in result &&
        'users' in result &&
        'childrenTotal' in result &&
        'childrenActive' in result
    );

    if (format === 'csv') {
      const csvContent = this.convertToCSV(statisticsData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="statistics.csv"');
      res.send(csvContent);
      return;
    }

    return statisticsData;
  }

  private convertToCSV(data: SystemStatistics[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    // Create CSV header
    const headers = ['name', 'users', 'childrenTotal', 'childrenActive'];
    const csvHeader = headers.join(',');

    // Create CSV rows
    const csvRows = data.map(item => {
      return headers.map(header => {
        const value = item[header];
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [csvHeader, ...csvRows].join('\n');
  }
}

const activeChildrenFilter = {
  selector: {
    _id: {
      $gt: 'Child:',
      $lt: 'Child:\uffff',
    },
    status: {
      $or: [
        {
          $not: {
            $eq: 'Dropout',
          },
        },
        {
          $exists: false,
        },
      ],
    },
    dropoutDate: {
      $exists: false,
    },
    exit_date: {
      $exists: false,
    },
    active: {
      $or: [
        {
          $exists: false,
        },
        {
          $eq: true,
        },
      ],
    },
    inactive: {
      $or: [
        {
          $exists: false,
        },
        {
          $eq: false,
        },
      ],
    },
  },
  execution_stats: true,
  limit: 100000,
  skip: 0,
};
