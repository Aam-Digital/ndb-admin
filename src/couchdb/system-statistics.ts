import { ApiProperty } from '@nestjs/swagger';

export class SystemStatistics {
  @ApiProperty()
  name: string;

  @ApiProperty()
  childrenTotal: number;

  @ApiProperty()
  childrenActive: number;

  @ApiProperty({ description: 'Number of active keycloak user accounts' })
  users: number;
}
