import { Body, Controller, Post } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { RealmConfig } from './realm-config.dto';

@Controller('keycloak-migration')
export class KeycloakMigrationController {
  private config;
  constructor(private keycloak: KeycloakService, private http: HttpService) {}
  @Post('realms')
  async migrateRealms(@Body() realmConfig: RealmConfig) {
    const token = await this.keycloak.getKeycloakToken();
    this.config = { headers: { Authorization: 'Bearer ' + token } };
    const realms = await this.getResource<RealmConfig[]>('realms');
    // realms
    //   .map(({ realm }) => realm)
    //   .filter((realm) => realm !== 'master')
    //   .map((realm) => this.updateRealm(realm, realmConfig));
    return this.updateRealm('test', realmConfig);
    return realms;
  }

  private async updateRealm(realm: string, realmConfig: RealmConfig) {
    const currentConfig = await this.createResource<RealmConfig>(
      `${realm}/partial-export`,
    );
    await this.updateResource(realm, realmConfig);
    await this.alignResources(
      realmConfig.clientScopes,
      currentConfig.clientScopes,
      'name',
      `${realm}/client-scopes`,
    );
    await this.alignResources(
      realmConfig.authenticationFlows,
      currentConfig.authenticationFlows,
      'alias',
      `${realm}/authentication/flows`,
    );
    await this.alignResources(
      realmConfig.authenticatorConfig,
      currentConfig.authenticatorConfig,
      'alias',
      `${realm}/authentication/flows`,
    );
  }

  /**
   * Aligns realm resource from config with actual on server
   * TODO deleting and updating is not supported yet. Only creating new.
   * @private
   */
  private async alignResources<T, P extends keyof T>(
    update: T[],
    existing: T[],
    property: P,
    path: string,
  ) {
    const missingResources = update.filter(
      (r) => !existing.some((c) => c[property] === r[property]),
    );
    return missingResources.map((scope) => this.createResource(path, scope));
  }

  private createResource<T = any>(path: string, resource?) {
    return firstValueFrom(
      this.http
        .post<T>(
          `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
          resource,
          this.config,
        )
        .pipe(map((res) => res.data)),
    );
  }

  private updateResource<T = any>(path: string, resource?: any) {
    return firstValueFrom(
      this.http
        .put<T>(
          `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
          resource,
          this.config,
        )
        .pipe(map((res) => res.data)),
    );
  }

  private async getResource<T = any>(path: string) {
    return await firstValueFrom(
      this.http
        .get<T>(`${this.keycloak.keycloakUrl}/admin/${path}`, this.config)
        .pipe(map((res) => res.data)),
    );
  }
}
