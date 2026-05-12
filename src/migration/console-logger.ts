import { MigrationLogger } from './migration-definition';

/**
 * Console-backed MigrationLogger.
 * verbose() messages are suppressed unless verboseEnabled is true.
 */
export class ConsoleLogger implements MigrationLogger {
  constructor(private verboseEnabled: boolean) {}

  info(msg: string): void {
    console.log(`    ${msg}`);
  }

  warn(msg: string): void {
    console.warn(`    ! ${msg}`);
  }

  error(msg: string): void {
    console.error(`    ✗ ${msg}`);
  }

  verbose(msg: string): void {
    if (this.verboseEnabled) console.log(`    ${msg}`);
  }
}
