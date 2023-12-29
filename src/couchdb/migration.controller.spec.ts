import { Test, TestingModule } from '@nestjs/testing';
import { MigrationController } from './migration.controller';
import { Couchdb, CouchdbService } from './couchdb.service';
import { ConfigService } from '@nestjs/config';

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
      ],
    }).compile();

    controller = module.get<MigrationController>(MigrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create report entities for each report and delete them from config', async () => {
    const aggregationReport = {
      title: 'Aggregation report',
      aggregationDefinitions: [
        {
          query: 'someQuery',
          label: 'some label',
        },
      ],
    };
    const exportReport = {
      title: 'Export',
      mode: 'exporting',
      aggregationDefinitions: [],
    };
    const config = {
      'view:reportRoute': {
        component: 'Reporting',
        config: {
          reports: [aggregationReport, exportReport],
        },
      },
      'view:otherRoute': {
        component: 'OtherComp',
        config: { some: 'config' },
      },
    };
    jest.spyOn(couchdb, 'get').mockResolvedValue({ data: config });
    jest.spyOn(couchdb, 'put');

    await controller.migrateReportsToEntities();

    expect(couchdb.get).toHaveBeenCalledWith('/app/Config:CONFIG_ENTITY');
    expect(couchdb.put).toHaveBeenCalledWith(
      `/app/ReportConfig:${aggregationReport.title.replace(' ', '')}`,
      aggregationReport,
    );
    expect(couchdb.put).toHaveBeenCalledWith(
      `/app/ReportConfig:${exportReport.title.replace(' ', '')}`,
      exportReport,
    );
    expect(couchdb.put).toHaveBeenCalledWith('/app/Config:CONFIG_ENTITY', {
      data: {
        'view:reportRoute': {
          component: 'Reporting',
        },
        'view:otherRoute': {
          component: 'OtherComp',
          config: { some: 'config' },
        },
      },
    });
  });

  it('should return if no report component was found', async () => {
    jest.spyOn(couchdb, 'get').mockResolvedValue({
      data: { 'view:noReport': { component: 'OtherComp' } },
    });
    jest.spyOn(couchdb, 'put');

    await controller.migrateReportsToEntities();

    expect(couchdb.put).not.toHaveBeenCalled();
  });

  it('should update entity IDs with built-in references', async () => {
    const aser = {
      _id: 'Aser:1',
      _rev: '1-somerev',
      childId: ['1234'],
      date: '2022-02-03',
    };

    jest
      .spyOn(couchdb, 'getAll')
      .mockResolvedValue([JSON.parse(JSON.stringify(aser))]);
    jest.spyOn(couchdb, 'putAll').mockResolvedValue(undefined);

    await controller.migrateEntityIds();

    expect(couchdb.getAll).toHaveBeenCalledWith('Aser');
    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...aser,
        childId: ['Child:1234'],
      },
    ]);
  });
});
