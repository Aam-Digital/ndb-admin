import { Test, TestingModule } from '@nestjs/testing';
import { MigrationController } from './migration.controller';
import { CouchdbService } from './couchdb.service';
import { ConfigService } from '@nestjs/config';

describe('MigrationController', () => {
  let controller: MigrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationController],
      providers: [{ provide: CouchdbService, useValue: null }, ConfigService],
    }).compile();

    controller = module.get<MigrationController>(MigrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
