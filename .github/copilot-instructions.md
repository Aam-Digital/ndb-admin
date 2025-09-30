# GitHub Copilot Instructions for ndb-admin

## Project Overview

This is a NestJS-based admin utility service for managing multiple hosted Aam Digital instances. It provides REST API endpoints for bulk operations across CouchDB databases and Keycloak authentication systems.

## Technology Stack

- **Framework**: NestJS (Node.js/TypeScript)
- **Language**: TypeScript
- **Testing**: Jest
- **Linting**: ESLint with TypeScript
- **Formatting**: Prettier
- **Documentation**: Swagger/OpenAPI (generated using NestJS annotations)
- **Databases**: CouchDB (external)
- **Authentication**: Keycloak (external)
- **Monitoring**: Sentry

## Code Style and Conventions

### TypeScript

- Use strict type checking (already configured)
- Prefer type inference when obvious
- Avoid `any` type - use `unknown` when type is uncertain
- Implement proper error handling with typed exceptions

### NestJS

- Follow NestJS module/controller/service architecture patterns
- Use dependency injection via NestJS decorators (`@Injectable()`, `@Controller()`)
- Controllers should be thin, delegate business logic to services
- Use DTOs for request/response validation with class-validator decorators
- Keep services small and focused on a single responsibility

### Naming Conventions

- Controllers: `*.controller.ts` (e.g., `couchdb-admin.controller.ts`)
- Services: `*.service.ts` (e.g., `couchdb.service.ts`)
- Test files: `*.spec.ts` placed alongside the source files
- DTOs: `*.dto.ts` for data transfer objects
- Use kebab-case for file names
- Use PascalCase for class names
- Use camelCase for method and variable names

### API Documentation

- All controllers must have Swagger/OpenAPI annotations
- Use `@ApiOperation()` to describe endpoints
- Use `@ApiQuery()` for query parameters
- Use `@ApiOkResponse()` for response schemas
- Use `@ApiProperty()` in DTOs and response models

### Error Handling

- Sentry is configured for error monitoring
- HTTP 4xx errors are filtered out from Sentry (see `sentry-configuration.ts`)
- Use NestJS built-in exceptions (HttpException, BadRequestException, etc.)

## Testing Guidelines

### Unit Tests

- Place test files next to source files with `.spec.ts` extension
- Use Jest as the testing framework
- Mock external dependencies (HttpService, ConfigService)
- Follow the existing test patterns in the codebase
- Test files should have at least basic "should be defined" tests
- Run tests with `npm test`

### Test Structure

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyName, useValue: mockDependency },
      ],
    }).compile();
    
    service = module.get<ServiceName>(ServiceName);
  });
  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Build and Development Commands

- `npm run build` - Build the project
- `npm run lint` - Run ESLint with auto-fix
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run start:dev` - Start development server with watch mode
- `npm run format` - Format code with Prettier

## Architecture Guidelines

### Module Organization

- Each feature should have its own module directory
- Modules: `couchdb`, `keycloak`, `migration`, `credentials`
- Keep related controllers, services, DTOs, and tests together

### Service Patterns

- `CouchdbService`: Manages connections to multiple CouchDB instances
- `KeycloakService`: Handles Keycloak admin operations
- `CredentialsService`: Loads system credentials from `credentials.json`
- Services should use `runForAllOrgs()` pattern for bulk operations across instances

### Configuration

- Environment variables via NestJS ConfigModule
- Configuration loaded from `.env` file and environment
- Credentials stored in `src/assets/credentials.json`
- Default domain configured via `DOMAIN` environment variable

## Security Considerations

- No authentication on endpoints - deploy with external security measures
- Should be accessed via SSH tunnel or behind proxy
- Credentials in `credentials.json` should not be committed with real values
- Set `NODE_TLS_REJECT_UNAUTHORIZED=0` only in local dev, never in production

## Important Files

- `src/main.ts` - Application entry point, Swagger setup
- `src/app.module.ts` - Root module with all imports
- `src/couchdb/couchdb-admin.controller.ts` - Main CouchDB admin endpoints
- `src/keycloak/keycloak-migration.controller.ts` - Keycloak operations
- `src/migration/migration.controller.ts` - Data migration endpoints
- `src/sentry-configuration.ts` - Sentry error monitoring setup
- `src/credentials/credentials.service.ts` - Credentials management

## Best Practices

1. **Minimal Changes**: Make surgical, focused changes to existing code
2. **Test Coverage**: Add/update tests for any code changes
3. **Documentation**: Update Swagger annotations when modifying endpoints
4. **Type Safety**: Leverage TypeScript's type system, avoid `any` where possible
5. **Async/Await**: Use async/await for asynchronous operations
6. **Error Handling**: Properly handle and log errors, let Sentry capture exceptions
7. **Dependency Injection**: Use NestJS DI container, don't instantiate services directly
8. **API Design**: Follow REST conventions for endpoint naming and HTTP methods

## Common Patterns

### Bulk Operations Across Instances

```typescript
async bulkOperation() {
  return this.couchdbService.runForAllOrgs(
    this.credentialsService.getCredentials(),
    async (couchdb: Couchdb) => {
      // Operation logic here
    }
  );
}
```

### CouchDB Queries

```typescript
// Get all documents by type prefix
const docs = await couchdb.getAll('EntityType');

// Get single document
const doc = await couchdb.get('/db-name/_design/doc-id');

// Update documents
await couchdb.putAll(updatedDocs);
```

## Deployment

- Docker image built from `build/Dockerfile`
- Base image: `node:20-alpine`
- Exposed port: 3000
- Swagger UI available at `/api` endpoint
- Can be deployed with path prefix `/admin` via reverse proxy
