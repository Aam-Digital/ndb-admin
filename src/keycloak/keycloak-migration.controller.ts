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
    await this.updateResource(realm, realmConfig);
    await this.alignResources(
      realmConfig.clientScopes,
      'name',
      `${realm}/client-scopes`,
    );
    await this.alignResources(
      realmConfig.authenticationFlows,
      'alias',
      `${realm}/authentication/flows`,
    );
    // await this.alignResources(
    //   realmConfig.authenticatorConfig,
    //   'alias',
    //   `${realm}/authentication/flows`,
    // );
  }

  /**
   * Aligns realm resource from config with actual on server
   * TODO deleting and updating is not supported yet. Only creating new.
   * @param resources
   * @param property
   * @param path
   * @private
   */
  private async alignResources<T, P extends keyof T>(
    resources: T[],
    property: P,
    path: string,
  ) {
    const existingResources = await this.getResource<T[]>(`realms/${path}`);
    console.log(
      'existing',
      path,
      existingResources.map((r) => r[property]),
    );
    console.log(
      'resources',
      path,
      resources.map((r) => r[property]),
    );
    const missingResources = resources.filter(
      (r) => !existingResources.some((c) => c[property] === r[property]),
    );
    console.log('missing', path, missingResources);
    // return missingResources.map((scope) => this.createResource(path, scope));
  }

  private createResource(path: string, resource) {
    return firstValueFrom(
      this.http.post(
        `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
        resource,
        this.config,
      ),
    );
  }

  private async updateResource(path: string, resource: any) {
    await firstValueFrom(
      this.http.put(
        `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
        resource,
        this.config,
      ),
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
