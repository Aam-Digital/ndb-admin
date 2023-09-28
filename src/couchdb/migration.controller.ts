import { Controller, Post } from '@nestjs/common';
import { Couchdb, CouchdbService } from './couchdb.service';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { ApiOperation } from '@nestjs/swagger';

@Controller('migration')
export class MigrationController {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private couchdbService: CouchdbService,
    private configService: ConfigService,
  ) {}

  @ApiOperation({
    description:
      'Transform site-settings config from the central config doc into its own SiteSettings entity.',
  })
  @Post('site-settings')
  async createSiteSettings() {
    return await this.couchdbService.runForAllOrgs(
      credentials,
      async (couchdb: Couchdb) => {
        return this.migrateUiConfigToSettings(couchdb);
      },
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
