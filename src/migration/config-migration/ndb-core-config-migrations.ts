/**
 * Individual config migrations copied from ndb-core ConfigService.
 *
 * Source: https://github.com/Aam-Digital/ndb-core/blob/master/src/app/core/config/config.service.ts
 */

/**
 * A ConfigMigration is applied during a JSON.parse using a reviver function.
 * If the migration does not apply to the given configPart, return it unchanged.
 * Multiple migrations are chained and can transform the same config part one after the other.
 */
export type ConfigMigration = (key: string, configPart: any) => any;

/**
 * Transform legacy "entity:" config format into the flattened structure
 * containing id directly.
 */
const migrateEntityAttributesWithId: ConfigMigration = (key, configPart) => {
  if (!(key.startsWith('entity') && Array.isArray(configPart?.attributes))) {
    return configPart;
  }

  configPart.attributes = configPart.attributes.reduce(
    (acc, attr: { name: string; schema: unknown }) => ({
      ...acc,
      [attr.name]: attr.schema,
    }),
    {},
  );

  return configPart;
};

/**
 * Transform legacy "view:...Form" config format to have form field group
 * headers with the fields rather than as a separate array.
 */
const migrateFormHeadersIntoFieldGroups: ConfigMigration = (
  key,
  configPart,
) => {
  if (!(configPart?.component === 'Form' && configPart?.config?.cols)) {
    return configPart;
  }

  const formConfig = configPart.config;

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
  if (
    key !== 'navigationMenu' ||
    typeof configPart !== 'object' ||
    configPart === null
  ) {
    return configPart;
  }

  const oldItems: any[] = configPart.items;

  configPart.items = oldItems.map((item) => {
    if (Object.prototype.hasOwnProperty.call(item, 'name')) {
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

/**
 * Config properties specifying an entityType should be named "entityType"
 * rather than "entity" to avoid confusion with a specific instance of an
 * entity being passed in components.
 */
const migrateEntityDetailsInputEntityType: ConfigMigration = (
  key,
  configPart,
) => {
  if (
    key !== 'config' ||
    typeof configPart !== 'object' ||
    configPart === null
  ) {
    return configPart;
  }

  if (configPart['entity']) {
    configPart['entityType'] = configPart['entity'];
    delete configPart['entity'];
  }

  return configPart;
};

/**
 * Replace custom "entity-array" dataType with dataType="array",
 * innerDatatype="entity".
 */
const migrateEntityArrayDatatype: ConfigMigration = (key, configPart) => {
  if (configPart === 'DisplayEntityArray') {
    return 'DisplayEntity';
  }

  if (
    typeof configPart !== 'object' ||
    configPart === null ||
    !Object.prototype.hasOwnProperty.call(configPart, 'dataType')
  ) {
    return configPart;
  }

  const config = configPart;
  if (config.dataType === 'entity-array') {
    config.dataType = 'entity';
    config.isArray = true;
  }

  if (config.dataType === 'array') {
    config.dataType = config['innerDataType'];
    delete config['innerDataType'];
    config.isArray = true;
  }

  if (config.dataType === 'configurable-enum' && config['innerDataType']) {
    config.additional = config['innerDataType'];
    delete config['innerDataType'];
  }

  return configPart;
};

const migrateEntitySchemaDefaultValue: ConfigMigration = (
  key: string,
  configPart: any,
): any => {
  if (key !== 'defaultValue') {
    return configPart;
  }

  if (typeof configPart === 'object' && configPart !== null) {
    return configPart;
  }

  const placeholderValue: string | undefined = ['$now', '$current_user'].find(
    (value) => value === configPart,
  );

  if (placeholderValue) {
    return {
      mode: 'dynamic',
      value: placeholderValue,
    };
  }

  return {
    mode: 'static',
    value: configPart,
  };
};

const migrateChildrenListConfig: ConfigMigration = (key, configPart) => {
  if (
    typeof configPart !== 'object' ||
    configPart?.['component'] !== 'ChildrenList'
  ) {
    return configPart;
  }

  configPart['component'] = 'EntityList';

  configPart['config'] = configPart['config'] ?? {};
  configPart['config']['entityType'] = 'Child';
  configPart['config']['loaderMethod'] = 'ChildrenService';

  return configPart;
};

const migrateHistoricalDataComponent: ConfigMigration = (key, configPart) => {
  if (
    typeof configPart !== 'object' ||
    configPart?.['component'] !== 'HistoricalDataComponent'
  ) {
    return configPart;
  }

  configPart['component'] = 'RelatedEntities';

  configPart['config'] = configPart['config'] ?? {};
  if (Array.isArray(configPart['config'])) {
    configPart['config'] = { columns: configPart['config'] };
  }
  configPart['config']['entityType'] = 'HistoricalEntityData';
  configPart['config']['loaderMethod'] = 'HistoricalDataService';

  return configPart;
};

/**
 * All ndb-core config migrations, in order.
 */
export const ndbCoreConfigMigrations: ConfigMigration[] = [
  migrateEntityAttributesWithId,
  migrateFormHeadersIntoFieldGroups,
  migrateFormFieldConfigView2ViewComponent,
  migrateMenuItemConfig,
  migrateEntityDetailsInputEntityType,
  migrateEntityArrayDatatype,
  migrateEntitySchemaDefaultValue,
  migrateChildrenListConfig,
  migrateHistoricalDataComponent,
];
