import { beforeEach, afterEach, describe, it, expect } from 'bun:test';
import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import {Central, ORM, Model, CentralAdapterNode} from '@lionrockjs/central';
import {Database} from 'bun:sqlite';
import path from 'node:path';
import fs from "node:fs";
import ORMAdapterSQLite from "../../src/adapter/orm/SQLite";

const EQUAL = "EQUAL";
Model.defaultAdapter = ORMAdapterSQLite;
Central.adapter = CentralAdapterNode;

describe('orm test', () => {
  beforeEach(async () => {
    await Central.init({
      EXE_PATH: __dirname,
      APP_PATH: `${__dirname}/orm/application`,
      MOD_PATH: `${__dirname}/test1/modules`,
    });
  });

  afterEach(async () => {
  });

  it('orm', async() => {
    const obj = new Model();
    const className = obj.constructor.name;

    expect(className).toBe('Model');
    expect(Model.tableName).toBe(null);
    // ORM is abstract class, should not found lowercase and tableName
  });

  it('extends ORM', async () => {
    const TestModel = (await import('./orm/application/classes/TestModel')).default;
    // eslint-disable-next-line no-new
    new TestModel();

    expect(TestModel.tableName).toBe('testmodels');
  });

  it('DB test', () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/db.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    const db = new Database(dbPath);

    const sql = 'CREATE TABLE tests( id INTEGER UNIQUE PRIMARY KEY AUTOINCREMENT NOT NULL , text TEXT NOT NULL)';
    db.prepare(sql).run();

    const tmpValue = Math.random().toString();
    db.prepare('INSERT INTO tests(text) VALUES (?)').run(tmpValue);

    const result = db.prepare('SELECT * from tests WHERE text = ?').get(tmpValue);
    expect(result.text).toBe(tmpValue);
  });

  it('ORM.setDB', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/db1.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    const db = new Database(dbPath);

    Model.database = db;

    const tableName = 'testmodels';
    db.prepare(
      `CREATE TABLE ${tableName}( id INTEGER UNIQUE PRIMARY KEY AUTOINCREMENT NOT NULL , created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL , `
      + 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL , text TEXT NOT NULL)',
    ).run();
    db.prepare(
      `CREATE TRIGGER ${tableName}_updated_at AFTER UPDATE ON ${tableName} WHEN old.updated_at < CURRENT_TIMESTAMP `
      + `BEGIN UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id; END;`,
    ).run();
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Hello');
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Foo');

    const TestModel = (await import('./orm/application/classes/TestModel.mjs')).default;

    const m = new TestModel(1);
    await m.read(['id', 'text']);
    const m2 = new TestModel(2);
    await m2.read(['id', 'text']);

    expect(TestModel.tableName).toBe('testmodels');

    expect(m.text).toBe('Hello');
    expect(m2.text).toBe('Foo');
  });

  it('ORM instance setDB', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/db2.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    const db = new Database(dbPath);

    const tableName = 'testmodels';
    db.prepare(
      `CREATE TABLE ${tableName}( id INTEGER UNIQUE PRIMARY KEY AUTOINCREMENT NOT NULL , created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL , `
      + 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL , text TEXT NOT NULL)',
    ).run();
    db.prepare(
      `CREATE TRIGGER ${tableName}_updated_at AFTER UPDATE ON ${tableName} WHEN old.updated_at < CURRENT_TIMESTAMP `
      + `BEGIN UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id; END;`,
    ).run();
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Hello');
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Foo');

    const TestModel = await Central.import('TestModel');

    const m = new TestModel(1, { database: db });
    await m.read(['text']);

    const m2 = await ORM.factory(TestModel, 2, { database: db, columns: ['text'] });

    expect(TestModel.tableName).toBe('testmodels');

    expect(m.text).toBe('Hello');
    expect(m2.text).toBe('Foo');
  });

  it('alias model', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/db3.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    const db = new Database(dbPath);

    const tableName = 'testmodels';
    db.prepare(
      `CREATE TABLE ${tableName}( id INTEGER UNIQUE PRIMARY KEY AUTOINCREMENT NOT NULL , created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL `
      + ', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL , text TEXT NOT NULL)',
    ).run();
    db.prepare(
      `CREATE TRIGGER ${tableName}_updated_at AFTER UPDATE ON ${tableName} WHEN old.updated_at < CURRENT_TIMESTAMP `
      + `BEGIN UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id; END;`,
    ).run();
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Hello');
    db.prepare(`INSERT INTO ${tableName} (text) VALUES (?)`).run('Foo');

    const AliasModel = await Central.import('AliasModel');

    expect(AliasModel.tableName).toBe('testmodels');

    // eslint-disable-next-line no-new
    new AliasModel();
    expect(AliasModel.joinTablePrefix).toBe('testmodel');

    const model = await ORM.factory(AliasModel, 1, { database: db, columns: ['text'] });
    expect(model.text).toBe('Hello');
  });

  it('belongsTo', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo4.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(path.normalize(`${__dirname}/orm/db/belongsTo.default.sqlite`), dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (id, first_name, last_name) VALUES (?, ?, ?)').run(1, 'Peter', 'Pan');
    db.prepare('INSERT INTO addresses (person_id, address1) VALUES (?, ?)').run(1, 'Planet X');

    Model.database = db;

    const Address = await ORM.import('Address');
    const Person = await ORM.import('Person');

    const peter = new Person(1);
    await peter.read(['first_name']);
    expect(peter.first_name).toBe('Peter');

    const home = new Address(1);
    await home.read(['address1', 'person_id']);
    expect(home.address1).toBe('Planet X');

    const owner = await home.parent('person_id', { columns: ['first_name'] });
    expect(owner.first_name).toBe('Peter');

    try {
      await home.parent('fake_id');
      expect('this line should not be run').toBe(false);
    } catch (e) {
      expect(e.message).toBe('fake_id is not foreign key in Address');
    }

    const office = new Address();
    office.address1 = 'Planet Y';
    office.person_id = peter.id;
    await office.write();

    expect(office.address1).toBe('Planet Y');

    const addresses = await peter.children('person_id', Address);
    expect(addresses.length).toBe(2);

    try {
      await peter.children('person_id');
      expect('should not run this line').toBe(false);
    } catch (e) {
      expect(e.message).toBe('children fk have multiple Models, please specific which Model will be used');
    }
  });

  it('instance belongsTo', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo5.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsTo.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (first_name, last_name) VALUES (?, ?)').run('Peter', 'Pan');
    db.prepare('INSERT INTO addresses (person_id, address1) VALUES (?, ?)').run(1, 'Planet X');

    const Address = await ORM.import('Address');
    const Person = await ORM.import('Person');

    const peter = await ORM.factory(Person, 1, { database: db , columns: ['first_name'] });
    expect(peter.first_name).toBe('Peter');

    const home = await ORM.factory(Address, 1, { database: db, columns: ['address1', 'person_id'] });
    expect(home.address1).toBe('Planet X');

    const owner = await home.parent('person_id', { columns: ['first_name'] });
    expect(owner.first_name).toBe('Peter');

    expect(owner.db).toStrictEqual(home.db);
  });

  it('belongsToMany', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany6.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    db.prepare('INSERT INTO products (name) VALUES (?)').run('bar');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('foo');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('tar');
    db.prepare('INSERT INTO product_tags (product_id, tag_id) VALUES (?,?)').run(1, 1);
    db.prepare('INSERT INTO product_tags (product_id, tag_id) VALUES (?,?)').run(1, 2);

    Model.database = db;

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const product = await ORM.factory(Product, 1);

    expect(product.name).toBe('bar');
    const tags = await product.siblings(Tag);

    expect(tags[0].name).toBe('foo');
    expect(tags[1].name).toBe('tar');
  });

  it('instance belongsToMany', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany7.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    db.prepare('INSERT INTO products (name) VALUES (?)').run('bar');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('foo');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('tar');
    db.prepare('INSERT INTO product_tags (product_id, tag_id) VALUES (?,?)').run(1, 1);
    db.prepare('INSERT INTO product_tags (product_id, tag_id) VALUES (?,?)').run(1, 2);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const product = await ORM.factory(Product, 1, { database: db });

    expect(product.name).toBe('bar');
    const tags = await product.siblings(Tag);

    expect(tags[0].name).toBe('foo');
    expect(tags[1].name).toBe('tar');

    expect(tags[0].db).toStrictEqual(product.db);
    expect(tags[1].db).toStrictEqual(product.db);
  });

  it('ORM get all from model', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany8.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    db.prepare('INSERT INTO tags (name) VALUES (?)').run('foo');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('tar');

    Model.database = db;

    const Tag = await ORM.import('Tag');
    const tags = await ORM.readAll(Tag, { database: db });

    expect(tags[0].name).toBe('foo');
    expect(tags[1].name).toBe('tar');

    const tags2 = await ORM.readAll(Tag);
    expect(tags2[0].name).toBe('foo');
    expect(tags2[1].name).toBe('tar');

    const tags3 = await ORM.readAll(Tag, { limit: 1 });
    expect(typeof tags3).not.toBe('array');
    expect(tags3.name).toBe('foo');

    const tags4 = await ORM.readAll(Tag, { kv: new Map([['name', 'not exist']]), limit: 1 });
    expect(tags4).toBe(null);

    const tags5 = await ORM.readBy(Tag, 'name', ['foo', 'bar', 'tar']);
    expect(tags5[0].name).toBe('foo');
    expect(tags5[1].name).toBe('tar');

    const tags6 = await ORM.readWith(Tag, [['', 'name', EQUAL, 'tar']]);
    expect(tags6.name).toBe('tar');

    const tags7 = await ORM.readBy(Tag, 'name', ['foo', 'bar', 'tar'], { limit: 1 });
    expect(tags7.name).toBe('foo');

    const tags8 = await ORM.readWith(Tag, [['', 'name', EQUAL, 'tar']], { limit: 1 });
    expect(tags8.name).toBe('tar');
  });

  it('enumerate', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany10.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(1, 'foo');
    db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(2, 'tar');

    const Tag = await ORM.import('Tag');
    const t = await ORM.factory(Tag, 1, { database: db });

    expect(t.name).toBe('foo');
  });

  it('write', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo11.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsTo.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (first_name, last_name) VALUES (?, ?)').run('Peter', 'Pan');
    db.prepare('INSERT INTO addresses (person_id, address1) VALUES (?, ?)').run(1, 'Planet X');

    const Person = await ORM.import('Person');

    const peter = await ORM.factory(Person, 1, { database: db, columns: ['first_name'] });
    peter.last_name = 'Panther';
    peter.write();

    const data = db.prepare('SELECT last_name FROM persons WHERE id = 1').get();
    expect(data.last_name).toBe('Panther');
  });

  it('create new record', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo12.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsTo.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (first_name, last_name) VALUES (?, ?)').run('Peter', 'Pan');
    db.prepare('INSERT INTO addresses (person_id, address1) VALUES (?, ?)').run(1, 'Planet X');

    const Person = await ORM.import('Person');
    const alice = ORM.create(Person, { database: db });
    alice.first_name = 'Alice';
    alice.last_name = 'Lee';
    await alice.write();

    const data = db.prepare('SELECT * FROM persons WHERE first_name = ?').get('Alice');
    expect(data.last_name).toBe('Lee');

    Model.database = db;
    const bob = ORM.create(Person);
    bob.first_name = 'Bob';
    bob.last_name = 'Chan';
    await bob.write();

    const data2 = db.prepare('SELECT * FROM persons WHERE first_name = ?').get('Bob');
    expect(data2.last_name).toBe('Chan');
  });

  it('add belongsToMany', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany13.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const tagA = new Tag(null, { database: db });
    tagA.name = 'white';
    tagA.write();

    const tagB = new Tag(null, { database: db });
    tagB.name = 'liquid';
    tagB.write();

    const product = new Product(null, { database: db });
    product.name = 'milk';
    product.write();
    product.add(tagA);
    product.write();

    const result1 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result1.length).toBe(1);

    product.add(tagB);
    product.write();
    const result2 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result2.length).toBe(2);
  });

  it('add duplicate belongsToMany', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany14.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const tagA = new Tag(null, { database: db });
    tagA.name = 'white';
    await tagA.write();

    const product = new Product(null, { database: db });
    product.name = 'milk';
    await product.write();
    await product.add(tagA);
    await product.write();

    const result1 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result1.length).toBe(1);

    await product.add(tagA);
    await product.write();
    const result2 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result2.length).toBe(1);
  });

  it('remove belongsToMany', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany15.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const tagA = new Tag(null, { database: db });
    tagA.name = 'white';
    tagA.write();

    const product = new Product(null, { database: db });
    product.name = 'milk';
    await product.write();
    await product.add(tagA);
    await product.write();

    const result1 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result1.length).toBe(1);

    await product.remove(tagA);
    await product.write();
    const result2 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result2.length).toBe(0);
  });

  it('delete', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany16.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    const Product = await ORM.import('Product');
    const product = new Product(null, { database: db });
    product.name = 'milk';
    product.write();

    const result1 = db.prepare('SELECT * from products').all();
    expect(result1.length).toBe(1);

    product.delete();
    const result2 = db.prepare('SELECT * from products').all();
    expect(result2.length).toBe(0);
  });

  it('delete and remove links', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany17.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const tagA = new Tag(null, { database: db });
    tagA.name = 'white';
    await tagA.write();

    const tagB = new Tag(null, { database: db });
    tagB.name = 'liquid';
    await tagB.write();

    const product = new Product(null, { database: db });
    product.name = 'milk';
    await product.write();
    await product.add(tagA);
    await product.add(tagB);
    await product.write();

    const result1 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result1.length).toBe(2);

    await product.delete();
    const result2 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product.id);
    expect(result2.length).toBe(0);

    const product2 = ORM.create(Product, { database: db });
    product2.name = 'coffee';
    await product2.write();
    await product2.add(tagA);
    await product2.add(tagB);
    await product2.add(tagB);
    const result3 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product2.id);
    expect(result3.length).toBe(2);

    await product2.removeAll(Tag);
    const result4 = db.prepare('SELECT * from product_tags WHERE product_id = ?').all(product2.id);
    expect(result4.length).toBe(0);
  });

  it('lazy loading', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany18.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO products (name) VALUES (?)').run('bar');

    const Product = await ORM.import('Product');

    const product = new Product(null, { database: db });
    try {
      await product.read();
      expect('this line should not be loaded').toBe(false);
    } catch (e) {
      expect(e.message).toBe('Product: No id and no value to read');
    }

    expect(product.name).toBe(null);

    product.id = 1;
    await product.read();

    expect(product.name).toBe('bar');
  });

  it('delete unsaved object', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany19.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO products (name) VALUES (?)').run('bar');

    const Product = await ORM.import('Product');
    const product = new Product(null, { database: db });
    try {
      await product.delete();
      expect('this line should not exec').toBe('');
    } catch (e) {
      expect(e.message).toBe('ORM delete Error, no id defined');
    }
  });

  it('handle hasMany target without tableName', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo20.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsTo.default.sqlite`, dbPath);
    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (first_name, last_name) VALUES (?, ?)').run('Peter', 'Pan');
    db.prepare('INSERT INTO addresses (person_id, address1) VALUES (?, ?)').run(1, 'Planet X');

    const Address = await ORM.import('Address');
    const Person = await ORM.import('Person');

    const peter = await ORM.factory(Person, 1, { database: db, columns: ['first_name'] });
    expect(peter.first_name).toBe('Peter');

    const home = await ORM.factory(Address, 1, { database: db, columns: ['address1', 'person_id'] });
    expect(home.address1).toBe('Planet X');

    const owner = await home.parent('person_id', { columns: ['first_name'] });
    expect(owner.first_name).toBe('Peter');

    const office = new Address(null, { database: db });
    office.address1 = 'Planet Y';
    office.person_id = peter.id;
    await office.write();

    expect(office.address1).toBe('Planet Y');

    Address.tableName = null;
    try {
      await peter.children('product_id', Address);
    } catch (e) {
      expect(e.message).toBe('near "null": syntax error');
    }
  });

  it('no database', async () => {
    Model.database = null;

    const Person = await ORM.import('Person');
    const peter = new Person({database: null});

    try {
      await peter.write();
      expect('this line should not be run').toBe('');
    } catch (e) {
      expect(e.message).toBe("null is not an object (evaluating 'database.prepare')");
    }
  });

  it('ORM read fail', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsTo22.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsTo.default.sqlite`, dbPath);

    const db = new Database(dbPath);
    db.prepare('INSERT INTO persons (first_name, last_name) VALUES (?, ?)').run('Peter', 'Pan');

    const Person = await ORM.import('Person');
    const a = new Person('1000', { database: db });

    try {
      await a.read(['id']);
      expect('this line should not be loaded').toBe(false);
    } catch (e) {
      expect(e.message).toBe('Record not found. Person id:1000');
    }

    expect(a.created_at).toBe(null);
  });

  it('ORM convert boolean to TRUE and FALSE when save', async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test13` });

    // idx is autoincrement primary key
    const targetPath = path.normalize(`${__dirname}/test13/db/empty.sqlite`);
    const sourcePath = path.normalize(`${__dirname}/orm/db/empty.default.sqlite`);
    if (fs.existsSync(targetPath))fs.unlinkSync(targetPath);

    fs.copyFileSync(sourcePath, targetPath);

    const db = new Database(targetPath);
    db.exec(`
CREATE TABLE persons(
id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
enable BOOLEAN ); 

CREATE TRIGGER persons_updated_at AFTER UPDATE ON persons WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
UPDATE persons SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;
`);

    const Person = await ORM.import('Person');
    const p = ORM.create(Person, { database: db });
    p.enable = true;
    await p.write();

    const r = await ORM.factory(Person, p.id, { database: db, columns: ['enable'] });

    expect(!!r.enable).toBe(true);

    const p2 = ORM.create(Person, { database: db, columns : ['enable'] });
    p2.enable = false;
    await p2.write();

    const r2 = await ORM.factory(Person, p.id, { database: db, columns: ['enable'] });
    expect(!!r2.enable).toBe(true);
  });

  it('ORM find', async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test15` });

    // idx is autoincrement primary key
    const targetPath = path.normalize(`${__dirname}/test15/db/empty.sqlite`);
    const sourcePath = path.normalize(`${__dirname}/orm/db/empty.default.sqlite`);
    if (fs.existsSync(targetPath))fs.unlinkSync(targetPath);

    fs.copyFileSync(sourcePath, targetPath);

    const db = new Database(targetPath);
    db.exec(`
CREATE TABLE persons(
id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
enable BOOLEAN,
name TEXT,
email TEXT); 

CREATE TRIGGER persons_updated_at AFTER UPDATE ON persons WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
UPDATE persons SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;
`);

    const Person = await ORM.import('Person');
    const p = ORM.create(Person, { database: db });
    p.name = 'Alice';
    p.email = 'alice@example.com';
    p.enable = true;
    await p.write();

    const p2 = ORM.create(Person, { database: db });
    p2.name = 'Bob';
    p2.enable = false;
    await p2.write();

    const r = ORM.create(Person, { database: db });
    r.name = 'Alice';
    await r.read();
    expect(r.id).toBe(p.id);

    const r2 = ORM.create(Person, { database: db });
    try {
      await r2.read();
      expect('this line shoulld not be loaded').toBe(false);
    } catch (e) {
      expect(e.message).toBe('Person: No id and no value to read');
    }

    expect(r2.id).toBe(null);
  });

  it('prepend model prefix path', async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test15` });
    const Person = await ORM.import('Person');
    const p = new Person();
    expect(!!p).toBe(true);

    try {
      ORM.classPrefix = 'models/';
      await ORM.import('Person');
      expect('this line should not be run').expect(true);
    } catch (e) {
      ORM.classPrefix = 'model/';
      expect(e.message).toBe('Resolve path error: path models/Person not found. prefixPath: classes , store: {} ');
    }
  });

  it('ORM import', async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test15` });
    const Person = await ORM.import('Person');
    const p = new Person();
    expect(!!p).toBe(true);
  });

  it('ORM snapshot', async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test15` });
    const Person = await ORM.import('Person');
    const p = new Person();
    p.name = 'Alice';

    p.snapshot();
    p.name = 'Bob';
    p.snapshot();
    p.name = 'Charlie';

    expect(p.getStates()[0].name).toBe('Alice');
    expect(p.getStates()[1].name).toBe('Bob');
  });

  it('ORM count all from model', async () => {
    const dbPath = path.normalize(`${__dirname}/orm/db/belongsToMany20.sqlite`);
    if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
    fs.copyFileSync(`${__dirname}/orm/db/belongsToMany.default.sqlite`, dbPath);
    const database = new Database(dbPath);

    database.prepare('INSERT INTO tags (name) VALUES (?),(?),(?),(?),(?)').run('foo', 'tar', 'sha', 'lar','foo');

    const Tag = await ORM.import('Tag');
    const count = await ORM.countAll(Tag, { database });
    expect(count).toBe(5);

    const count2 = await ORM.countAll(Tag, { database, kv:new Map([['name', 'foo']]) });
    expect(count2).toBe(2);

    const count2b = await ORM.countBy(Tag, 'name', ['foo'],{ database });
    expect(count2b).toBe(2);

    const count3 = await ORM.countBy(Tag, 'name', ['foo', 'tar'],{ database });
    expect(count3).toBe(3);

    const count4 = await ORM.countWith(Tag, [['','name','EQUAL', 'foo']], {database});
    expect(count4).toBe(2);
  });
});
