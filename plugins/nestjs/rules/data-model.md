---
paths:
  - "prisma/**"
  - "**/migrations/**"
  - "**/*.repository.ts"
  - "DATA_MODEL.md"
---

# Data model conventions

- **Tenant/ownership column on every domain row** (`<tenant>_id`) so one authorization rule applies everywhere.
- **Money:** `numeric(18,2)` (or integer minor units) plus a currency column — never `float`.
- **Timestamps:** `timestamptz`, stored in UTC; `created_at`, `updated_at`, `deleted_at`.
- **Soft delete** via `deleted_at` on every mutable table; queries exclude deleted rows by default.
- **Naming:** snake_case columns, plural table names, `id uuid default gen_random_uuid()`, foreign keys `<singular>_id`, booleans `is_` / `has_`.
- **Schema changes only through migrations** checked into git and reviewed in the PR. Never edit the database directly in a dashboard.
- **Protected paths:** the schema file and migrations are edited only by the migration agent/workflow. — **Enforcement:** PreToolUse path guard with a sentinel flag.
- **Versioned/append-only records** (ledgers, audit) document their "current version" query pattern in DATA_MODEL.md, and every list/aggregate query applies it.
