import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbAdminController } from './couchdb-admin.controller';

describe('CouchdbAdminController', () => {
  let controller: CouchdbAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouchdbAdminController],
    }).compile();

    controller = module.get<CouchdbAdminController>(CouchdbAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
