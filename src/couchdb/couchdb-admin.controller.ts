import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BulkUpdateDto } from './bulk-update.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { ApiOperation } from '@nestjs/swagger';
import * as credentials from 'src/assets/credentials.json';
import { CouchdbService } from './couchdb.service';
import { KeycloakService } from './keycloak.service';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  constructor(
    private http: HttpService,
    private couchdbService: CouchdbService,
    private keycloakService: KeycloakService,
  ) {}

  @ApiOperation({
    description:
      'Update all documents that match `query` by assigning `replace` values.',
  })
  @Post('bulk-update')
  async updateDocuments(@Body() body: BulkUpdateDto) {
    const url = body.url + '/app';
    const auth = { username: 'admin', password: body.password };
    const query = { selector: body.query, skip: 0, limit: 100000 };
    const res = await firstValueFrom(
      this.http.post<{ docs: { _id: string }[] }>(`${url}/_find`, query, {
        auth,
      }),
    );
    const puts = res.data.docs.map((doc) => {
      const update = Object.assign(doc, body.replace);
      return firstValueFrom(
        this.http
          .put(`${url}/${doc._id}`, update, { auth })
          .pipe(map((res) => res.data)),
      );
    });
    return Promise.all(puts);
  }

  @ApiOperation({
    description: 'Find configs where "search" is included.',
  })
  @Get('search-configs')
  async findConfigs(@Query('search') searchString: string) {
    const editedOrgs: string[] = [];
    for (const cred of credentials) {
      const file = `/app/Config:CONFIG_ENTITY`;
      const config = await this.couchdbService.get(
        cred.name,
        file,
        cred.password,
      );

      const configString = JSON.stringify(config);
      const regex = new RegExp(searchString, 'g');

      if (configString.match(regex)) {
        editedOrgs.push(cred.name);
      }
    }
    return editedOrgs;
  }

  @ApiOperation({
    description:
      'Replace the occurrences of "search" with "replace" in all configs.',
  })
  @Post('edit-configs')
  async editConfigs(
    @Query('search') searchString: string,
    @Query('replace') replaceString: string,
  ) {
    const editedOrgs = [];
    // Update `credentials.json` using the `collect_credentials.sh` script on the server
    for (const cred of credentials) {
      const file = `/app/Config:CONFIG_ENTITY`;
      const config = await this.couchdbService.get(
        cred.name,
        file,
        cred.password,
      );

      const configString = JSON.stringify(config);
      const regex = new RegExp(searchString, 'g');

      if (configString.match(regex)) {
        const replaced = configString.replace(regex, replaceString);
        editedOrgs.push(cred.name);
        await this.couchdbService.put(
          cred.name,
          file,
          JSON.parse(replaced),
          cred.password,
        );
      }
    }
    return editedOrgs;
  }

  @ApiOperation({
    description: `Get statistics of how many children and users are registered.`,
  })
  @Get('statistics')
  async getStatistics() {
    const stats: {
      name: string;
      childrenTotal: number;
      childrenActive: number;
      users: number;
    }[] = [];
    const token = await this.keycloakService.getKeycloakToken();
    const allUsers =
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"';
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';
    const activeChildren = '/app/_find';
    for (const cred of credentials) {
      const users = await this.keycloakService
        .getUsersFromKeycloak(cred.name, token)
        .catch(() =>
          this.couchdbService.get(cred.name, allUsers, cred.password),
        );
      const children = await this.couchdbService.get(
        cred.name,
        allChildren,
        cred.password,
      );
      const active: any = await this.couchdbService.post(
        cred.name,
        activeChildren,
        activeChildrenFilter,
        cred.password,
      );
      stats.push({
        name: cred.name,
        users: users.length,
        childrenTotal: children.length,
        childrenActive: active.length,
      });
    }
    return stats;
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
