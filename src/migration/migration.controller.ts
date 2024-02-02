import { Controller, Post } from '@nestjs/common';
import { Couchdb, CouchdbService } from '../couchdb/couchdb.service';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { ApiOperation } from '@nestjs/swagger';
import { ConfigMigrationService } from './config-migration/config-migration.service';

@Controller('migration')
export class MigrationController {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private couchdbService: CouchdbService,
    private configService: ConfigService,
    private configMigrationService: ConfigMigrationService,
  ) {}

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

  @ApiOperation({
    description:
      'Transform any legacy config formats to their latest formats. If already in new formats, this will have no effect.',
  })
  @Post('latest-config-formats')
  async migrateToLatestConfigFormats() {
    return this.couchdbService.runForAllOrgs(credentials, (couchdb: Couchdb) =>
      this.configMigrationService.migrateToLatestConfigFormats(couchdb),
    );
  }
}

export interface UiConfig {
  logo_path?: string;
  displayLanguageSelect?: boolean;
  default_language?: string;
  site_name?: string;
}
