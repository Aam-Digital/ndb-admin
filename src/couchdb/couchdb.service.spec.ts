import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbService } from './couchdb.service';

describe('CouchdbService', () => {
  let service: CouchdbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CouchdbService],
    }).compile();

    service = module.get<CouchdbService>(CouchdbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
