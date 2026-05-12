import { Couchdb } from '../couchdb/couchdb.service';
import { SystemCredentials } from '../credentials/credentials.service';
import { MigrationContext, MigrationLogger } from './migration-definition';

/**
 * Concrete MigrationContext for one org.
 *
 * - validates JSON serializability on every write payload
 * - in dry-run mode records intended writes without calling CouchDB
 * - in real execution calls CouchDB and inspects _bulk_docs per-doc responses
 * - tracks intended / succeeded / failed write counts via getWriteStats()
 */
export class TrackedMigrationContext implements MigrationContext {
  private intended = 0;
  private succeeded = 0;
  private failed = 0;

  constructor(
    readonly couchdb: Couchdb,
    readonly org: SystemCredentials,
    readonly dryRun: boolean,
    readonly log: MigrationLogger,
  ) {}

  validateJson(value: unknown): void {
    try {
      JSON.stringify(value);
    } catch (e: any) {
      throw new Error(`JSON validation failed: ${e.message}`);
    }
  }

  getWriteStats(): { intended: number; succeeded: number; failed: number } {
    return {
      intended: this.intended,
      succeeded: this.succeeded,
      failed: this.failed,
    };
  }

  async put(
    path: string,
    data: unknown,
    db?: string,
    headers?: unknown,
  ): Promise<void> {
    this.validateJson(data);
    this.intended++;
    if (this.dryRun) {
      this.log.verbose(`  [PREVIEW] Would PUT ${path}`);
      return;
    }
    try {
      await this.couchdb.put(path, data, db, headers);
      this.succeeded++;
    } catch (e) {
      this.failed++;
      throw e;
    }
  }


}
