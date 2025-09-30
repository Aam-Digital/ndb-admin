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
      };
    });

    it('should return statistics in JSON format by default', async () => {
      const result = await controller.getStatistics();

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStatisticsData);
    });

    it('should return statistics in JSON format when format=json', async () => {
      const result = await controller.getStatistics('json');

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStatisticsData);
    });

    it('should return statistics in CSV format when format=csv', async () => {
      await controller.getStatistics('csv', undefined, mockResponse);

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('name,users,childrenTotal,childrenActive'),
      );
    });

    it('should return CSV format when Accept header is text/csv', async () => {
      const mockRequest = {
        headers: { accept: 'text/csv' },
      } as any;

      await controller.getStatistics(undefined, mockRequest, mockResponse);

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('name,users,childrenTotal,childrenActive'),
      );
    });

    it('should return JSON format when Accept header is application/json', async () => {
      const mockRequest = {
        headers: { accept: 'application/json' },
      } as any;

      const result = await controller.getStatistics(
        undefined,
        mockRequest,
        mockResponse,
      );

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStatisticsData);
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should prioritize query parameter over Accept header', async () => {
      const mockRequest = {
        headers: { accept: 'text/csv' },
      } as any;

      const result = await controller.getStatistics(
        'json',
        mockRequest,
        mockResponse,
      );

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStatisticsData);
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should handle complex Accept header with multiple values', async () => {
      const mockRequest = {
        headers: { accept: 'text/html,application/xhtml+xml,text/csv,*/*' },
      } as any;

      await controller.getStatistics(undefined, mockRequest, mockResponse);

      expect(statisticsService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('name,users,childrenTotal,childrenActive'),
      );
    });

    it('should throw BadRequestException for invalid format', async () => {
      await expect(controller.getStatistics('xml')).rejects.toThrow(
        'Invalid format. Use "json" or "csv".',
      );
    });
  });
});
