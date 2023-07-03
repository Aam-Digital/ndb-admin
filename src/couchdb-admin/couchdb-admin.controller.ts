import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BulkUpdateDto } from './bulk-update.dto';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { ApiOperation } from '@nestjs/swagger';
import * as credentials from 'src/assets/credentials.json';
import { ConfigService } from '@nestjs/config';

@Controller('couchdb-admin')
export class CouchdbAdminController {
  private keycloakPassword = this.configService.get('KEYCLOAK_ADMIN_PASSWORD');
  private keycloakUrl = this.configService.get('KEYCLOAK_URL');
  private domain = this.configService.get('DOMAIN');

  constructor(
    private http: HttpService,
    private configService: ConfigService,
  ) {}

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
      const config = await this.getDataFromDB(cred.name, file, cred.password);

      const configString = JSON.stringify(config);
      const regex = new RegExp(searchString, 'g');

      if (configString.match(regex)) {
        const replaced = configString.replace(regex, replaceString);
        editedOrgs.push(cred.name);
        await this.putDataToDB(
          cred.name,
          file,
          JSON.parse(replaced),
          cred.password,
        );
      }
    }
    return editedOrgs;
  }

  private getDataFromDB(org: string, path: string, password: string) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      this.http.get(`${url}/couchdb${path}`, { auth }).pipe(
        catchError(() => this.http.get(`${url}${path}`, { auth })),
        map((res) => res.data.rows ?? res.data),
      ),
    );
  }

  private putDataToDB(
    org: string,
    path: string,
    data,
    password: string,
    method = this.http.put,
  ) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      method.call(this.http, `${url}/couchdb${path}`, data, { auth }).pipe(
        catchError(() =>
          method.call(this.http, `${url}${path}`, data, { auth }),
        ),
        map((res: any) => res.data?.docs),
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
    const token = await this.getKeycloakToken();
    const allUsers =
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"';
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';
    const activeChildren = '/app/_find';
    for (const cred of credentials) {
      const users = await this.getUsersFromKeycloak(cred.name, token).catch(
        () => this.getDataFromDB(cred.name, allUsers, cred.password),
      );
      const children = await this.getDataFromDB(
        cred.name,
        allChildren,
        cred.password,
      );
      const active: any = await this.putDataToDB(
        cred.name,
        activeChildren,
        activeChildrenFilter,
        cred.password,
        this.http.post,
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

  private getKeycloakToken(): Promise<string> {
    const body = new URLSearchParams();
    body.set('username', 'admin');
    body.set('password', this.keycloakPassword);
    body.set('grant_type', 'password');
    body.set('client_id', 'admin-cli');
    return firstValueFrom(
      this.http
        .post<{ access_token: string }>(
          `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
          body.toString(),
        )
        .pipe(map((res) => res.data.access_token)),
    );
  }

  private getUsersFromKeycloak(org: string, token: string) {
    return firstValueFrom(
      this.http
        .get<{ access_token: string }>(
          `${this.keycloakUrl}/admin/realms/${org}/users?enabled=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .pipe(map((res) => res.data)),
    );
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
