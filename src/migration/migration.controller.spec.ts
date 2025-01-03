import { Test, TestingModule } from '@nestjs/testing';
import { MigrationController } from './migration.controller';
import { Couchdb, CouchdbService } from '../couchdb/couchdb.service';
import { ConfigService } from '@nestjs/config';
import { ConfigMigrationService } from './config-migration/config-migration.service';
import { CredentialsService } from '../credentials/credentials.service';

describe('MigrationController', () => {
  let controller: MigrationController;
  let couchdb: Couchdb;

  beforeEach(async () => {
    couchdb = {
      get: () => undefined,
      put: () => undefined,
      getAll: () => undefined,
      putAll: () => undefined,
    } as any;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationController],
      providers: [
        {
          provide: CouchdbService,
          useValue: {
            runForAllOrgs: (_, func) => func(couchdb),
          },
        },
        ConfigService,
        ConfigMigrationService,
        { provide: CredentialsService, useValue: { getCredentials: () => [] } },
      ],
    }).compile();

    controller = module.get<MigrationController>(MigrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  function mockDb(docs: { _id: string }[]) {
    jest
      .spyOn(couchdb, 'getAll')
      .mockImplementation((prefix) =>
        Promise.resolve(
          docs
            .filter(({ _id }) => _id.startsWith(prefix + ':'))
            .map((doc) => JSON.parse(JSON.stringify(doc))),
        ),
      );
    jest.spyOn(couchdb, 'get').mockImplementation((path) => {
      const id = path.split('/').pop();
      const found = docs.find(({ _id }) => _id === id);
      return found
        ? Promise.resolve(JSON.parse(JSON.stringify(found)))
        : Promise.reject();
    });
    jest.spyOn(couchdb, 'putAll').mockResolvedValue(undefined);
  }
});
