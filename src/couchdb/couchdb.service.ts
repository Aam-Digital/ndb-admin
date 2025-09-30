import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { SystemCredentials } from '../credentials/credentials.service';

/**
 * Service facilitating access to specific CouchDB databases.
 */
@Injectable()
export class CouchdbService {
  constructor(private http: HttpService) {}

  /**
   * Get a Couchdb instance for a specific database.
   * @param url The base URL / subdomain of the system (e.g. test.aam-digital.com)
   * @param password
   */
  getCouchdb(url: string, password: string) {
    return new Couchdb(this.http, url, password);
  }

  /**
   * Run a function for all given databases.
   * @param credentials
   * @param callback A function that is called repeatedly, receiving the Couchdb instance for each database;
   *                  return values are mapped into a key-value return object (key = credentials.name).
   */
  async runForAllOrgs<R>(
    credentials: SystemCredentials[],
    callback: (couchdb: Couchdb) => Promise<R>,
  ): Promise<{ [key: string]: R }> {
    const results = {};
    for (const cred of credentials) {
      await callback(this.getCouchdb(cred.url, cred.password))
        .then((res) => (results[cred.url] = res))
        .catch((err) => {
          console.error('ERROR processing for: ' + cred.url, err);
          results[cred.url] = 'ERROR see logs';
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
    public url: string,
    private password: string,
  ) {
    this.auth = { username: 'admin', password: this.password };
    this.baseUrl = `https://${this.url}/db`;
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

  getAll(prefix: string, db = 'app'): Promise<any[]> {
    if (!prefix.includes(':')) {
      prefix += ':';
    }
    const body = {
      include_docs: true,
      startkey: prefix,
      endkey: prefix + '\ufff0',
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

  find(query, db = 'app'): Promise<any[]> {
    return this.post(`/${db}/_find`, query);
  }
}
