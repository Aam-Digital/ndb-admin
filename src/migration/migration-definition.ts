import { Couchdb } from '../couchdb/couchdb.service';
import { SystemCredentials } from '../credentials/credentials.service';

/**
 * Logger passed to each migration via MigrationContext.
 * Methods are separated so the CLI can suppress verbose output by default
 * and tests can capture output by injecting a spy.
 */
export interface MigrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Only emitted when the CLI is run with --verbose. */
  verbose(message: string): void;
}

/**
 * Context provided to every migration run.
 * Scoped to a single org.
 */
export interface MigrationContext {
  /** Raw CouchDB accessor for reads. Do not call couchdb.put directly; use ctx.put instead. */
  couchdb: Couchdb;
  org: SystemCredentials;
  dryRun: boolean;
  log: MigrationLogger;
  /** Write a single document. Validates JSON, respects dry-run, tracks stats. */
  put(
    path: string,
    data: unknown,
    db?: string,
    headers?: unknown,
  ): Promise<void>;
  /**
   * Verify that a value is JSON-serializable.
   * Throws an Error if the value contains non-serializable content (circular refs, BigInt, etc.).
   * Run this before constructing any write payload.
   */
  validateJson(value: unknown): void;
  /**
   * Write a document only if it does not already exist.
   * Returns true when the document was created, false when it was already present.
   * Throws on unexpected errors (anything other than 404).
   */
  addDocIfMissing(path: string, template: unknown): Promise<boolean>;
}

/**
 * Result returned by a migration after processing one org.
 */
export interface MigrationResult {
  changed: boolean;
  status: 'ok' | 'no-change' | 'dry-run' | 'partial' | 'failed';
  details?: unknown;
  warnings?: string[];
}

export function failedMigrationResult(message: string): MigrationResult {
  return {
    changed: false,
    status: 'failed',
    warnings: [message],
  };
}

/**
 * A MigrationDefinition describes one migration that can be run by the CLI.
 *
 * Implementations MUST be idempotent: running the same migration twice against
 * the same state must leave the data unchanged and report changed: false on the
 * second run. This is enforced by the shared idempotency test harness.
 */
export interface MigrationDefinition {
  id: string;
  description: string;
  run(ctx: MigrationContext): Promise<MigrationResult>;
}

export interface MigrationOutcome {
  result: MigrationResult;
  writeStats: { intended: number; succeeded: number; failed: number };
}
