import { Injectable } from '@nestjs/common';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CredentialsService {
  readonly DEFAULT_DOMAIN: string = this.configService.get('DOMAIN');

  constructor(private configService: ConfigService) {}

  getCredentials(): SystemCredentials[] {
    return credentials.map((c) => ({
      url: c.url ?? c['name'] + '.' + this.DEFAULT_DOMAIN,
      password: c.password,
    }));
  }
}

export interface SystemCredentials {
  /**
   * System base URL (without protocol https)
   */
  url: string;

  /**
   * admin password to CouchDB
   */
  password: string;

  /**
   * (optional) overwrite the default admin username for CouchDB
   */
  username?: string;
}
