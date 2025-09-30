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

    const results = await this.couchdbService.runForAllOrgs(
      this.credentialsService.getCredentials(),
      async (couchdb: Couchdb) => {
        const users = await this.keycloakService
          .getUsersFromKeycloak(couchdb.url.split('.')[0], token)
          .catch(() => {
            console.warn("Couldn't get users from Keycloak for", couchdb.url);
            return [];
          });

        await this.createOrUpdateStatisticsView(couchdb);
        const stats_all = await couchdb
          .get<
            { key: string; value: number }[]
          >(STATISTICS_DESIGN_DOC_ID + '/_view/entities_all?group=true', 'app')
          .catch(() => {
            console.warn(
              "Couldn't get statistics (entities_all) from CouchDB for",
              couchdb.url,
            );
            return [];
          });

        const stats_active = await couchdb
          .get<
            { key: string; value: number }[]
          >(STATISTICS_DESIGN_DOC_ID + '/_view/entities_active?group=true', 'app')
          .catch(() => {
            console.warn(
              "Couldn't get statistics (entities_active) from CouchDB for",
              couchdb.url,
            );
            return [];
          });

        const stats: { [key: string]: { all: number; active: number } } = {};
        for (const row of stats_all) {
          stats[row.key] = { all: row.value, active: 0 };
        }
        for (const row of stats_active) {
          if (stats[row.key]) {
            stats[row.key].active = row.value;
          } else {
            stats[row.key] = { all: 0, active: row.value };
          }
        }

        return {
          name: couchdb.url,
          users: users.length,
          entities: stats,
        };
      },
    );

    return Object.values(results);
  }

  private async createOrUpdateStatisticsView(couchdb: Couchdb): Promise<void> {
    const mapEntitiesFn: string =
      "function(doc) { var prefix = doc._id.split(':')[0]; if (prefix && doc._id.indexOf(':') > 0) { emit(prefix, doc.inactive ? 0 : 1); } }";
    const statisticsDesignDoc = {
      _id: STATISTICS_DESIGN_DOC_ID,
      views: {
        entities_all: {
          map: mapEntitiesFn,
          reduce: '_count',
        },
        entities_active: {
          map: mapEntitiesFn,
          reduce: '_sum', // sum only active entities (emitted as "1")
        },
      },
    };

    try {
      // Try to get existing design document
      const existingDoc = await couchdb.get(STATISTICS_DESIGN_DOC_ID, 'app');

      // Update with current revision
      const updatedDoc = {
        ...statisticsDesignDoc,
        _rev: existingDoc._rev,
      };

      await couchdb.put(STATISTICS_DESIGN_DOC_ID, updatedDoc, 'app');
    } catch (error) {
      if (error.status === 404) {
        // Document doesn't exist, create new one
        await couchdb.put(STATISTICS_DESIGN_DOC_ID, statisticsDesignDoc, 'app');
      } else {
        console.error('Error creating statistics design document:', error);
      }
    }
  }
}

const STATISTICS_DESIGN_DOC_ID = '_design/statistics';
