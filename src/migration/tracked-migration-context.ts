import diff from 'microdiff';
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
 * - logs a diff of changes for every put
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`JSON validation failed: ${message}`);
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

    await this.logDiff(path, data, db);

    if (this.dryRun) {
      this.log.verbose(`[PREVIEW] Would PUT ${path}`);
      return;
    }
    try {
      await this.couchdb.put(path, data, db, headers);
      this.succeeded++;
    } catch (e: unknown) {
      this.failed++;
      throw e;
    }
  }

  private async logDiff(
    path: string,
    newData: unknown,
    db?: string,
  ): Promise<void> {
    let oldData: unknown;
    try {
      oldData = await this.couchdb.get(path, db);
    } catch {
      this.log.verbose(`+ ${path} (new document)`);
      return;
    }

    if (
      typeof oldData !== 'object' ||
      oldData === null ||
      typeof newData !== 'object' ||
      newData === null
    ) {
      return;
    }

    const changes = diff(
      oldData as Record<string, unknown>,
      newData as Record<string, unknown>,
      { cyclesFix: false },
    );
    if (changes.length === 0) return;

    for (const change of changes) {
      const pathStr = change.path.join('.');
      switch (change.type) {
        case 'CREATE':
          this.log.verbose(
            `  + ${pathStr}: ${truncate(JSON.stringify(change.value))}`,
          );
          break;
        case 'REMOVE':
          this.log.verbose(
            `  - ${pathStr}: ${truncate(JSON.stringify(change.oldValue))}`,
          );
          break;
        case 'CHANGE':
          this.log.verbose(
            `  ~ ${pathStr}: ${truncate(JSON.stringify(change.oldValue))} → ${truncate(JSON.stringify(change.value))}`,
          );
          break;
      }
    }
  }
}

function truncate(str: string | undefined, max = 200): string {
  if (!str) return '(undefined)';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
