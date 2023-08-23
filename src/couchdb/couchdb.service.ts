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

  get(org: string, path: string, password: string) {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      this.http.get(`${url}/couchdb${path}`, { auth }).pipe(
        catchError(() => this.http.get(`${url}${path}`, { auth })),
        map((res) => res.data.rows ?? res.data),
      ),
    );
  }

  put(
    org: string,
    path: string,
    data,
    password: string,
    headers?: any,
  ): Promise<any> {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      this.http.put(`${url}/couchdb${path}`, data, { auth, headers }).pipe(
        catchError(() => this.http.put(`${url}${path}`, data, { auth })),
        map(({ data }) => (data?.docs ? data.docs : data)),
      ),
    );
  }

  post(
    org: string,
    path: string,
    data,
    password: string,
    headers?: any,
  ): Promise<any> {
    const auth = { username: 'admin', password };
    const url = `https://${org}.${this.domain}/db`;
    return firstValueFrom(
      this.http.post(`${url}/couchdb${path}`, data, { auth, headers }).pipe(
        catchError(() => this.http.post(`${url}${path}`, data, { auth })),
        map(({ data }) => (data?.docs ? data.docs : data)),
      ),
    );
  }
}
