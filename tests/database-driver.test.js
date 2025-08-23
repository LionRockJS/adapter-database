import { beforeEach, afterEach, describe, it, expect } from 'bun:test';

import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import DatabaseAdapter from '../classes/adapter/database/BunSqlite.mjs';

describe('database driver ', () => {

  it('create db', async () => {
    const db = await DatabaseAdapter.create(`${__dirname}/db/empty.sqlite`);
    expect(db.database !== null).toBe(true);
  });

  it('create table', async () => {
    const db = await DatabaseAdapter.create(':memory:');
    await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');
    await db.prepare('INSERT INTO test (id, name) VALUES (?, ?);').run(1, 'Foo');
    const result = await db.prepare('SELECT * FROM test WHERE id = 1;').get();
    expect(result.name).toBe('Foo');

    await db.close();
    try{
      await db.prepare('SELECT * FROM test;').get();
      expect('this should not be reached').toBe('');
    }catch(e){
      expect(e.message).toBe('Cannot use a closed database');
    }
  });

  it('transaction', async () => {
    const db = await DatabaseAdapter.create(':memory:');
    await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');
    await db.transactionStart();
    await db.prepare('INSERT INTO test (id, name) VALUES (?, ?);').run(1, 'Foo');
    await db.prepare('INSERT INTO test (id, name) VALUES (?, ?);').run(2, 'Bar');
    await db.transactionRollback();

    const result = await db.prepare('SELECT * FROM test WHERE id = 1;').get();
    expect(result).toBe(null);

    await db.transactionStart();
    await db.prepare('INSERT INTO test (id, name) VALUES (?, ?);').run(1, 'Foo');
    await db.prepare('INSERT INTO test (id, name) VALUES (?, ?);').run(2, 'Bar');
    await db.transactionCommit();

    const result2 = await db.prepare('SELECT * FROM test WHERE id = 1;').get();
    expect(result2.name).toBe('Foo');
  });

  it('checkpoint', async () => {
    const db = await DatabaseAdapter.create(':memory:');
    await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');
    const result = await db.checkpoint();
    expect(result).toBe(undefined);
  });
});
