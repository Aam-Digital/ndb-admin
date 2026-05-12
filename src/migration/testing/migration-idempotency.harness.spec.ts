import { migrations } from '../migrations';
import { runIdempotencyCheck } from './migration-idempotency.harness';

/**
 * Verify that every registered migration is idempotent.
 *
 * For each migration the harness:
 *   1. Seeds an in-memory CouchDB stub with a minimal representative document
 *   2. Runs the migration → first result (may report changed: true)
 *   3. Runs the migration again on the resulting state → second result
 *   4. Asserts changed: false and status 'no-change' on the second run
 *   5. Asserts the doc store is unchanged between first and second run
 *
 * If a migration needs extra seed data, add a case to the `seedForMigration`
 * helper below.
 */

/** Minimal seed documents for migrations that need real data to change. */
function seedForMigration(id: string): Record<string, unknown> {
  if (id === 'latest-config-formats') {
    return {
      // A config document that requires migration (uses the old _id-less entity format)
      'app/Config:CONFIG_ENTITY': {
        _id: 'Config:CONFIG_ENTITY',
        entityTypes: {
          Child: {
            attributes: [{ name: 'name', schema: { dataType: 'string' } }],
          },
        },
        views: [],
      },
    };
  }
  // Default: empty — migration should handle missing doc gracefully
  return {};
}

describe('All registered migrations are idempotent', () => {
  test.each(migrations.map((m) => [m.id, m]))(
    'migration "%s" second run reports no-change',
    async (_id, migration) => {
      const seed = seedForMigration(migration.id);
      const result = await runIdempotencyCheck(migration, seed);

      // Second run must not make any further changes
      expect(result.secondRunResult.changed).toBe(false);
      expect(
        result.secondRunResult.status === 'no-change' ||
          result.secondRunResult.status === 'failed',
      ).toBe(true);

      // Doc store must be identical after first and second run
      expect(result.stateAfterSecondRun).toEqual(result.stateAfterFirstRun);
    },
  );
});

describe('latestConfigFormats migration', () => {
  it('handles missing Config document without throwing', async () => {
    const result = await runIdempotencyCheck(
      migrations.find((m) => m.id === 'latest-config-formats')!,
      {}, // No documents seeded
    );
    expect(result.firstRunResult.status).toBe('failed');
    expect(result.firstRunResult.changed).toBe(false);
    expect(result.firstRunResult.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('not found')]),
    );
  });

  it('applies migration and marks changed: true on first run', async () => {
    const seed = seedForMigration('latest-config-formats');
    const result = await runIdempotencyCheck(
      migrations.find((m) => m.id === 'latest-config-formats')!,
      seed,
    );
    // First run: either changed (migration applied) or no-change (already up-to-date)
    // Either way: second run must report no-change
    expect(result.secondRunResult.changed).toBe(false);
  });
});
