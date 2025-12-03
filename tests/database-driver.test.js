import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'bun:test';

import DatabaseAdapter from '../classes/adapter/database/BunPostgres.mjs';

// Use environment variable or default test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/lionrock_test';

describe('PostgreSQL database driver', () => {
  let db;

  beforeAll(async () => {
    db = DatabaseAdapter.create(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    if (db) {
      await db.exec('DROP TABLE IF EXISTS test_driver');
      await db.close();
    }
  });

  beforeEach(async () => {
    await db.exec('DROP TABLE IF EXISTS test_driver');
  });

  it('create db connection', async () => {
    expect(db.database !== null).toBe(true);
  });

  it('create table and insert', async () => {
    await db.exec('CREATE TABLE test_driver (id SERIAL PRIMARY KEY, name TEXT)');
    await db.query('INSERT INTO test_driver (id, name) VALUES ($1, $2)', [1, 'Foo']);
    
    const results = await db.query('SELECT * FROM test_driver WHERE id = $1', [1]);
    expect(results[0].name).toBe('Foo');
  });

  it('transaction rollback', async () => {
    await db.exec('CREATE TABLE test_driver (id SERIAL PRIMARY KEY, name TEXT)');
    
    await db.transactionStart();
    await db.query('INSERT INTO test_driver (id, name) VALUES ($1, $2)', [1, 'Foo']);
    await db.query('INSERT INTO test_driver (id, name) VALUES ($1, $2)', [2, 'Bar']);
    await db.transactionRollback();

    const results = await db.query('SELECT * FROM test_driver WHERE id = $1', [1]);
    expect(results.length).toBe(0);
  });

  it('transaction commit', async () => {
    await db.exec('CREATE TABLE test_driver (id SERIAL PRIMARY KEY, name TEXT)');
    
    await db.transactionStart();
    await db.query('INSERT INTO test_driver (id, name) VALUES ($1, $2)', [1, 'Foo']);
    await db.query('INSERT INTO test_driver (id, name) VALUES ($1, $2)', [2, 'Bar']);
    await db.transactionCommit();

    const results = await db.query('SELECT * FROM test_driver WHERE id = $1', [1]);
    expect(results[0].name).toBe('Foo');
  });

  it('checkpoint (no-op for PostgreSQL)', async () => {
    await db.exec('CREATE TABLE test_driver (id SERIAL PRIMARY KEY, name TEXT)');
    const result = await db.checkpoint();
    expect(result).toBe(undefined);
  });
});
