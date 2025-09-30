import { ApiProperty } from '@nestjs/swagger';

export class SystemStatistics {
  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Number of active keycloak user accounts' })
  users: number;

  @ApiProperty({ description: 'Count of entities grouped by type prefix' })
  entities: { [key: string]: { all: number; active: number } };
}
