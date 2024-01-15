import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import * as credentials from '../assets/credentials.json';
import { Couchdb, CouchdbService } from './couchdb.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { BulkUpdateDto } from './bulk-update.dto';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  constructor(
    private couchdbService: CouchdbService,
    private keycloakService: KeycloakService,
  ) {}

  @ApiOperation({
    description:
      'Update all documents that match `query` by patching (i.e. Object.assign) properties of the docs with the given `replace` object.',
  })
  @Post('bulk-update')
  updateDocuments(@Body() body: BulkUpdateDto) {
    return this.couchdbService.runForAllOrgs(
      credentials,
      async (couchdb: Couchdb) => {
        const res = await couchdb.post('/app/_find', {
          selector: body.query,
          skip: 0,
          limit: 100000,
        });

        return Promise.all(
          res.data.docs.map((doc) => {
            const update = Object.assign(doc, body.replace);
            return couchdb.put(doc._id, update);
          }),
        );
      },
    );
  }

  @Post('multiple-bulk-update')
  runAllUpdates(@Body() body: BulkUpdateDto[]) {
    return Promise.all(body.map((update) => this.updateDocuments(update)));
  }

  @ApiOperation({
    description: 'Find configs where "search" is included.',
  })
  @ApiQuery({
    name: 'docId',
    required: false,
    description:
      '_id of the document in the database to be edited. By default the config entity is targeted.',
  })
  @Get('search-configs')
  findConfigs(
    @Query('search') searchString: string,
    @Query('docId') docId?: string,
  ) {
    return this.couchdbService.runForAllOrgs(
      credentials,
      async (couchdb: Couchdb) => {
        const file = '/app/' + (docId ?? 'Config:CONFIG_ENTITY');
        const config = await couchdb.get(file);

        const configString = JSON.stringify(config);
        const regex = new RegExp(searchString, 'g');

        if (configString.match(regex)) {
          return 'matching';
        }
      },
    );
  }

  @ApiOperation({
    description:
      'Replace the occurrences of "search" with "replace" in all configs.',
  })
  @ApiQuery({
    name: 'docId',
    required: false,
    description:
      '_id of the document in the database to be edited. By default the config entity is targeted.',
  })
  @Post('edit-configs')
  editConfigs(
    @Query('search') searchString: string,
    @Query('replace') replaceString: string,
    @Query('docId') docId?: string,
  ) {
    return this.couchdbService.runForAllOrgs(
      credentials,
      async (couchdb: Couchdb) => {
        const file = '/app/' + (docId ?? 'Config:CONFIG_ENTITY');
        const config = await couchdb.get(file);

        const configString = JSON.stringify(config);
        const regex = new RegExp(searchString, 'g');

        if (configString.match(regex)) {
          const replaced = configString.replace(regex, replaceString);
          await couchdb.put(file, JSON.parse(replaced));
          return 'edited';
        }
      },
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
    return this.couchdbService.runForAllOrgs(credentials, (couchdb: Couchdb) =>
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
  @Get('statistics')
  async getStatistics(): Promise<
    {
      name: string;
      childrenTotal: number;
      childrenActive: number;
      users: number;
    }[]
  > {
    const token = await this.keycloakService.getKeycloakToken();
    const allUsers =
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"';
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';
    const activeChildren = '/app/_find';

    const results = await this.couchdbService.runForAllOrgs(
      credentials,
      async (couchdb: Couchdb) => {
        const users = await this.keycloakService
          .getUsersFromKeycloak(couchdb.org, token)
          .catch(() => couchdb.get(allUsers));
        const children = await couchdb.get(allChildren);
        const active: any = await couchdb.post(
          activeChildren,
          activeChildrenFilter,
        );
        return {
          name: couchdb.org,
          users: users.length,
          childrenTotal: children.length,
          childrenActive: active.length,
        };
      },
    );

    return Object.values(results);
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
