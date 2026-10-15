# Data Model

> **Architecture context.** Schema managed by **<ORM + version>** on **<database>**. Business logic and authorization live in the API (services + guards); <row-level security, if used, is defense in depth>.

<!-- guide: conventions come from the golden nestjs data-model rule; this file holds THIS schema. Every table lists its columns, constraints and the rules queries must apply. -->

Designed so:
- <Every domain row carries `<tenant>_id` → one authorization rule everywhere.>
- <Money / timestamps / soft-delete choices, linking the golden rule.>
- <Append-only or versioned tables and why.>

## Tables

### `<table>`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| <tenant>_id | uuid → <tenants> | |
| created_at / updated_at / deleted_at | timestamptz | |

**Query rules:** <e.g. the current-version predicate every list/aggregate must apply>.

## Row-level security

<Policy conventions, helper-function schema, what RLS protects that the API guard does not.>

## Derived / materialised views

<View, refresh trigger, consumers.>

## Migration strategy

<Tooling, review rule, who may edit the schema (path guard), seed data.>

## Not in this schema yet (intentional)

- <Item> → <destination>
