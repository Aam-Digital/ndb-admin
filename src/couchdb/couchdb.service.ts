import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CouchdbService {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private http: HttpService,
    private configService: ConfigService,
  ) {}

  getDataFromDB(org: string, path: string, password: string) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      this.http.get(`${url}/couchdb${path}`, { auth }).pipe(
        catchError(() => this.http.get(`${url}${path}`, { auth })),
        map((res) => res.data.rows ?? res.data),
      ),
    );
  }

  sendDataToDB(
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
}
