import { Test, TestingModule } from '@nestjs/testing';
import { ConfigMigrationService } from './config-migration.service';

describe('ConfigMigrationService', () => {
  let service: ConfigMigrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigMigrationService],
    }).compile();

    service = module.get<ConfigMigrationService>(ConfigMigrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
