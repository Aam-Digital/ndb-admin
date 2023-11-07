import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakMigrationController } from './keycloak-migration.controller';

describe('KeycloakMigrationController', () => {
  let controller: KeycloakMigrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeycloakMigrationController],
    }).compile();

    controller = module.get<KeycloakMigrationController>(KeycloakMigrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
