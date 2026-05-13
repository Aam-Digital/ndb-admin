import { codoAddEventType } from './config-migration/codo-add-event-type.migration';
import { latestConfigFormats } from './config-migration/latest-config-formats.migration';
import { MigrationDefinition } from './migration-definition';

export const CONFIG_DOC_PATH = '/app/Config:CONFIG_ENTITY';

/**
 * All registered migrations.
 * Add new MigrationDefinitions here to make them available to the CLI.
 * One-off migrations follow the naming convention: oneoff-YYYYMMDD-<slug>
 */
export const migrations: MigrationDefinition[] = [
  latestConfigFormats,
  codoAddEventType,
];
