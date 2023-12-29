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
      child: ['1234'],
      date: '2022-02-03',
    };
    mockDb([aser]);

    await controller.migrateEntityIds();

    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...aser,
        child: ['Child:1234'],
      },
    ]);
  });

  it('should not update entities that do not have references', async () => {
    const noteWithReference = {
      _id: 'Note:withRef',
      subject: 'Linked note',
      authors: ['Test'],
      children: ['1', '2'],
    };
    const noteWithoutReference = {
      _id: 'Note:withoutRef',
      subject: 'Unlinked note',
      date: '2023-12-12',
    };
    mockDb([noteWithoutReference, noteWithReference]);

    await controller.migrateEntityIds();

    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...noteWithReference,
        authors: ['User:Test'],
        children: ['Child:1', 'Child:2'],
      },
    ]);
  });

  it('should not update entities that only have full ids', async () => {
    const onlyFullRefs = {
      _id: 'ChildSchoolRelation:onlyFullRefs',
      start: '2024-01-01',
      end: '2024-12-31',
      childId: 'Child:1',
      schoolId: 'School:1',
    };
    const mixedRefs = {
      _id: 'ChildSchoolRelation:mixedRefs',
      start: '2025-01-01',
      childId: '1',
      schoolId: 'School:1',
    };
    mockDb([onlyFullRefs, mixedRefs]);

    await controller.migrateEntityIds();

    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...mixedRefs,
        childId: 'Child:1',
      },
    ]);
  });

  it('should not update properties that only have full ids', async () => {
    const todo = {
      _id: 'Todo:mixed',
      subject: 'Mixed IDs',
      startDate: '2024-01-01',
      relatedEntities: ['Child:1', 'School:2'],
      assignedTo: ['demo'],
    };
    mockDb([todo]);

    await controller.migrateEntityIds();

    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...todo,
        assignedTo: ['User:demo'],
      },
    ]);
  });

  it('should throw an error if a foreign ID was found', async () => {
    const historicalEntity = {
      _id: 'HistoricalEntityData:withForeignId',
      date: '2022-04-11',
      // Expects "Child" on default
      relatedEntity: 'School:1',
    };
    mockDb([historicalEntity]);

    return expect(controller.migrateEntityIds()).rejects.toBeTruthy();
  });

  it('should not update properties where multiple entity types are configured', async () => {
    const onlyMixedProp = {
      _id: 'EventNote:onlyMixedProp',
      authors: ['User:Test'],
      relatedEntities: ['ChildSchoolRelation:1', 'Child:2', 'School:3'],
    };
    const alsoOtherRefs = {
      _id: 'EventNote:alsoOtherRefs',
      authors: ['admin'],
      schools: ['1', '3'],
      relatedEntities: ['Child:4', 'School:3'],
    };
    mockDb([alsoOtherRefs, onlyMixedProp]);

    await controller.migrateEntityIds();

    expect(couchdb.putAll).toHaveBeenCalledWith([
      {
        ...alsoOtherRefs,
        authors: ['User:admin'],
        schools: ['School:1', 'School:3'],
      },
    ]);
  });
  it('should update the user ID in "created" and "updated"', async () => {});
  it('should should references which are defined through custom config', async () => {});

  function mockDb(docs: { _id: string }[]) {
    jest
      .spyOn(couchdb, 'getAll')
      .mockImplementation((prefix) =>
        Promise.resolve(
          docs
            .filter(({ _id }) => _id.startsWith(prefix))
            .map((doc) => JSON.parse(JSON.stringify(doc))),
        ),
      );
    jest.spyOn(couchdb, 'putAll').mockResolvedValue(undefined);
  }
});
