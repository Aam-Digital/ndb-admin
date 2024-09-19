import { Test, TestingModule } from '@nestjs/testing';
import { SearchAndReplaceService } from './search-and-replace.service';

describe('SearchAndReplaceService', () => {
  let service: SearchAndReplaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchAndReplaceService],
    }).compile();

    service = module.get<SearchAndReplaceService>(SearchAndReplaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
