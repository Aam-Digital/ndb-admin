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
      post: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get statistics from all organizations', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];
    const mockUsers = Array(10)
      .fill({})
      .map((_, i) => ({ id: `user${i}` }));
    const mockChildren = Array(50)
      .fill({})
      .map((_, i) => ({ id: `child${i}` }));
    const mockActiveChildren = Array(45)
      .fill({})
      .map((_, i) => ({ id: `active${i}` }));

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockResolvedValue(
      mockUsers as any,
    );
    mockCouchdbInstance.get.mockResolvedValue(mockChildren);
    mockCouchdbInstance.post.mockResolvedValue(mockActiveChildren);

    const result = await service.getStatistics();

    expect(mockKeycloakService.getKeycloakToken).toHaveBeenCalled();
    expect(mockCredentialsService.getCredentials).toHaveBeenCalled();
    expect(mockCouchdbService.getCouchdb).toHaveBeenCalledWith(
      'org1.example.com',
      'password1',
    );
    expect(mockKeycloakService.getUsersFromKeycloak).toHaveBeenCalledWith(
      'org1',
      mockToken,
    );
    expect(mockCouchdbInstance.get).toHaveBeenCalledWith(
      '/app/_all_docs?startkey="Child:"&endkey="Child:\uffff"',
    );
    expect(mockCouchdbInstance.post).toHaveBeenCalledWith(
      '/app/_find',
      expect.any(Object),
    );
    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 10,
        childrenTotal: 50,
        childrenActive: 45,
      },
    ]);
  });

  it('should handle keycloak failure and fallback to couchdb users', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];
    const mockUsersFromCouchdb = Array(8)
      .fill({})
      .map((_, i) => ({ id: `couchuser${i}` }));
    const mockChildren = Array(30)
      .fill({})
      .map((_, i) => ({ id: `child${i}` }));
    const mockActiveChildren = Array(25)
      .fill({})
      .map((_, i) => ({ id: `active${i}` }));

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockKeycloakService.getUsersFromKeycloak.mockRejectedValue(
      new Error('Keycloak error'),
    );
    mockCouchdbInstance.get
      .mockResolvedValueOnce(mockUsersFromCouchdb) // First call for users fallback
      .mockResolvedValueOnce(mockChildren); // Second call for children
    mockCouchdbInstance.post.mockResolvedValue(mockActiveChildren);

    const result = await service.getStatistics();

    expect(mockKeycloakService.getUsersFromKeycloak).toHaveBeenCalledWith(
      'org1',
      mockToken,
    );
    expect(mockCouchdbInstance.get).toHaveBeenCalledWith(
      '/_users/_all_docs?startkey="org.couchdb.user:"&endkey="org.couchdb.user:\uffff"',
    );
    expect(result).toEqual([
      {
        name: 'org1.example.com',
        users: 8,
        childrenTotal: 30,
        childrenActive: 25,
      },
    ]);
  });
});
