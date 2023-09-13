import { Controller, Post } from '@nestjs/common';
import { CouchdbService } from './couchdb.service';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { ApiOperation } from "@nestjs/swagger";

@Controller('migration')
export class MigrationController {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private couchDB: CouchdbService,
    private configService: ConfigService,
  ) {}

  @ApiOperation({
    description: 'Transform site-settings config from the central config doc into its own SiteSettings entity.',
  })
  @Post('site-settings')
  async createSiteSettings() {
    const results = {};
    for (const { name, password } of credentials) {
      await this.migrateUiConfigToSettings(name, password)
        .then((res) => (results[name] = res))
        .catch((err) =>
          console.error('ERROR migrating UiConfig for: ' + name, err),
        );
    }
    return results;
  }

  private async migrateUiConfigToSettings(name, password) {
    const configPath = '/app/Config:CONFIG_ENTITY';
    const config = await this.couchDB.get(name, configPath, password);
    const uiConfig = config.data.appConfig as UiConfig;
    const siteSettings = {
      siteName: uiConfig.site_name,
      displayLanguageSelect: uiConfig.displayLanguageSelect,
      language: uiConfig.default_language,
    };
    if (uiConfig.logo_path) {
      await this.uploadLogo(uiConfig.logo_path, name, password)
        .then((fileName) => (siteSettings['logo'] = fileName))
        .catch((err) => console.error('ERROR uploading logo', err));
    }
    await this.couchDB.put(
      name,
      '/app/SiteSettings:global',
      siteSettings,
      password,
    );
    // delete deprecated attribute
    delete config.data.appConfig;
    await this.couchDB.put(name, configPath, config, password);
    console.log('migrated', name);
    return siteSettings;
  }

  private async uploadLogo(logoPath: string, name, password) {
    logoPath = logoPath.startsWith('/') ? logoPath : '/' + logoPath;
    const url = `https://${name}.${this.domain}${logoPath}`;
    const logo = await fetch(url).then((res) => res.blob());
    const logoBuffer = await logo.arrayBuffer();
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: 300 })
      .toBuffer();
    const resizedBlob = new Blob([new Uint8Array(resizedLogo)], {
      type: logo.type,
    });
    const attachmentsPath = '/app-attachments/SiteSettings:general';
    const att = await this.couchDB.put(name, attachmentsPath, {}, password);
    await this.couchDB.put(
      name,
      attachmentsPath + `/logo?rev=${att.rev}`,
      resizedBlob,
      password,
    );
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
