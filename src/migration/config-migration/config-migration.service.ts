import { Injectable } from '@nestjs/common';
import { Couchdb } from '../../couchdb/couchdb.service';

/**
 * Apply transformations to the Config document in the CouchDB,
 * using migration functions that are also used in the frontend (ndb-core).
 */
@Injectable()
export class ConfigMigrationService {
  private async getConfigDoc(couchdb: Couchdb) {
    return couchdb.get('/app/Config:CONFIG_ENTITY');
  }

  private async saveConfigDoc(couchdb: Couchdb, configDoc: any) {
    return couchdb.put('/app/Config:CONFIG_ENTITY', configDoc);
  }

  private applyMigrations(config) {
    const migrations: ConfigMigration[] = [
      migrateEntityAttributesWithId,
      migrateFormHeadersIntoFieldGroups,
      migrateFormFieldConfigView2ViewComponent,
      migrateMenuItemConfig,
    ];

    const newConfig = JSON.parse(JSON.stringify(config), (_that, rawValue) => {
      let configPart = rawValue;
      for (const migration of migrations) {
        configPart = migration(_that, configPart);
      }
      return configPart;
    });

    return newConfig;
  }

  /**
   * apply all currently registered config format transformations, similar to the frontend, on-the-fly migrations.
   * @param couchdb
   */
  async migrateToLatestConfigFormats(couchdb: Couchdb) {
    const config = await this.getConfigDoc(couchdb);
    const newConfig = this.applyMigrations(config);
    await this.saveConfigDoc(couchdb, newConfig);
    return true;
  }
}

/**
 * A ConfigMigration is checked during a full JSON.parse using a reviver function.
 * If the migration does not apply to the given configPart, make sure to return it unchanged.
 * Multiple migrations are chained and can transform the same config part one after the other.
 *
 * --> see ndb-core (!)
 */
type ConfigMigration = (key: string, configPart: any) => any;

//
// COPIED FROM ndb-core ConfigService migrations:
//

/**
 * Transform legacy "entity:" config format into the flattened structure containing id directly.
 */
const migrateEntityAttributesWithId: ConfigMigration = (key, configPart) => {
  if (!(key.startsWith('entity') && Array.isArray(configPart.attributes))) {
    return configPart;
  }

  configPart.attributes = configPart.attributes.reduce(
    (acc, attr: { name: string; schema }) => ({
      ...acc,
      [attr.name]: attr.schema,
      // id inside the field schema config (FieldConfig) is added by EntityConfigService and does not need migration
    }),
    {},
  );

  return configPart;
};

/**
 * Transform legacy "view:...Form" config format to have form field group headers with the fields rather than as separate array.
 */
const migrateFormHeadersIntoFieldGroups: ConfigMigration = (
  key,
  configPart,
) => {
  if (!(configPart?.component === 'Form' && configPart?.config?.cols)) {
    return configPart;
  }

  const formConfig = configPart.config;

  // change .cols and .headers into .fieldGroups
  const newFormConfig = { ...formConfig };
  delete newFormConfig.cols;
  delete newFormConfig.headers;

  newFormConfig.fieldGroups = formConfig.cols?.map((colGroup) => ({
    fields: colGroup,
  }));
  if (formConfig.headers) {
    newFormConfig.fieldGroups.forEach((group, i) => {
      if (formConfig.headers[i]) {
        group.header = formConfig.headers[i];
      }
    });
  }

  configPart.config = newFormConfig;
  return configPart;
};

const migrateFormFieldConfigView2ViewComponent: ConfigMigration = (
  key,
  configPart,
) => {
  if (
    !(key === 'columns' || key === 'fields' || key === 'cols') &&
    key !== null
  ) {
    return configPart;
  }

  if (Array.isArray(configPart)) {
    return configPart.map((c) =>
      migrateFormFieldConfigView2ViewComponent(null, c),
    );
  }

  if (configPart?.view) {
    configPart.viewComponent = configPart.view;
    delete configPart.view;
  }
  if (configPart?.edit) {
    configPart.editComponent = configPart.edit;
    delete configPart.edit;
  }
  return configPart;
};

const migrateMenuItemConfig: ConfigMigration = (key, configPart) => {
  if (key !== 'navigationMenu') {
    return configPart;
  }

  const oldItems: any[] = configPart.items;

  configPart.items = oldItems.map((item) => {
    if (item.hasOwnProperty('name')) {
      return {
        label: item['name'],
        icon: item.icon,
        link: item.link,
      };
    } else {
      return item;
    }
  });

  return configPart;
};
