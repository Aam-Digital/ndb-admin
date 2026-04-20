import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as credentials from '../assets/credentials.json';

type RawSystemCredential = {
  url?: string;
  name?: string;
  password: string;
  username?: string;
  category?: string;
};

@Injectable()
export class CredentialsService {
  readonly DEFAULT_DOMAIN: string = this.configService.get('DOMAIN');

  constructor(private configService: ConfigService) {}

  getCredentials(): SystemCredentials[] {
    return (credentials as RawSystemCredential[]).map((c) => ({
      url: c.url ?? c['name'] + '.' + this.DEFAULT_DOMAIN,
      password: c.password,
      username: c.username,
      category: c.category?.trim() ?? '',
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

  /**
   * (optional) category to group and filter systems
   */
  category?: string;
}
