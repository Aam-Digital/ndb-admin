import { Injectable } from '@nestjs/common';
import { Couchdb, CouchdbService } from '../couchdb.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import { CredentialsService } from '../../credentials/credentials.service';
import { SystemStatistics } from './system-statistics';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly couchdbService: CouchdbService,
    private readonly keycloakService: KeycloakService,
    private readonly credentialsService: CredentialsService,
  ) {}

  async getStatistics(): Promise<SystemStatistics[]> {
    const token = await this.keycloakService.getKeycloakToken();
    const allChildren =
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"';

    const results = await this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) => {
        const users = await this.keycloakService
          .getUsersFromKeycloak(couchdb.url.split('.')[0], token)
          .catch(() => {
            console.warn("Couldn't get users from Keycloak for", couchdb.url);
            return [];
          });

        const children: any[] | undefined = await couchdb
          .get(allChildren)
          .catch(() => undefined);
        const active: any[] | undefined = await couchdb
          .find(activeChildrenFilter)
          .catch(() => undefined);

        return {
          name: couchdb.url,
          users: users.length,
          childrenTotal: children ? children.length : -1,
          childrenActive: active ? active.length : -1,
        };
      },
    );

    return Object.values(results);
  }
}

const activeChildrenFilter = {
  selector: {
    _id: {
      $gt: 'Child:',
      $lt: 'Child:\uffff',
    },
    status: {
      $or: [
        {
          $not: {
            $eq: 'Dropout',
          },
        },
        {
          $exists: false,
        },
      ],
    },
    dropoutDate: {
      $exists: false,
    },
    exit_date: {
      $exists: false,
    },
    active: {
      $or: [
        {
          $exists: false,
        },
        {
          $eq: true,
        },
      ],
    },
    inactive: {
      $or: [
        {
          $exists: false,
        },
        {
          $eq: false,
        },
      ],
    },
  },
  execution_stats: true,
  limit: 100000,
  skip: 0,
};
