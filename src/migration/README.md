# Migration System

The migration system allows running one-off or recurring data transformations
against all (or selected) CouchDB instances via the CLI.

## Running migrations

```bash
# List available migrations
npm run cli -- migrate list

# Preview what would change (no writes)
npm run cli -- migrate run latest-config-formats --dry-run

# Run against all orgs (prompts for confirmation)
npm run cli -- migrate run latest-config-formats

# Run without confirmation prompt (CI / automation)
npm run cli -- migrate run latest-config-formats --yes

# Target specific orgs by name or URL (comma-separated)
npm run cli -- migrate run latest-config-formats --org my-org,other-org

# Show per-document details
npm run cli -- migrate run latest-config-formats --verbose
```

Or use the convenience script for the most common migration:

```bash
npm run migrate:latest-config-formats
```

## Adding a new migration

### 1. Implement `MigrationDefinition`

Create a new file (e.g. `src/migration/config-migration/my-migration.ts`) and
export a `MigrationDefinition` object:

```typescript
import { MigrationDefinition, MigrationResult } from '../migration-definition';

export const myMigration: MigrationDefinition = {
  id: 'oneoff-20260512-my-migration', // see naming conventions below
  description: 'Short human-readable description shown in "migrate list".',

  async run(ctx): Promise<MigrationResult> {
    // Read via ctx.couchdb (raw accessor — safe for reads)
    let doc: any;
    try {
      doc = await ctx.couchdb.get('/app/SomeDocument');
    } catch {
      return {
        changed: false,
        status: 'no-change',
        warnings: ['Document not found — skipping'],
      };
    }

    const newDoc = transformDocument(doc);

    ctx.validateJson(newDoc); // throws if value is not JSON-serializable

    const changed = JSON.stringify(doc) !== JSON.stringify(newDoc);
    if (!changed) {
      return {
        changed: false,
        status: 'no-change',
      };
    }

    // Write via ctx.write (respects dry-run, tracks stats, validates JSON)
    await ctx.put('/app/SomeDocument', newDoc);

    return {
      changed: true,
      status: ctx.dryRun ? 'dry-run' : 'ok',
    };
  },
};
```

### 2. Register in `migrations.ts`

Add the migration to the array in [`migrations.ts`](./migrations.ts):

```typescript
import { myMigration } from './config-migration/my-migration';

export const migrations: MigrationDefinition[] = [
  latestConfigFormats,
  myMigration, // ← add here
];
```

The CLI picks it up automatically.

### 3. Add seed data to the idempotency spec

Open [`testing/migration-idempotency.harness.spec.ts`](./testing/migration-idempotency.harness.spec.ts)
and add a case to `seedForMigration`:

```typescript
if (id === 'oneoff-20260512-my-migration') {
  return {
    'app/SomeDocument': { _id: 'SomeDocument', someField: 'old-value' },
  };
}
```

The harness runs every registered migration twice and asserts that the second run
reports `changed: false` — no extra test code needed beyond the seed data.

---

## Rules for migration implementations

### Idempotency (required)

Every migration **must** be idempotent: running it a second time against an
already-migrated state must produce `changed: false` and perform no writes.
This is enforced automatically by the shared test harness.

### Only write via `ctx.write`

Use `ctx.put(...)` — **not** `ctx.couchdb.put(...)` directly.
`ctx.put` validates JSON, enforces dry-run mode, and tracks write statistics
shown in the CLI summary.

### Only read via `ctx.couchdb`

`ctx.couchdb.get`, `.getAll`, `.find`, and `.post` (for CouchDB queries) are
safe for reads. The dry-run guard does not intercept reads.

### Validate the output

Call `ctx.validateJson(value)` on any document before writing it. This catches
non-serializable values (circular references, `BigInt`, `undefined` in objects)
before they reach CouchDB.

### Handle missing documents gracefully

Return `status: 'no-change'` with a `warnings` entry instead of throwing when
an expected document is absent. The CLI reports warnings without failing the run.

---

## Naming conventions

| Type                       | Format                   | Example                          |
| -------------------------- | ------------------------ | -------------------------------- |
| Recurring / safe to re-run | `<slug>`                 | `latest-config-formats`          |
| One-off                    | `oneoff-YYYYMMDD-<slug>` | `oneoff-20260512-fix-entity-ids` |

One-off migrations can be removed from the registry once confirmed applied to
all instances.

---

## Module structure

```
src/migration/
├── README.md                          ← you are here
├── migration-definition.ts            ← MigrationContext / MigrationResult / MigrationDefinition interfaces
├── tracked-migration-context.ts       ← builds MigrationContext for CLI and tests
├── migrations.ts                      ← registry of all MigrationDefinitions
├── config-migration/
│   ├── ndb-core-config-migrations.ts      ← ndb-core config migrations (update here when ndb-core exports clean version)
│   └── migrate-add-entity-attributes.ts
└── testing/
    ├── migration-idempotency.harness.ts       ← in-memory CouchDB stub + runIdempotencyCheck()
    └── migration-idempotency.harness.spec.ts  ← runs all registered migrations through idempotency check
```
