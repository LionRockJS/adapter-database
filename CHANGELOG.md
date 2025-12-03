# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.0.1] - 2024-12-03

### Added
- Initial PostgreSQL adapter for Bun runtime
- `DatabaseAdapterBunPostgres` - Database connection adapter using Bun's `SQL` API
- `ORMAdapterPostgreSQL` - ORM adapter with PostgreSQL-specific SQL generation
  - Support for `$1, $2, $3...` placeholder syntax
  - Native boolean support (`true`/`false`)
  - PostgreSQL JSON operators (`col->>'key'`)
  - Case-insensitive ordering with `LOWER()`
  - `ON CONFLICT DO NOTHING` for upsert operations
- Test suite for database driver and ORM operations
- Documentation with usage examples