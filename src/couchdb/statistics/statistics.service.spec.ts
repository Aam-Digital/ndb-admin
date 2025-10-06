import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from './statistics.service';
import { Couchdb, CouchdbService } from '../couchdb.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import {
  CredentialsService,
  SystemCredentials,
} from '../../credentials/credentials.service';
import { HttpService } from '@nestjs/axios';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let mockCouchdbService: jest.Mocked<CouchdbService>;
  let mockKeycloakService: jest.Mocked<KeycloakService>;
  let mockCredentialsService: jest.Mocked<CredentialsService>;
  let mockCouchdbInstance: jest.Mocked<Couchdb>;

  beforeEach(async () => {
    // Create a mock Couchdb instance
    mockCouchdbInstance = {
      url: 'org1.example.com',
      get: jest.fn(),
      put: jest.fn(),
    } as any;

    const mockCouchdb = {
      getCouchdb: jest.fn().mockReturnValue(mockCouchdbInstance),
      runForAllOrgs: jest.fn(), // We'll replace this with the real implementation
    };

    const mockKeycloak = {
      getKeycloakToken: jest.fn(),
      getUsersFromKeycloak: jest.fn(),
    };

    const mockCredentials = {
      getCredentials: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: CouchdbService, useValue: mockCouchdb },
        { provide: KeycloakService, useValue: mockKeycloak },
        { provide: CredentialsService, useValue: mockCredentials },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    mockCouchdbService = module.get(CouchdbService);
    mockKeycloakService = module.get(KeycloakService);
    mockCredentialsService = module.get(CredentialsService);

    // Create real CouchdbService instance to get the real runForAllOrgs implementation
    // but bind it to our mocked service so it uses our mocked getCouchdb method
    const realCouchdbService = new CouchdbService({} as HttpService);
    mockCouchdbService.runForAllOrgs =
      realCouchdbService.runForAllOrgs.bind(mockCouchdbService);

    // Mock the createOrUpdateStatisticsView method to avoid the undefined error
    jest
      .spyOn(service as any, 'createOrUpdateStatisticsView')
      .mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get statistics from all organizations using CouchDB views', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1', username: 'aam-admin' },
    ];
    const mockUsers = Array(10)
      .fill({})
      .map((_, i) => ({ id: `user${i}` }));

    // Mock CouchDB view responses
    const mockStatsAll = [
      { key: 'Child', value: 50 },
      { key: 'User', value: 10 },
      { key: 'School', value: 5 },
    ];

    const mockStatsActive = [
      { key: 'Child', value: 45 },
      { key: 'User', value: 8 },
      { key: 'School', value: 5 },
    ];

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockResolvedValue(
      mockUsers as any,
    );

    // Mock the CouchDB get calls for the statistics views
    mockCouchdbInstance.get
      .mockResolvedValueOnce(mockStatsAll) // entities_all view
      .mockResolvedValueOnce(mockStatsActive); // entities_active view

    const result = await service.getStatistics();

    // Verify the sequence of operations
    expect(mockKeycloakService.getKeycloakToken).toHaveBeenCalled();
    expect(mockCredentialsService.getCredentials).toHaveBeenCalled();
    expect(mockCouchdbService.getCouchdb).toHaveBeenCalledWith(
      'org1.example.com',
      'password1',
      'aam-admin',
    );
    expect(mockKeycloakService.getUsersFromKeycloak).toHaveBeenCalledWith(
      'org1',
      mockToken,
    );

    // Verify view queries
    expect(mockCouchdbInstance.get).toHaveBeenCalledWith(
      '_design/statistics/_view/entities_all?group=true',
      'app',
    );
    expect(mockCouchdbInstance.get).toHaveBeenCalledWith(
      '_design/statistics/_view/entities_active?group=true',
      'app',
    );

    // Verify result structure
    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 10,
        entities: {
          Child: { all: 50, active: 45 },
          User: { all: 10, active: 8 },
          School: { all: 5, active: 5 },
        },
      },
    ]);
  });

  it('should handle keycloak failure and fallback to empty users array', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];

    const mockStatsAll = [
      { key: 'Child', value: 30 },
      { key: 'User', value: 5 },
    ];

    const mockStatsActive = [
      { key: 'Child', value: 25 },
      { key: 'User', value: 3 },
    ];

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockRejectedValue(
      new Error('Keycloak error'),
    );

    mockCouchdbInstance.get
      .mockResolvedValueOnce(mockStatsAll)
      .mockResolvedValueOnce(mockStatsActive);

    const result = await service.getStatistics();

    expect(mockKeycloakService.getUsersFromKeycloak).toHaveBeenCalledWith(
      'org1',
      mockToken,
    );

    // When Keycloak fails, should use empty users array (length 0)
    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 0,
        entities: {
          Child: { all: 30, active: 25 },
          User: { all: 5, active: 3 },
        },
      },
    ]);
  });

  it('should handle CouchDB view failures gracefully', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];
    const mockUsers = Array(5)
      .fill({})
      .map((_, i) => ({ id: `user${i}` }));

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockResolvedValue(
      mockUsers as any,
    );

    // Mock CouchDB view failures
    mockCouchdbInstance.get
      .mockRejectedValueOnce(new Error('View error')) // entities_all view fails
      .mockRejectedValueOnce(new Error('View error')); // entities_active view fails

    const result = await service.getStatistics();

    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 5,
        entities: {}, // Empty entities when both views fail
      },
    ]);
  });

  it('should handle partial view data correctly', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];
    const mockUsers = Array(3)
      .fill({})
      .map((_, i) => ({ id: `user${i}` }));

    // Mock data where active has entities not in all (edge case)
    const mockStatsAll = [{ key: 'Child', value: 20 }];

    const mockStatsActive = [
      { key: 'Child', value: 18 },
      { key: 'Note', value: 5 }, // Note exists in active but not in all
    ];

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockResolvedValue(
      mockUsers as any,
    );

    mockCouchdbInstance.get
      .mockResolvedValueOnce(mockStatsAll)
      .mockResolvedValueOnce(mockStatsActive);

    const result = await service.getStatistics();

    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 3,
        entities: {
          Child: { all: 20, active: 18 },
          Note: { all: 0, active: 5 }, // Handles entity in active but not in all
        },
      },
    ]);
  });
});
