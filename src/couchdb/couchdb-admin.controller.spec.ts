import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbAdminController } from './couchdb-admin.controller';
import { KeycloakService } from '../keycloak/keycloak.service';
import { CouchdbService } from './couchdb.service';
import { SearchAndReplaceService } from './search-and-replace/search-and-replace.service';
import { CredentialsService } from '../credentials/credentials.service';
import { SystemStatistics } from './system-statistics';
import { Response } from 'express';

describe('CouchdbAdminController', () => {
  let controller: CouchdbAdminController;
  let couchdbService: CouchdbService;
  let keycloakService: KeycloakService;

  const mockStatisticsData: SystemStatistics[] = [
    {
      name: 'test1.example.com',
      users: 10,
      childrenTotal: 50,
      childrenActive: 45,
    },
    {
      name: 'test2.example.com',
      users: 5,
      childrenTotal: 30,
      childrenActive: 28,
    },
  ];

  beforeEach(async () => {
    const mockKeycloakService = {
      getKeycloakToken: jest.fn().mockResolvedValue('mock-token'),
      getUsersFromKeycloak: jest.fn().mockResolvedValue([]),
    };

    const mockCouchdbService = {
      runForAllOrgs: jest.fn().mockResolvedValue({
        'test1.example.com': mockStatisticsData[0],
        'test2.example.com': mockStatisticsData[1],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouchdbAdminController],
      providers: [
        { provide: KeycloakService, useValue: mockKeycloakService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: SearchAndReplaceService, useValue: undefined },
        { provide: CredentialsService, useValue: { getCredentials: () => [] } },
      ],
    }).compile();

    controller = module.get(CouchdbAdminController);
    couchdbService = module.get(CouchdbService);
    keycloakService = module.get(KeycloakService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatistics', () => {
    it('should return JSON format by default', async () => {
      const result = await controller.getStatistics();
      expect(result).toEqual(mockStatisticsData);
    });

    it('should return JSON format when format is not csv', async () => {
      const result = await controller.getStatistics('json');
      expect(result).toEqual(mockStatisticsData);
    });

    it('should return CSV format when format is csv', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.getStatistics('csv', mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="statistics.csv"');
      
      const expectedCsv = 'name,users,childrenTotal,childrenActive\n' +
                          'test1.example.com,10,50,45\n' +
                          'test2.example.com,5,30,28';
      expect(mockResponse.send).toHaveBeenCalledWith(expectedCsv);
    });
  });

  describe('convertToCSV', () => {
    it('should convert statistics array to CSV format', () => {
      const csvResult = (controller as any).convertToCSV(mockStatisticsData);
      
      const expectedCsv = 'name,users,childrenTotal,childrenActive\n' +
                          'test1.example.com,10,50,45\n' +
                          'test2.example.com,5,30,28';
      
      expect(csvResult).toBe(expectedCsv);
    });

    it('should return empty string for empty array', () => {
      const csvResult = (controller as any).convertToCSV([]);
      expect(csvResult).toBe('');
    });

    it('should handle values with commas by escaping them', () => {
      const dataWithCommas: SystemStatistics[] = [
        {
          name: 'test,server.com',
          users: 10,
          childrenTotal: 50,
          childrenActive: 45,
        },
      ];

      const csvResult = (controller as any).convertToCSV(dataWithCommas);
      
      const expectedCsv = 'name,users,childrenTotal,childrenActive\n' +
                          '"test,server.com",10,50,45';
      
      expect(csvResult).toBe(expectedCsv);
    });

    it('should handle values with quotes by escaping them', () => {
      const dataWithQuotes: SystemStatistics[] = [
        {
          name: 'test"server.com',
          users: 10,
          childrenTotal: 50,
          childrenActive: 45,
        },
      ];

      const csvResult = (controller as any).convertToCSV(dataWithQuotes);
      
      const expectedCsv = 'name,users,childrenTotal,childrenActive\n' +
                          '"test""server.com",10,50,45';
      
      expect(csvResult).toBe(expectedCsv);
    });

    it('should handle values with newlines by escaping them', () => {
      const dataWithNewlines: SystemStatistics[] = [
        {
          name: 'test\nserver.com',
          users: 10,
          childrenTotal: 50,
          childrenActive: 45,
        },
      ];

      const csvResult = (controller as any).convertToCSV(dataWithNewlines);
      
      const expectedCsv = 'name,users,childrenTotal,childrenActive\n' +
                          '"test\nserver.com",10,50,45';
      
      expect(csvResult).toBe(expectedCsv);
    });
  });
});
