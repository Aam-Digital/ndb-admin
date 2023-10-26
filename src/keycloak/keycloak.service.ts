import { Injectable } from '@nestjs/common';
import { firstValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeycloakService {
  private keycloakPassword = this.configService.get('KEYCLOAK_ADMIN_PASSWORD');
  keycloakUrl = this.configService.get('KEYCLOAK_URL');
  constructor(
    private http: HttpService,
    private configService: ConfigService,
  ) {}

  getKeycloakToken(): Promise<string> {
    const body = new URLSearchParams();
    body.set('username', 'admin');
    body.set('password', this.keycloakPassword);
    body.set('grant_type', 'password');
    body.set('client_id', 'admin-cli');
    return firstValueFrom(
      this.http
        .post<{ access_token: string }>(
          `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
          body.toString(),
        )
        .pipe(map((res) => res.data.access_token)),
    );
  }

  getUsersFromKeycloak(org: string, token: string) {
    return firstValueFrom(
      this.http
        .get<{ access_token: string }>(
          `${this.keycloakUrl}/admin/realms/${org}/users?enabled=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .pipe(map((res) => res.data)),
    );
  }
}
