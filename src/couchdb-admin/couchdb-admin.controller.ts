import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BulkUpdateDto } from './bulk-update.dto';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { ApiOperation } from '@nestjs/swagger';
import * as credentials from 'src/assets/credentials.json';
import * as _ from 'lodash';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  constructor(private http: HttpService) {}

  @ApiOperation({
    description:
      'Update a bunch a documents that match `query` by assigning `replace` values.',
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
      const config = await this.getDirectFromDB(cred.name, file, cred.password);

      const search = JSON.parse(searchString);
      const replace = JSON.parse(replaceString);
      let edited = false;

      function dfs(object: any, property: string | number) {
        const current = object[property];
        if (_.isEqual(current, search)) {
          object[property] = replace;
          edited = true;
          return;
        }
        if (current !== null && typeof current === 'object') {
          Object.keys(current).forEach((key) => dfs(current, key));
        }
      }

      dfs(config, 'data');

      if (edited) {
        editedOrgs.push(cred.name);
        await this.putDirectToDB(cred.name, file, config, cred.password);
      }
    }
    return editedOrgs;
  }

  private getDirectFromDB(org: string, path: string, password: string) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.aam-digital.com/db`;
    return firstValueFrom(
      this.http.get(`${url}/couchdb${path}`, { auth }).pipe(
        catchError(() => this.http.get(`${url}${path}`, { auth })),
        map((res) => res.data),
      ),
    );
  }

  private putDirectToDB(
    org: string,
    path: string,
    config,
    password: string,
    method = this.http.put,
  ) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.aam-digital.com/db`;
    return firstValueFrom(
      method
        .call(this.http, `${url}/couchdb${path}`, config, { auth })
        .pipe(
          catchError(() =>
            method.call(this.http, `${url}${path}`, config, { auth }),
          ),
        ),
    );
  }

  @Get('statistics')
  async getStatistics() {
    const stats: {
      name: string;
      childrenTotal: number;
      childrenActive: number;
      users: number;
    }[] = [];
    const allUsers =
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"';
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';
    const activeChildren = '/app/_find';
    for (const cred of credentials) {
      const users = await this.getDirectFromDB(
        cred.name,
        allUsers,
        cred.password,
      );
      const children = await this.getDirectFromDB(
        cred.name,
        allChildren,
        cred.password,
      );
      const active: any = await this.putDirectToDB(
        cred.name,
        activeChildren,
        activeChildrenFilter,
        cred.password,
        this.http.post,
      );
      stats.push({
        name: cred.name,
        users: users.rows.length,
        childrenTotal: children.rows.length,
        childrenActive: active.data.docs.length,
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
