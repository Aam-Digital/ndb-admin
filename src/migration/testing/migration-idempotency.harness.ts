/**
 * Idempotency test harness for MigrationDefinition implementations.
 *
 * Usage:
 *   const result = await runIdempotencyCheck(myMigration, { 'db/path': docObj });
 *   expect(result.secondRunResult.changed).toBe(false);
 */

import { jest } from '@jest/globals';
import { Couchdb } from '../../couchdb/couchdb.service';
import { SystemCredentials } from '../../credentials/credentials.service';
import {
  MigrationContext,
  MigrationDefinition,
  MigrationLogger,
  MigrationResult,
} from '../migration-definition';

/** In-memory document store used by the stub. Key format: "db/path" or simply "path". */
export type DocStore = Record<string, unknown>;

export interface IdempotencyCheckResult {
  firstRunResult: MigrationResult;
  secondRunResult: MigrationResult;
  /** State of the doc store after the first run. */
  stateAfterFirstRun: DocStore;
  /** State of the doc store after the second run (should equal stateAfterFirstRun). */
  stateAfterSecondRun: DocStore;
}

/**
 * Build a stub Couchdb whose reads and writes operate against an in-memory DocStore.
 *
 * The stub maps put(path, data, db?) into the store as `${db ?? 'app'}/${path}`.
 * It supports the minimal surface used by the current migrations:
 *   - get(path)              → store lookup; throws 404-like error when missing
 *   - put(path, data, db?)   → store upsert
 *   - putAll(docs, db?)      → bulk upsert keyed by doc._id
 *   - getAll(prefix, db?)    → returns values whose key matches `${db ?? 'app'}/${prefix}`
 *   - post(path, data, db?)  → store upsert (treated same as put)
 *   - find(query, db?)       → naive full-store scan (docs array, no index)
 */
export function buildStubCouchdb(store: DocStore): Couchdb {
  let idCounter = 0;
  function key(path: string, db?: string): string {
    const normalized = path.replace(/^\//, '');
    if (db) {
      return `${db}/${normalized}`;
    }
    // If the path already contains a db prefix (e.g. "app/Doc:ID"), use as-is
    return normalized;
  }

  return {
    get: jest.fn(async (path: string, db?: string) => {
      const k = key(path, db);
      const val = store[k];
      if (val === undefined) {
        const err = new Error(`Not found: ${k}`) as Error & {
          status: number;
          response: { status: number };
        };
        err.status = 404;
        err.response = { status: 404 };
        throw err;
      }
      return val;
    }),

    put: jest.fn(async (path: string, data: unknown, db?: string) => {
      store[key(path, db)] = JSON.parse(JSON.stringify(data));
    }),

    putAll: jest.fn(async (docs: any[], db?: string) => {
      const results: { ok: boolean; id: string }[] = [];
      for (const doc of docs) {
        const id: string = doc._id ?? doc.id ?? `generated-${idCounter++}`;
        store[key(id, db)] = JSON.parse(JSON.stringify(doc));
        results.push({ ok: true, id });
      }
      return results;
    }),

    getAll: jest.fn(async (prefix: string, db?: string) => {
      const base = `${db ?? 'app'}/`;
      return Object.entries(store)
        .filter(
          ([k]) =>
            k.startsWith(base) && k.slice(base.length).startsWith(prefix),
        )
        .map(([, v]) => v);
    }),

    post: jest.fn(async (path: string, data: unknown, db?: string) => {
      store[key(path, db)] = JSON.parse(JSON.stringify(data));
    }),

    find: jest.fn(async (query: any, db?: string) => {
      const base = `${db ?? 'app'}/`;
      const all = Object.entries(store)
        .filter(([k]) => k.startsWith(base))
        .map(([, v]) => v);
      // Return all docs; tests should seed only relevant data
      return { docs: all };
    }),
  } as unknown as Couchdb;
}

export const silentLogger: MigrationLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  verbose: () => {},
};

const fakeOrg: SystemCredentials = {
  url: 'https://test.example.com',
  username: 'admin',
  password: 'secret',
  name: 'test',
};

export function buildTestContext(
  store: DocStore,
  dryRun = false,
): MigrationContext & { store: DocStore } {
  const stubCouchdb = buildStubCouchdb(store);

  const writes: { intended: number; succeeded: number; failed: number } = {
    intended: 0,
    succeeded: 0,
    failed: 0,
  };

  const validateJson = (value: unknown): void => {
    try {
      JSON.stringify(value);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`JSON validation failed: ${message}`);
    }
  };

  return {
    couchdb: stubCouchdb,
    org: fakeOrg,
    dryRun,
    log: silentLogger,
    validateJson,
    async put(path, data, db?, _headers?) {
      validateJson(data);
      writes.intended++;
      if (dryRun) return;
      await stubCouchdb.put(path, data, db);
      writes.succeeded++;
    },
    async addDocIfMissing(path, template) {
      try {
        await stubCouchdb.get(path);
        return false;
      } catch (error: unknown) {
        if ((error as { status?: number }).status !== 404) {
          throw error;
        }
      }
      await this.put(path, template);
      return true;
    },
    store,
  };
}

/**
 * Run idempotency check for a single migration.
 *
 * @param migration  The migration to test.
 * @param initialDocs  Seed documents as a DocStore record.
 *                     Keys use the same `db/path` convention as the stub.
 *                     Tip: Use `"app/Config:CONFIG_ENTITY"` for the main config doc.
 */
export async function runIdempotencyCheck(
  migration: MigrationDefinition,
  initialDocs: DocStore = {},
): Promise<IdempotencyCheckResult> {
  // First run
  const store1: DocStore = JSON.parse(JSON.stringify(initialDocs));
  const ctx1 = buildTestContext(store1, false);
  const firstRunResult = await migration.run(ctx1);
  const stateAfterFirstRun: DocStore = JSON.parse(JSON.stringify(store1));

  // Second run — same store state as left after first run
  const store2: DocStore = JSON.parse(JSON.stringify(stateAfterFirstRun));
  const ctx2 = buildTestContext(store2, false);
  const secondRunResult = await migration.run(ctx2);
  const stateAfterSecondRun: DocStore = JSON.parse(JSON.stringify(store2));

  return {
    firstRunResult,
    secondRunResult,
    stateAfterFirstRun,
    stateAfterSecondRun,
  };
}
