import { MigrationDefinition, MigrationResult } from '../migration-definition';
import { CONFIG_DOC_PATH } from '../migrations';
import { ndbCoreConfigMigrations } from './ndb-core-config-migrations';

/**
 * Migrate the Config document to the latest format.
 *
 * Applies the same on-the-fly config migrations used by ndb-core, plus any
 * admin-specific migrations such as migrateAddMissingEntityAttributes.
 *
 * Idempotent: running twice against the same state reports changed: false
 * on the second run and performs no writes.
 */

export const latestConfigFormats: MigrationDefinition = {
  id: 'latest-config-formats',
  description:
    'Transform any legacy config formats to their latest formats. Safe to re-run.',

  async run(ctx): Promise<MigrationResult> {
    let config: any;
    try {
      config = await ctx.couchdb.get(CONFIG_DOC_PATH);
    } catch {
      return {
        changed: false,
        status: 'failed',
        warnings: ['Config document not found'],
      };
    }

    let newConfig: any = JSON.parse(JSON.stringify(config), (key, value) => {
      for (const migration of ndbCoreConfigMigrations) {
        value = migration(key, value);
      }
      return value;
    });

    ctx.validateJson(newConfig);

    const changed = JSON.stringify(config) !== JSON.stringify(newConfig);

    if (!changed) {
      ctx.log.info('  No changes needed');
      return {
        changed: false,
        status: 'no-change',
      };
    }

    ctx.log.info('  Config requires migration');
    if (ctx.dryRun) {
      ctx.log.verbose('  ~ Config:CONFIG_ENTITY (migration would apply)');
    }

    await ctx.put(CONFIG_DOC_PATH, newConfig);

    return {
      changed: true,
      status: ctx.dryRun ? 'dry-run' : 'ok',
    };
  },
};
