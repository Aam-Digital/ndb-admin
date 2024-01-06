import { Controller, Post } from '@nestjs/common';
import { Couchdb, CouchdbService } from './couchdb.service';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { ApiOperation } from '@nestjs/swagger';
import { isEqual } from 'lodash';

@Controller('migration')
export class MigrationController {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private couchdbService: CouchdbService,
    private configService: ConfigService,
  ) {}

  @Post('entity-ids')
  migrateEntityIds() {
    /**
     * - Collect built in entity references √
     * - Update with customer config
     * - fetch all entities and update ID if necessary
     * - Also migrate createdBy and updatedBy
     * - Also migrate attendance
     * - Also migrate TodoCompletion
     * - Migrate enum entity names in schema?
     */
    const defaultReferences = {
      Config: {},
      ConfigurableEnum: {},
      SiteSettings: {},
      User: {},
      Child: {},
      School: {},
      Note: { children: 'Child', authors: 'User', schools: 'School' },
      TimePeriod: {},
      ChildSchoolRelation: { childId: 'Child', schoolId: 'School' },
      Aser: { child: 'Child' },
      HealthCheck: { child: 'Child' },
      RecurringActivity: {
        participants: 'Child',
        linkedGroups: 'School',
        excludedParticipants: 'Child',
        assignedTo: 'User',
      },
      EventNote: { children: 'Child', authors: 'User', schools: 'School' },
      EducationalMaterial: {},
      HistoricalEntityData: { relatedEntity: 'Child' },
      ProgressDashboardConfig: {},
      Todo: {
        assignedTo: 'User',
        relatedEntities: ['Child', 'School', 'RecurringActivity'],
      },
    };
    return this.couchdbService.runForAllOrgs(credentials, async (couchdb) => {
      const updatedReferences = await this.applyConfig(
        defaultReferences,
        couchdb,
      );
      const results = Object.entries(updatedReferences).map(
        async ([entity, references]) => {
          const entities = await couchdb.getAll(entity);
          const updated = this.updateEntities(entities, references, entity);
          if (updated.length > 0) {
            return couchdb.putAll(updated);
          }
        },
      );
      return Promise.all(results);
    });
  }

  private async applyConfig(
    defaultEntities: EntityProperties,
    couchdb: Couchdb,
  ): Promise<EntityProperties> {
    const updatedEntities: EntityProperties = JSON.parse(
      JSON.stringify(defaultEntities),
    );
    const config: Config = await couchdb
      .get('app/Config:CONFIG_ENTITY')
      .catch(() => ({ data: {} }));
    Object.entries(config.data)
      .filter(([key]) => key.startsWith('entity:'))
      .forEach(([key, entityConfig]) => {
        const entity = key.split(':').pop();
        if (!updatedEntities[entity]) {
          // New entity which might extend another
          updatedEntities[entity] = entityConfig.extends
            ? { ...updatedEntities[entityConfig.extends] }
            : {};
        }
        const entityObj = updatedEntities[entity];
        entityConfig.attributes
          .filter(
            ({ schema }) =>
              schema.dataType === 'entity' ||
              schema.dataType === 'entity-array',
          )
          .forEach(({ name, schema }) => (entityObj[name] = schema.additional));
      });
    return updatedEntities;
  }

  private updateEntities(
    entities: any[],
    refs: { [key: string]: string | string[] },
    entityType: string,
  ): any[] {
    const updated = entities.map((entity) => {
      const res = { ...entity };
      // migrate properties
      for (const [prop, additional] of Object.entries(refs)) {
        if (typeof additional !== 'string') {
          // Multiple entity types should already have full ID
          continue;
        }
        if (res[prop]) {
          const val = res[prop];
          if (Array.isArray(val)) {
            res[prop] = val.map((id) => this.createPrefixedId(additional, id));
          } else {
            res[prop] = this.createPrefixedId(additional, val);
          }
        }
      }

      // migrate 'create'/'updated' property
      ['created', 'updated'].forEach((prop) => {
        if (res[prop]?.by) {
          res[prop] = {
            ...res[prop],
            by: this.createPrefixedId('User', res[prop].by),
          };
        }
      });

      if (entityType === 'Note' || entityType === 'EventNote') {
        // migrate attendance
        if (entity['childrenAttendance']) {
          res['childrenAttendance'] = entity['childrenAttendance'].map(
            ([childId, attendance]) => [
              this.createPrefixedId('Child', childId),
              attendance,
            ],
          );
        }
      }
      return res;
    });
    // filter unmodified
    return updated.filter((entity, i) => !isEqual(entity, entities[i]));
  }

  private createPrefixedId(entity: string, id: string) {
    const prefix = entity + ':';
    if (id.includes(':')) {
      if (id.startsWith(prefix)) {
        return id;
      } else {
        throw new Error(`Invalid ID for entity "${entity}": ${id}`);
      }
    } else {
      return prefix + id;
    }
  }

  @ApiOperation({
    description:
      'Extract report configurations from config to own individual entities.',
  })
  @Post('report-entities')
  migrateReportsToEntities() {
    return this.couchdbService.runForAllOrgs(credentials, async (couchdb) => {
      const configPath = '/app/Config:CONFIG_ENTITY';
      const config = await couchdb.get(configPath);
      const res = Object.entries<any>(config.data).find(
        ([_, val]) => val.component === 'Reporting',
      );
      if (!res) {
        // No report config
        return 'unmodified';
      }
      const reports: { title: string }[] = config.data[res[0]].config.reports;
      await Promise.all(
        reports.map((report) => {
          const reportId = report.title.replace(' ', '');
          return couchdb.put(`/app/ReportConfig:${reportId}`, report);
        }),
      );
      delete config.data[res[0]].config;
      return couchdb.put(configPath, config);
    });
  }
  @ApiOperation({
    description:
      'Transform site-settings config from the central config doc into its own SiteSettings entity.',
  })
  @Post('site-settings')
  async createSiteSettings() {
    return this.couchdbService.runForAllOrgs(credentials, (couchdb: Couchdb) =>
      this.migrateUiConfigToSettings(couchdb),
    );
  }

  private async migrateUiConfigToSettings(couchdb: Couchdb) {
    const configPath = '/app/Config:CONFIG_ENTITY';
    const config = await couchdb.get(configPath);
    const uiConfig = config.data.appConfig as UiConfig;
    const siteSettings = {
      siteName: uiConfig.site_name,
      displayLanguageSelect: uiConfig.displayLanguageSelect,
      defaultLanguage: uiConfig.default_language,
    };
    if (uiConfig.logo_path) {
      await this.uploadLogo(uiConfig.logo_path, couchdb)
        .then((fileName) => (siteSettings['logo'] = fileName))
        .catch((err) => console.error('ERROR uploading logo', err));
    }
    await couchdb.put('/app/SiteSettings:global', siteSettings);
    // delete deprecated attribute
    delete config.data.appConfig;
    await couchdb.put(configPath, config);
    console.log('migrated', couchdb.org);
    return siteSettings;
  }

  private async uploadLogo(logoPath: string, couchdb: Couchdb) {
    logoPath = logoPath.startsWith('/') ? logoPath : '/' + logoPath;
    const url = `https://${couchdb.org}.${this.domain}${logoPath}`;
    const logo = await fetch(url).then((res) => res.blob());
    const logoBuffer = await logo.arrayBuffer();
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: 300 })
      .toBuffer();
    const resizedBlob = new Blob([new Uint8Array(resizedLogo as any)], {
      type: logo.type,
    });
    const attachmentsPath = '/app-attachments/SiteSettings:global';
    const att = await couchdb.put(attachmentsPath, {});
    await couchdb.put(attachmentsPath + `/logo?rev=${att.rev}`, resizedBlob);
    // return filename
    return logoPath.split('/').pop();
  }
}

export interface UiConfig {
  logo_path?: string;
  displayLanguageSelect?: boolean;
  default_language?: string;
  site_name?: string;
}

type EntityProperties = {
  [key: string]: { [key: string]: string | string[] };
};

type Config = {
  data: {
    // Entity config if key is "entity:..."
    [key: string]: {
      extends?: string;
      attributes: {
        name: string;
        schema: { dataType: string; additional: string | string[] };
      }[];
    };
  };
};
