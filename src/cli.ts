import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';
import * as readline from 'readline';
import { AppModule } from './app.module';
import { OrgRunner } from './cli/org-runner';
import { printConnectivity } from './cli/org-output';
import { CouchdbService } from './couchdb/couchdb.service';
import {
  CredentialsService,
  SystemCredentials,
} from './credentials/credentials.service';
import { ConsoleLogger } from './migration/console-logger';
import { TrackedMigrationContext } from './migration/tracked-migration-context';
import { failedMigrationResult } from './migration/migration-definition';
import {
  computeExitCode,
  printBanner,
  printOutcomes,
  printSummary,
} from './migration/migration-output';
import { migrations } from './migration/migrations';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json');

// ─── CLI program ────────────────────────────────────────────────────────────

const program = new Command();
program.name('ndb-admin').description('Aam Digital admin CLI').version(version);

const migrateCmd = program
  .command('migrate')
  .description('Run database migrations');

migrateCmd
  .command('list')
  .description('List all available migrations')
  .action(() => {
    console.log('\nAvailable migrations:\n');
    for (const m of migrations) {
      console.log(`  ${m.id.padEnd(36)}  ${m.description}`);
    }
    console.log();
  });

program
  .command('check')
  .description('Check connectivity to all (or selected) orgs')
  .option('--org <orgs>', 'Comma-separated org names or URLs to target')
  .option('--category <category>', 'Filter orgs by credential category')
  .action((options) =>
    withApp(async ({ credentialsService, couchdbService }) => {
      const orgs = resolveOrgs(credentialsService, options);
      if (!orgs) return 2;
      const runner = new OrgRunner(couchdbService);

      const results = await runner.checkConnectivity(orgs);
      printConnectivity(results);

      return results.some((r) => !r.reachable) ? 1 : 0;
    }),
  );

migrateCmd
  .command('run <id>')
  .description('Run a migration (preview first, then confirm)')
  .option('--org <orgs>', 'Comma-separated org names or URLs to target')
  .option('--category <category>', 'Filter orgs by credential category')
  .option('--dry-run', 'Preview changes and exit without writing')
  .option('--yes', 'Skip confirmation prompt (for automation)')
  .option('--verbose', 'Show detailed per-document output')
  .action((id: string, options) =>
    withApp(async ({ credentialsService, couchdbService }) => {
      const migration = migrations.find((m) => m.id === id);
      if (!migration) {
        console.error(`\nUnknown migration id: "${id}"`);
        console.error(`Run "migrate list" to see available migrations.\n`);
        return 2;
      }

      const orgs = resolveOrgs(credentialsService, options);
      if (!orgs) return 2;
      const runner = new OrgRunner(couchdbService);
      const logger = new ConsoleLogger(!!options.verbose);

      // Connectivity preflight
      const connectivity = await runner.checkConnectivity(orgs);
      printConnectivity(connectivity);

      const reachable = connectivity
        .filter((r) => r.reachable)
        .map((r) => r.org);
      const unreachableCount = connectivity.filter((r) => !r.reachable).length;

      if (reachable.length === 0) {
        console.error('\nNo reachable orgs — nothing to do.\n');
        return 1;
      }

      const runMigration = (dryRun: boolean) =>
        runner.runForEach(reachable, async (couchdb, org) => {
          const ctx = new TrackedMigrationContext(couchdb, org, dryRun, logger);
          try {
            const result = await migration.run(ctx);
            return { result, writeStats: ctx.getWriteStats() };
          } catch (e: any) {
            return {
              result: failedMigrationResult(e.message),
              writeStats: ctx.getWriteStats(),
            };
          }
        });

      // Preview (always dry-run first)
      printBanner('PREVIEW', migration);
      const preview = await runMigration(true);
      printOutcomes(preview, false);
      printSummary(preview, unreachableCount);

      if (options.dryRun) {
        console.log('\n(--dry-run) No writes performed.\n');
        return computeExitCode(preview, unreachableCount);
      }

      const wouldChange = preview.filter((o) => o.result.result.changed).length;
      if (wouldChange === 0) {
        console.log('\nNo changes needed — nothing to write.\n');
        return 0;
      }

      if (!options.yes) {
        const confirmed = await askConfirmation(
          `\nApply ${wouldChange} change(s) to ${reachable.length} org(s)? [y/N]`,
        );
        if (!confirmed) {
          console.log('\nAborted.\n');
          return 2;
        }
      }

      // Real run
      printBanner('RUNNING', migration);
      const real = await runMigration(false);
      printOutcomes(real, true);
      printSummary(real, unreachableCount);

      return computeExitCode(real, unreachableCount);
    }),
  );

program.parse(process.argv);

// ─── App bootstrap ──────────────────────────────────────────────────────────

interface AppServices {
  credentialsService: CredentialsService;
  couchdbService: CouchdbService;
}

async function withApp(
  callback: (services: AppServices) => Promise<number>,
): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const code = await callback({
      credentialsService: app.get(CredentialsService),
      couchdbService: app.get(CouchdbService),
    });
    await app.close();
    process.exit(code);
  } catch (e) {
    await app.close();
    throw e;
  }
}

// ─── Org resolution ─────────────────────────────────────────────────────────

function resolveOrgs(
  credentialsService: CredentialsService,
  options: { org?: string; category?: string },
): SystemCredentials[] | null {
  const orgs = OrgRunner.filterOrgs(
    credentialsService.getCredentials(),
    options,
  );
  if (orgs.length === 0) {
    const filter = options.org
      ? `--org "${options.org}"`
      : `--category "${options.category}"`;
    console.error(`\nNo orgs matched ${filter}.\n`);
    return null;
  }
  return orgs;
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question + ' ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
