import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbAdminController } from './couchdb-admin.controller';
import { KeycloakService } from '../keycloak/keycloak.service';
import { CouchdbService } from './couchdb.service';
import { SearchAndReplaceService } from './search-and-replace/search-and-replace.service';
import { CredentialsService } from '../credentials/credentials.service';

describe('CouchdbAdminController', () => {
  let controller: CouchdbAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouchdbAdminController],
      providers: [
        { provide: KeycloakService, useValue: undefined },
        { provide: CouchdbService, useValue: undefined },
        { provide: SearchAndReplaceService, useValue: undefined },
        { provide: CredentialsService, useValue: { getCredentials: () => [] } },
      ],
    }).compile();

    controller = module.get(CouchdbAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
