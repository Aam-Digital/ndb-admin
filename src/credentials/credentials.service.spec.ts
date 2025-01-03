import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsService } from './credentials.service';
import { ConfigService } from '@nestjs/config';

describe('CredentialsService', () => {
  let service: CredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CredentialsService, ConfigService],
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
