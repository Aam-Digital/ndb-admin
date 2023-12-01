import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakMigrationController } from './keycloak-migration.controller';
import { KeycloakService } from './keycloak.service';
import { HttpService } from '@nestjs/axios';

describe('KeycloakMigrationController', () => {
  let controller: KeycloakMigrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeycloakMigrationController],
      providers: [
        { provide: KeycloakService, useValue: undefined },
        { provide: HttpService, useValue: undefined },
      ],
    }).compile();

    controller = module.get(KeycloakMigrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
