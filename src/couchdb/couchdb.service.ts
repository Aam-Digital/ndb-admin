import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

/**
 * Service facilitating access to specific CouchDB databases.
 */
@Injectable()
export class CouchdbService {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private http: HttpService,
    private configService: ConfigService,
  ) {}

  getCouchdb(org: string, password: string) {
    return new Couchdb(this.http, this.domain, org, password);
  }

  /**
   * Run a function for all given databases.
   * @param credentials
   * @param callback A function that is called repeatedly, receiving the Couchdb instance for each database;
   *                  return values are mapped into a key-value return object (key = credentials.name).
   */
  async runForAllOrgs(
    credentials: { name: string; password: string }[],
    callback: (couchdb: Couchdb) => Promise<any>,
  ) {
    const results = {};
    for (const cred of credentials) {
      await callback(this.getCouchdb(cred.name, cred.password))
        .then((res) => (results[cred.name] = res))
        .catch((err) => {
          console.error('ERROR processing for: ' + cred.name, err);
          results[cred.name] = 'ERROR see logs';
        });
    }
    return results;
  }
}

/**
 * Accessor to one specific CouchDB database
 * providing methods to interact with data.
 */
export class Couchdb {
  private auth: { username: string; password: string };
  private baseUrl: string;

  constructor(
    private http: HttpService,
    private domain: string,
    public org: string,
    private password: string,
  ) {
    this.auth = { username: 'admin', password: this.password };
    this.baseUrl = `https://${this.org}.${this.domain}/db`;
  }

  get(path: string) {
    const httpConfig = { auth: this.auth };
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/couchdb${path}`, httpConfig).pipe(
        catchError(() => this.http.get(`${this.baseUrl}${path}`, httpConfig)),
        map((res) => res.data.rows ?? res.data),
      ),
    );
  }

  getAll(prefix: string, db = 'app') {
    const body = {
      include_docs: true,
      startkey: prefix + ':',
      endkey: prefix + ':\ufff0',
    };
    const path = `${db}/_all_docs`;
    const headers = { auth: this.auth };
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/couchdb/${path}`, body, headers).pipe(
        catchError(() =>
          this.http.post(`${this.baseUrl}/${path}`, body, headers),
        ),
        map(({ data }) => data?.rows.map(({ doc }) => doc)),
      ),
    );
  }

  putAll(docs: any[], db = 'app') {
    const body = { docs };
    const headers = { auth: this.auth };
    const path = `${db}/_bulk_docs`;
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/couchdb/${path}`, body, headers).pipe(
        catchError(() =>
          this.http.post(`${this.baseUrl}/${path}`, body, headers),
        ),
        map(({ data }) => data),
      ),
    );
  }

  put(path: string, data, headers?: any): Promise<any> {
    return firstValueFrom(
      this.http
        .put(`${this.baseUrl}/couchdb${path}`, data, {
          auth: this.auth,
          headers,
        })
        .pipe(
          catchError(() =>
            this.http.put(`${this.baseUrl}${path}`, data, { auth: this.auth }),
          ),
          map(({ data }) => (data?.docs ? data.docs : data)),
        ),
    );
  }

  post(path: string, data, headers?: any): Promise<any> {
    return firstValueFrom(
      this.http
        .post(`${this.baseUrl}/couchdb${path}`, data, {
          auth: this.auth,
          headers,
        })
        .pipe(
          catchError(() =>
            this.http.post(`${this.baseUrl}${path}`, data, { auth: this.auth }),
          ),
          map(({ data }) => (data?.docs ? data.docs : data)),
        ),
    );
  }
}
