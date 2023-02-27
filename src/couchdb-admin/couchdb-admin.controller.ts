import { Body, Controller, Post } from '@nestjs/common';
import { BulkUpdateDto } from './bulk-update.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { ApiOperation } from '@nestjs/swagger';

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
    const query = { selector: body.query };
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
}
