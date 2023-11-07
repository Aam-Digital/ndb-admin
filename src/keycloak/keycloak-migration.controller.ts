import { Body, Controller, Post } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { RealmConfig } from './realm-config.dto';
import { ClientConfig } from './client-config.dto';

@Controller('keycloak-migration')
export class KeycloakMigrationController {
  private config;
  constructor(private keycloak: KeycloakService, private http: HttpService) {}
  @Post('realms')
  migrateRealms(@Body() realmConfig: RealmConfig) {
    return this.runForAllRealms((realm) =>
      this.updateRealm(realm, realmConfig),
    );
  }

  @Post('clients')
  migrateClients(@Body() clientConfig: ClientConfig) {
    return this.runForAllRealms((realm) =>
      this.updateClient(realm, clientConfig),
    );
  }

  private async runForAllRealms(func: (realm: string) => Promise<any>) {
    const token = await this.keycloak.getKeycloakToken();
    this.config = { headers: { Authorization: 'Bearer ' + token } };
    const realms = await this.getResource<RealmConfig[]>();
    const results = realms
      .map(({ realm }) => realm)
      .filter((realm) => realm !== 'master')
      .map((realm) => func(realm));
    return Promise.all(results);
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
  }

  private updateClient(realm: string, clientConfig: ClientConfig) {
    const clientPath = `${realm}/clients`;
    return this.getResource<ClientConfig[]>(`${clientPath}?clientId=app`)
      .then(([client]) => this.deleteResource(`${clientPath}/${client.id}`))
      .then(() => this.createResource(clientPath, clientConfig));
  }

  /**
   * Aligns realm resource from config with actual on server
   * TODO deleting and updating is not supported yet. Only creating new.
   * @private
   */
  private alignResources<T, P extends keyof T>(
    update: T[],
    existing: T[],
    property: P,
    path: string,
  ) {
    const missingResources = update.filter(
      (r) => !existing.some((c) => c[property] === r[property]),
    );
    return Promise.all(
      missingResources.map((res) => this.createResource(path, res)),
    );
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

  private getResource<T = any>(path = '') {
    return firstValueFrom(
      this.http
        .get<T>(
          `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
          this.config,
        )
        .pipe(map((res) => res.data)),
    );
  }

  private deleteResource(path: string) {
    return firstValueFrom(
      this.http.delete(
        `${this.keycloak.keycloakUrl}/admin/realms/${path}`,
        this.config,
      ),
    );
  }
}
