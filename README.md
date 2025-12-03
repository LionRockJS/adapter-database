# @lionrockjs/adapter-database-bun-postgresql

LionRockJS Database Adapter for Bun with PostgreSQL

## Requirements

- **Bun** >= 1.0.0
- **PostgreSQL** database server
- **@lionrockjs/central** >= 1.0.0

## Installation

```bash
bun add @lionrockjs/adapter-database-bun-postgresql
```

## Usage

### Quick Setup

```javascript
// In your application bootstrap
import '@lionrockjs/adapter-database-bun-postgresql/init.mjs';
```

This will set `ORMAdapterPostgreSQL` as the default ORM adapter and `DatabaseAdapterBunPostgres` as the default database adapter.

### Manual Setup

```javascript
import { ControllerMixinDatabase, Model } from "@lionrockjs/central";
import { DatabaseAdapterBunPostgres, ORMAdapterPostgreSQL } from "@lionrockjs/adapter-database-bun-postgresql";

Model.defaultAdapter = ORMAdapterPostgreSQL;
ControllerMixinDatabase.defaultAdapter = DatabaseAdapterBunPostgres;
```

### Database Connection

The adapter accepts a PostgreSQL connection string:

```javascript
import { DatabaseAdapterBunPostgres } from "@lionrockjs/adapter-database-bun-postgresql";

const db = DatabaseAdapterBunPostgres.create("postgres://user:password@localhost:5432/database");
```

### Environment Variables

You can use environment variables for configuration:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/database
```

```javascript
const db = DatabaseAdapterBunPostgres.create(process.env.DATABASE_URL);
```

## Key Differences from SQLite Adapter

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Placeholders | `?` | `$1, $2, $3...` |
| Boolean values | `1` / `0` | `true` / `false` |
| Case-insensitive | `COLLATE NOCASE` | `LOWER()` / `ILIKE` |
| JSON extract | `json_extract(col, '$.key')` | `col->>'key'` |
| Upsert | `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |

## API

### DatabaseAdapterBunPostgres

- `constructor(connectionString)` - Create a new database connection
- `query(sql, values)` - Execute a query with parameters
- `exec(sql)` - Execute raw SQL
- `close()` - Close the database connection
- `transactionStart()` - Begin a transaction
- `transactionCommit()` - Commit a transaction
- `transactionRollback()` - Rollback a transaction

### ORMAdapterPostgreSQL

Extends `ORMAdapter` from `@lionrockjs/central` with PostgreSQL-specific implementations for:

- `read()`, `insert()`, `update()`, `delete()`
- `readAll()`, `readBy()`, `readWith()`
- `countAll()`, `countBy()`, `countWith()`
- `deleteAll()`, `deleteBy()`, `deleteWith()`
- `updateAll()`, `updateBy()`, `updateWith()`
- `insertAll()`
- `hasMany()`, `belongsToMany()`, `add()`, `remove()`, `removeAll()`

## Running Tests

Tests require a running PostgreSQL server. Set the `TEST_DATABASE_URL` environment variable:

```bash
# Create test database
createdb lionrock_test

# Run tests with connection string
TEST_DATABASE_URL="postgres://username:password@localhost:5432/lionrock_test" bun test
```

**Default connection**: If `TEST_DATABASE_URL` is not set, tests will try `postgres://postgres:postgres@localhost:5432/lionrock_test`.

## License

MIT License - see LICENSE file for details.
