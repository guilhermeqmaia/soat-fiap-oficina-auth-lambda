---
name: api-test
description: Creates unit and integration tests for a module. Use after implementing a feature or when you need to increase coverage. Focuses on critical domains with a target of 80%.
argument-hint: "[module]"
---

# Module Tests

Create tests for the **$ARGUMENTS** module.

## Step 1 — Analyze what to test

Read the module files in `src/$ARGUMENTS/` and identify:

1. **Domain** — entities, value objects, business rules
2. **Application** — services, use cases, flows
3. **Infrastructure** — controllers (e2e), DTOs (validation)

## Step 2 — Unit Tests (Domain + Application)

Create in `src/$ARGUMENTS/**/*.spec.ts`:

### Value Objects
```typescript
describe('CpfCnpj', () => {
  it('should accept a valid CPF', () => { ... });
  it('should reject an invalid CPF', () => { ... });
  it('should accept a valid CNPJ', () => { ... });
});
```

### Entities
- Creation with valid data
- Creation with invalid data (should throw error)
- Valid and invalid state transitions

### Services
- Mock repositories (domain interface)
- Test success flows
- Test error cases (not found, invalid state, duplicate)

## Step 3 — Integration Tests (if applicable)

For critical flows (OS, inventory), create e2e tests:
- Use `@nestjs/testing` with `Test.createTestingModule`
- Test the full flow via HTTP (supertest)
- Validate responses, status codes, and side effects

## Step 4 — Run

```bash
# Run module tests
npx jest --testPathPattern=$ARGUMENTS --verbose

# Check coverage
npx jest --testPathPattern=$ARGUMENTS --coverage
```

## Step 5 — Report

Present:
- How many tests were created (unit vs integration)
- Coverage achieved (target: 80% on critical domains)
- Remaining coverage gaps
