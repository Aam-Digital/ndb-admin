import { Controller, Post } from '@nestjs/common';
import { CouchdbService } from './couchdb.service';
import * as credentials from '../assets/credentials.json';
import { ConfigService } from '@nestjs/config';

@Controller('migration')
export class MigrationController {
  private domain = this.configService.get('DOMAIN');

  constructor(
    private couchDB: CouchdbService,
    private configService: ConfigService,
  ) {}
  @Post('site-settings')
  async createSiteSettings() {
    for (const { name, password } of credentials) {
      const config = await this.couchDB.getDataFromDB(
        name,
        '/app/Config:CONFIG_ENTITY',
        password,
      );
      const uiConfig = config.data.appConfig as UiConfig;
      console.log('res', uiConfig);
      const siteSettings = {
        _id: 'SiteSettings:global',
        siteName: uiConfig.site_name,
        displayLanguageSelect: uiConfig.displayLanguageSelect,
        language: uiConfig.default_language,
      };
      console.log('siteSettings', siteSettings);
      if (uiConfig.logo_path) {
        const logoPath = uiConfig.logo_path.startsWith('/')
          ? uiConfig.logo_path
          : '/' + uiConfig.logo_path;
        const url = `https://${name}.${this.domain}${logoPath}`;
        const logo = await fetch(url).then((res) => res.blob());
        console.log('logo', logo);
        const attachmentsPath = '/app-attachments/SiteSettings:general';
        const att = await this.couchDB.sendDataToDB(
          name,
          attachmentsPath,
          {},
          password,
        );
        console.log('att', att);
        const upload = await this.couchDB.sendDataToDB(
          name,
          attachmentsPath + `/logo?rev=${att.rev}`,
          logo,
          password,
        );
        console.log('upload', upload);
      }
    }
  }
}

export interface UiConfig {
  logo_path?: string;
  displayLanguageSelect?: boolean;
  default_language?: string;
  site_name?: string;
}
