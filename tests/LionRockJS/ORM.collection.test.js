import { beforeEach, afterEach, describe, it, expect } from 'bun:test';

import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

const {
  AND, EQUAL, NOT_EQUAL, OR, TRUE, FALSE, START_GROUP, END_GROUP,
} = {
  EQUAL: 'EQUAL',
  GREATER_THAN: 'GREATER_THAN',
  LESS_THAN: 'LESS_THAN',
  GREATER_THAN_EQUAL: 'GREATER_THAN_EQUAL',
  LESS_THAN_EQUAL: 'LESS_THAN_EQUAL',
  NOT_EQUAL: 'NOT_EQUAL',
  BETWEEN: 'BETWEEN',
  LIKE: 'LIKE',
  IN: 'IN',
  AND: 'AND',
  OR: 'OR',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  BLANK: 'BLANK',
  START_GROUP: 'START_GROUP',
  END_GROUP: 'END_GROUP',
};

import { Central, Model, ORM } from '@lionrockjs/central';
import ORMAdapterSQLite from '../../src/adapter/orm/SQLite';
import path from 'node:path';
import fs from 'node:fs';
import {Database} from 'bun:sqlite';

Model.defaultAdapter = ORMAdapterSQLite;


describe('orm test', () => {
  let Person;
  beforeEach(async () => {
    await Central.init({
      EXE_PATH: `${__dirname}/test18`,
    });
    Person = await ORM.import('Person');
  });

  afterEach(async () => {
  });

  // idx is autoincrement primary key
  const targetPath = path.normalize(`${__dirname}/test18/db/empty.sqlite`);
  const sourcePath = path.normalize(`${__dirname}/orm/db/empty.default.sqlite`);
  if (fs.existsSync(targetPath))fs.unlinkSync(targetPath);

  fs.copyFileSync(sourcePath, targetPath);
  const db = new Database(targetPath);
  db.exec(`CREATE TABLE persons(
id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
enable BOOLEAN,
name TEXT,
email TEXT); 

CREATE TRIGGER persons_updated_at AFTER UPDATE ON persons WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
UPDATE persons SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;`);
  Model.database = db;

  beforeEach(() => {
    db.exec(`
INSERT INTO persons (id, enable, name, email) VALUES (1, 1, 'Alice', 'alice@example.com');
INSERT INTO persons (id, enable, name, email) VALUES (2, 1, 'Bob', 'bob@example.com');
INSERT INTO persons (id, enable, name, email) VALUES (3, 0, 'Charlie', 'charlie@example.com');
INSERT INTO persons (id, enable, name, email) VALUES (4, 0, 'Dennis', 'dennis@example.com');
INSERT INTO persons (id, enable, name, email) VALUES (5, 1, 'Eric', 'eric@example.com');
INSERT INTO persons (id, enable, name, email) VALUES (6, 0, 'Frank', 'frank@example.com');
`);
  });

  afterEach(() => {
    db.exec('DELETE FROM persons');
  });

  it('read all', async () => {
    const result = await ORM.readAll(Person, { database: db, columns:['*'] });

    expect(result.length).toBe(6);

    const r2 = await ORM.readAll(Person, { kv: new Map([['enable', false]]) });
    expect(r2.length).toBe(3);
  });

  it('read by', async () => {
    db.exec('DELETE FROM persons');
    const p = ORM.create(Person);
    p.name = 'Alice';
    p.email = 'alice@example.com';
    p.enable = true;
    await p.write();

    const p2 = ORM.create(Person);
    p2.name = 'Bob';
    p2.email = 'bob@example.com';
    p2.enable = true;
    await p2.write();

    const p3 = ORM.create(Person);
    p3.name = 'Charlie';
    p3.email = 'charlie@example.com';
    p3.enable = false;
    await p3.write();

    const p4 = ORM.create(Person);
    p4.name = 'Danny';
    p4.email = 'danny@example.com';
    p4.enable = true;
    await p4.write();

    const p5 = ORM.create(Person);
    p5.name = 'Eric';
    p5.email = 'eric@example.com';
    p5.enable = false;
    await p5.write();

    const px = ORM.create(Person);
    px.name = 'Eric';
    await px.read(['email']);
    expect(px.email).toBe('eric@example.com');

    const people = await ORM.readBy(Person, 'name', ['Alice', 'Bob', 'Eric', 'Frank'], { database: db });
    expect(people.length).toBe(3);

    const falsy = await ORM.readBy(Person, 'enable', [false]);
    expect(falsy.length).toBe(2);
  });

  it('read With', async () => {
    const criteria = [
      ['', 'enable', EQUAL, TRUE],
      [AND],
      [START_GROUP],
      ['', 'name', EQUAL, 'Alice'],
      [OR, 'name', EQUAL, 'Bob'],
      [OR, 'name', EQUAL, ['?', "Charlie"]],//danger, this allow SQL injection
      [OR, 'name', EQUAL, ["'Dennis'"]],//danger, this allow SQL injection
      [OR, 'name', EQUAL, () => "'Eric'" ], //danger, this allow SQL injection
      [END_GROUP],
    ];

    const strCriteria = ORMAdapterSQLite.formatCriteria(criteria);
    expect(strCriteria).toBe(" enable = ? AND    (     name = ? OR name = ? OR name = ? OR name = 'Dennis' OR name = 'Eric' )    ");


    const people = await ORM.readWith(Person, criteria, { database: db });
    expect(people.length).toBe(3);

    const empty = await ORM.readWith(Person, [], { adapter: ORMAdapterSQLite });
    expect(empty.length).toBe(0);

    Person.defaultAdapter = ORMAdapterSQLite;
    const empty2 = await ORM.readWith(Person);
    expect(empty2.length).toBe(0);

    const dennis = await ORM.readWith(Person, [['', 'id', EQUAL, 4]], {columns: ["email"]});
    expect(dennis.email).toBe('dennis@example.com');

    try {
      await ORM.readWith(Person, ['', 'id', EQUAL, 4]);
      expect('this line should not be run').toBe(false);
    } catch (e) {
      expect(e.message).toBe('criteria must group by array.');
    }

    const res = await ORM.readWith(Person);
    expect(res.length).toBe(0);
  });

  it('delete all', async () => {
    // prepare data
    await ORM.deleteAll(Person, { kv: new Map([['enable', true]]) });

    const result = db.prepare('SELECT * FROM persons').all();
    expect(result.length).toBe(3);

    await ORM.deleteAll(Person);
    const result2 = db.prepare('SELECT * FROM persons').all();
    expect(result2.length).toBe(0);
  });

  it('delete by', async () => {
    await ORM.deleteBy(Person, 'id', [1, 3, 5]);
    const r3 = db.prepare('SELECT * FROM persons').all();
    expect(r3.length).toBe(3);

    await ORM.deleteBy(Person, 'name', ['Bob', 'Frank', 'Eric']);
    const r4 = db.prepare('SELECT * FROM persons').all();
    expect(r4.length).toBe(1);

    await ORM.deleteBy(Person, 'name', ['Bob', 'Frank', 'Eric', 'Dennis']);
    const r5 = db.prepare('SELECT * FROM persons').all();
    expect(r5.length).toBe(0);
  });

  it('delete with', async () => {
    const p = await ORM.factory(Person, 6);
    p.enable = true;
    await p.write();

    await ORM.deleteWith(Person, [
      ['', 'enable', EQUAL, TRUE],
      [AND, 'name', NOT_EQUAL, 'Alice'],
      [OR, 'name', EQUAL, 'Dennis'],
    ]);

    const r = db.prepare('SELECT * from persons').all();
    expect(r.length).toBe(2);
  });

  it('delete without criteria', async () => {
    try {
      await ORM.deleteWith(Person, null);
    } catch (e) {
      expect(e.message).toBe('Person delete with no criteria');
    }

    try {
      await ORM.updateWith(Person, null, new Map());
    } catch (e) {
      expect(e.message).toBe('Person update with no criteria');
    }

    try {
      await ORM.updateWith(Person, [[], []], new Map());
    } catch (e) {
      expect(e.message).toBe('Person update without values');
    }
  });

  it('update all', async () => {
    await ORM.updateAll(Person, new Map([['enable', false]]), new Map([['email', 'goodbye@example.com']]));
    const r = db.prepare('SELECT * from persons WHERE enable = ?').all(0);
    expect(r[0].email).toBe('goodbye@example.com');
    expect(r[1].email).toBe('goodbye@example.com');
    expect(r[2].email).toBe('goodbye@example.com');

    await ORM.updateAll(Person, null, new Map([['email', 'remove@example.com']]));
    const r2 = db.prepare('SELECT * from persons').all();
    expect(r2[0].email).toBe('remove@example.com');
    expect(r2[1].email).toBe('remove@example.com');
    expect(r2[2].email).toBe('remove@example.com');
    expect(r2[3].email).toBe('remove@example.com');
    expect(r2[4].email).toBe('remove@example.com');
    expect(r2[5].email).toBe('remove@example.com');
  });

  it('update by', async () => {
    await ORM.updateBy(Person, 'id', [1, 2, 5, 6], new Map([['email', 'goodbye@example.com'], ['name', 'anonymous']]));
    const r = db.prepare('SELECT * from persons').all();
    expect(r[0].name).toBe('anonymous');
    expect(r[1].name).toBe('anonymous');
    expect(r[2].name).not.toBe('anonymous');
    expect(r[3].name).not.toBe('anonymous');
    expect(r[4].name).toBe('anonymous');
    expect(r[5].name).toBe('anonymous');
  });

  it('update with', async () => {
    const criteria = [
      ['', 'enable', EQUAL, FALSE],
      [OR, 'name', EQUAL, 'Alice'],
    ];

    await ORM.updateWith(Person, criteria, new Map([['email', 'goodbye@example.com'], ['name', 'anonymous']]));

    const r = await ORM.readAll(Person);
    expect(r[0].name).toBe('anonymous');
    expect(r[1].name).not.toBe('anonymous');
    expect(r[2].name).toBe('anonymous');
    expect(r[3].name).toBe('anonymous');
    expect(r[4].name).not.toBe('anonymous');
    expect(r[5].name).toBe('anonymous');
  });

  it('insert all', async () => {
    await ORM.insertAll(Person, ['id', 'enable', 'name', 'email'], [
      [7, true, 'George', 'george@example.com'],
      [8, true, 'Hong', 'hong@example.com'],
      [9, true, 'Ivy', 'ivy@example.com'],
      [10, false, 'Joanna', 'joanna@example.com'],
      [11, true, 'Ken', 'ken@example.com'],
    ], { database: db });

    const r = await ORM.readAll(Person);

    expect(r[6].name).toBe('George');
    expect(r[7].name).toBe('Hong');
    expect(r[8].name).toBe('Ivy');
    expect(r[9].name).toBe('Joanna');
    expect(r[10].name).toBe('Ken');

    try {
      await ORM.insertAll(Person, ['enable', 'name', 'xxx'], [
        [true, 'George', 'george@example.com'],
        [true, 'Hong', 'hong@example.com'],
        [true, 'Ivy', 'ivy@example.com'],
        [false, 'Joanna', 'joanna@example.com'],
        [true, 'Ken', 'ken@example.com'],
      ]);
    } catch (e) {
      expect(e.message).toBe('Person insert invalid columns xxx');
    }
  });

  it('insert all with ids', async () => {
    await ORM.insertAll(Person, ['enable', 'name', 'email'], [
      [true, 'George', 'george@example.com'],
      [true, 'Hong', 'hong@example.com'],
      [true, 'Ivy', 'ivy@example.com'],
      [false, 'Joanna', 'joanna@example.com'],
      [true, 'Ken', 'ken@example.com'],
    ], { database: db, insertIDs: [111, 222, 333, 444, 555, 666] });

    const r = await ORM.readAll(Person);

    expect(r[6].id).toBe(111);
    expect(r[7].id).toBe(222);
    expect(r[8].id).toBe(333);
    expect(r[9].id).toBe(444);
    expect(r[10].id).toBe(555);
  });

  it('insert all with partial ids', async () => {
    await ORM.insertAll(Person, ['enable', 'name', 'email'], [
      [true, 'George', 'george@example.com'],
      [true, 'Hong', 'hong@example.com'],
      [true, 'Ivy', 'ivy@example.com'],
      [false, 'Joanna', 'joanna@example.com'],
      [true, 'Ken', 'ken@example.com'],
    ], { database: db, insertIDs: [111, 222, 333] });

    const r = await ORM.readAll(Person);

    expect(r[6].id).toBe(111);
    expect(r[7].id).toBe(222);
    expect(r[8].id).toBe(333);
    expect(r[9].id).not.toBe(444);
    expect(r[10].id).not.toBe(555);
  });

  it('insert all without ids', async () => {
    await ORM.insertAll(Person, ['enable', 'name', 'email'], [
      [true, 'George', 'george@example.com'],
      [true, 'Hong', 'hong@example.com'],
      [true, 'Ivy', 'ivy@example.com'],
      [false, 'Joanna', 'joanna@example.com'],
      [true, 'Ken', 'ken@example.com'],
    ], { database: db });

    const r = await ORM.readAll(Person);

    expect(r[6].id).not.toBe(111);
    expect(r[7].id).not.toBe(222);
    expect(r[8].id).not.toBe(333);
    expect(r[9].id).not.toBe(444);
    expect(r[10].id).not.toBe(555);
  });


  it('coverage', ()=>{
    expect(ORMAdapterSQLite.op(ORMAdapterSQLite.OP.AND)).toBe('AND');
    expect(ORMAdapterSQLite.op(null)).toBe(null);
    expect(ORMAdapterSQLite.op('Something')).toBe("'Something'");

    expect(ORMAdapterSQLite.translateValues().length).toBe(0);
    expect(ORMAdapterSQLite.translateValues([]).length).toBe(0);
    expect(ORMAdapterSQLite.translateValues([{foo:'bar'}])[0]).toBe("{\"foo\":\"bar\"}");
    expect(ORMAdapterSQLite.translateValues([()=>'hello'])[0]).toBe("\"hello\"");

    expect(ORMAdapterSQLite.getWheresAndWhereValueFromCriteria().wheres).toBe("    ");
    expect(ORMAdapterSQLite.getWheresAndWhereValueFromCriteria([[]]).wheres).toBe("    ");
  })
});
