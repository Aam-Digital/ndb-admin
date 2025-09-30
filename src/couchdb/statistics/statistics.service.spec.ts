import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from './statistics.service';
import { CouchdbService } from '../couchdb.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import {
  CredentialsService,
  SystemCredentials,
} from '../../credentials/credentials.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let mockCouchdbService: jest.Mocked<CouchdbService>;
  let mockKeycloakService: jest.Mocked<KeycloakService>;
  let mockCredentialsService: jest.Mocked<CredentialsService>;

  beforeEach(async () => {
    const mockCouchdb = {
      runForAllOrgs: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get statistics from all organizations', async () => {
    const mockToken = 'mock-token';
    const mockCredentials: SystemCredentials[] = [
      { url: 'org1.example.com', password: 'password1' },
    ];
    const mockResults = {
      'org1.example.com': {
        name: 'org1.example.com',
        users: 10,
        childrenTotal: 50,
        childrenActive: 45,
      },
    };

    mockKeycloakService.getKeycloakToken.mockResolvedValue(mockToken);
    mockCredentialsService.getCredentials.mockReturnValue(mockCredentials);
    mockCouchdbService.runForAllOrgs.mockResolvedValue(mockResults);

    const result = await service.getStatistics();

    expect(mockKeycloakService.getKeycloakToken).toHaveBeenCalled();
    expect(mockCredentialsService.getCredentials).toHaveBeenCalled();
    expect(mockCouchdbService.runForAllOrgs).toHaveBeenCalledWith(
      mockCredentials,
      expect.any(Function),
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
});
