import { Couchdb, CouchdbService } from '../couchdb/couchdb.service';
import { SystemCredentials } from '../credentials/credentials.service';

export interface ConnectivityResult {
  org: SystemCredentials;
  reachable: boolean;
  failureReason?: 'network' | 'auth';
  errorDetail?: string;
}

export interface OrgOutcome<T> {
  org: SystemCredentials;
  result: T;
}

/**
 * Generic runner that executes a callback for each org.
 * Pure logic — no console output or process control.
 */
export class OrgRunner {
  constructor(private couchdbService: CouchdbService) {}

  async checkConnectivity(
    orgs: SystemCredentials[],
  ): Promise<ConnectivityResult[]> {
    const results: ConnectivityResult[] = [];
    for (const org of orgs) {
      const couchdb = this.couchdbService.getCouchdb(
        org.url,
        org.password,
        org.username,
      );
      try {
        const session = await couchdb.get<{ userCtx?: { name: string } }>(
          '/_session',
        );
        if (!session?.userCtx?.name) {
          results.push({ org, reachable: false, failureReason: 'auth' });
        } else {
          results.push({ org, reachable: true });
        }
      } catch (e: any) {
        const detail = e?.message ?? String(e);
        results.push({
          org,
          reachable: false,
          failureReason: 'network',
          errorDetail: detail,
        });
      }
    }
    return results;
  }

  async runForEach<T>(
    orgs: SystemCredentials[],
    callback: (couchdb: Couchdb, org: SystemCredentials) => Promise<T>,
  ): Promise<OrgOutcome<T>[]> {
    const outcomes: OrgOutcome<T>[] = [];
    for (const org of orgs) {
      const couchdb = this.couchdbService.getCouchdb(
        org.url,
        org.password,
        org.username,
      );
      const result = await callback(couchdb, org);
      outcomes.push({ org, result });
    }
    return outcomes;
  }

  static filterOrgs(
    orgs: SystemCredentials[],
    options: { org?: string; category?: string },
  ): SystemCredentials[] {
    let result = orgs;

    if (options.org) {
      const names = options.org.split(',').map((s) => s.trim());
      result = result.filter(
        (c) => names.includes(c.name ?? '') || names.includes(c.url),
      );
    }

    if (options.category) {
      result = result.filter((c) => c.category === options.category);
    }

    return result;
  }

  static orgLabel(org: SystemCredentials): string {
    return org.name ? `${org.name} (${org.url})` : org.url;
  }
}
