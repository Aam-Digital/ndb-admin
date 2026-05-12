import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type RawSystemCredential = {
  url?: string;
  name?: string;
  password: string;
  username?: string;
  category?: string;
};

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
  readonly DEFAULT_DOMAIN: string = this.configService.get('DOMAIN');

  constructor(private configService: ConfigService) {}

  getCredentials(): SystemCredentials[] {
    const credentialsPath = this.resolveCredentialsPath();
    this.logger.log(`Loading credentials from ${credentialsPath}`);
    const credentials: RawSystemCredential[] = JSON.parse(
      readFileSync(credentialsPath, 'utf-8'),
    );
    return credentials.map((c) => ({
      url: c.url ?? c['name'] + '.' + this.DEFAULT_DOMAIN,
      name: c.name,
      password: c.password,
      username: c.username,
      category: c.category?.trim() ?? '',
    }));
  }

  private resolveCredentialsPath(): string {
    const candidates = [
      join(process.cwd(), 'credentials.json'),
      join(process.cwd(), 'src', 'assets', 'credentials.json'),
      join(__dirname, '..', 'assets', 'credentials.json'),
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        return path;
      }
    }
    throw new Error(
      'No credentials.json found. Looked in:\n' + candidates.join('\n'),
    );
  }
}

export interface SystemCredentials {
  /**
   * System base URL (without protocol https)
   */
  url: string;

  /**
   * Short org name from credentials.json (e.g. "demo").
   * Used by the CLI --org flag for operator-friendly targeting.
   */
  name?: string;

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
