import { Body, Controller, Post, Query } from '@nestjs/common';
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
      const auth = { username: 'admin', password: cred.password };
      const url = `https://${cred.name}.aam-digital.com/db`;
      const file = `/app/Config:CONFIG_ENTITY`;
      const config = await firstValueFrom(
        this.http.get(`${url}/couchdb${file}`, { auth }).pipe(
          catchError(() => this.http.get(`${url}${file}`, { auth })),
          map((res) => res.data),
        ),
      );

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
        await firstValueFrom(
          this.http
            .put(`${url}/couchdb${file}`, config, { auth })
            .pipe(
              catchError(() =>
                this.http.put(`${url}${file}`, config, { auth }),
              ),
            ),
        );
      }
    }
    return editedOrgs;
  }
}
