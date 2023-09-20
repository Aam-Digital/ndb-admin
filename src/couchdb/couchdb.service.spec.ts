import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbService } from './couchdb.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

describe('CouchdbService', () => {
  let service: CouchdbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouchdbService,
        ConfigService,
        { provide: HttpService, useValue: null },
      ],
    }).compile();

    service = module.get<CouchdbService>(CouchdbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
