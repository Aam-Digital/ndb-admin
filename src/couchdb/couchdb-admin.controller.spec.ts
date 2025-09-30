import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbAdminController } from './couchdb-admin.controller';
import { CouchdbService } from './couchdb.service';
import { SearchAndReplaceService } from './search-and-replace/search-and-replace.service';
import { CredentialsService } from '../credentials/credentials.service';
import { StatisticsService } from './statistics/statistics.service';
import { SystemStatistics } from './statistics/system-statistics';

describe('CouchdbAdminController', () => {
  let controller: CouchdbAdminController;
  let statisticsService: StatisticsService;

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
    const mockStatisticsService = {
      getStatistics: jest.fn().mockResolvedValue(mockStatisticsData),
    };

    const mockCouchdbService = {
      runForAllOrgs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouchdbAdminController],
      providers: [
        { provide: StatisticsService, useValue: mockStatisticsService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: SearchAndReplaceService, useValue: {} },
        { provide: CredentialsService, useValue: { getCredentials: () => [] } },
      ],
    }).compile();

    controller = module.get<CouchdbAdminController>(CouchdbAdminController);
    statisticsService = module.get<StatisticsService>(StatisticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatistics', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
        json: jest.fn(),
      };
    });

    it('should return statistics in JSON format by default', async () => {
      const result = await controller.getStatistics(mockResponse);

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(mockStatisticsData);
    });

    it('should return statistics in JSON format when format=json', async () => {
      const result = await controller.getStatistics(mockResponse, 'json');

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(mockStatisticsData);
    });

    it('should return statistics in CSV format when format=csv', async () => {
      await controller.getStatistics(mockResponse, 'csv');

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="statistics.csv"',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('name,users,childrenTotal,childrenActive'),
      );
    });

    it('should throw BadRequestException for invalid format', async () => {
      await expect(controller.getStatistics(undefined, 'xml')).rejects.toThrow(
        'Invalid format. Use "json" or "csv".',
      );
    });
  });
});
