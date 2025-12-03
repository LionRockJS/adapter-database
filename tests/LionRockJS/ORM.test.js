import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'bun:test';
import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import { Central, ORM, Model, CentralAdapterNode } from '@lionrockjs/central';
import DatabaseAdapter from '../../classes/adapter/database/BunPostgres.mjs';
import ORMAdapterPostgreSQL from '../../classes/adapter/orm/PostgreSQL.mjs';

const EQUAL = "EQUAL";
Model.defaultAdapter = ORMAdapterPostgreSQL;
Central.adapter = CentralAdapterNode;

// Use environment variable or default test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/lionrock_test';

describe('PostgreSQL ORM test', () => {
  let db;

  beforeAll(async () => {
    db = DatabaseAdapter.create(TEST_DATABASE_URL);
    
    // Create test tables matching model definitions
    await db.exec(`
      DROP TABLE IF EXISTS product_tags CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS tags CASCADE;
      DROP TABLE IF EXISTS addresses CASCADE;
      DROP TABLE IF EXISTS persons CASCADE;
      DROP TABLE IF EXISTS testmodels CASCADE;
      
      CREATE TABLE testmodels (
        id BIGINT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        text TEXT NOT NULL
      );
      
      CREATE TABLE persons (
        id BIGINT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        enable BOOLEAN,
        name TEXT
      );
      
      CREATE TABLE addresses (
        id BIGINT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        person_id BIGINT REFERENCES persons(id),
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        company TEXT,
        country TEXT,
        country_code TEXT,
        province TEXT,
        province_code TEXT,
        street TEXT,
        zip TEXT
      );
      
      CREATE TABLE products (
        id BIGINT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        name TEXT,
        content TEXT,
        handle TEXT,
        title TEXT,
        description TEXT,
        template_suffix TEXT,
        available BOOLEAN,
        default_image_id BIGINT,
        type_id BIGINT,
        vendor_id BIGINT
      );
      
      CREATE TABLE tags (
        id BIGINT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        name TEXT NOT NULL
      );
      
      CREATE TABLE product_tags (
        product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
        tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
        weight REAL DEFAULT 0,
        PRIMARY KEY (product_id, tag_id)
      );
    `);

    await Central.init({
      EXE_PATH: __dirname,
      APP_PATH: `${__dirname}/orm/application`,
      MOD_PATH: `${__dirname}/test1/modules`,
    });
  });

  afterAll(async () => {
    if (db) {
      await db.exec(`
        DROP TABLE IF EXISTS product_tags CASCADE;
        DROP TABLE IF EXISTS products CASCADE;
        DROP TABLE IF EXISTS tags CASCADE;
        DROP TABLE IF EXISTS addresses CASCADE;
        DROP TABLE IF EXISTS persons CASCADE;
        DROP TABLE IF EXISTS testmodels CASCADE;
      `);
      await db.close();
    }
  });

  beforeEach(async () => {
    // Clean tables before each test
    await db.exec(`
      DELETE FROM product_tags;
      DELETE FROM products;
      DELETE FROM tags;
      DELETE FROM addresses;
      DELETE FROM persons;
      DELETE FROM testmodels;
    `);
    Model.database = db;
  });

  it('orm base class', async () => {
    const obj = new Model();
    const className = obj.constructor.name;

    expect(className).toBe('Model');
    expect(Model.tableName).toBe(null);
  });

  it('extends ORM', async () => {
    const TestModel = (await import('./orm/application/classes/TestModel.mjs')).default;
    new TestModel();
    expect(TestModel.tableName).toBe('testmodels');
  });

  it('DB test with PostgreSQL', async () => {
    const tmpValue = Math.random().toString();
    await db.query('INSERT INTO testmodels (id, text) VALUES ($1, $2)', [1, tmpValue]);

    const results = await db.query('SELECT * FROM testmodels WHERE text = $1', [tmpValue]);
    expect(results[0].text).toBe(tmpValue);
  });

  it('ORM.setDB', async () => {
    await db.query('INSERT INTO testmodels (id, text) VALUES ($1, $2)', [1, 'Hello']);
    await db.query('INSERT INTO testmodels (id, text) VALUES ($1, $2)', [2, 'Foo']);

    const TestModel = (await import('./orm/application/classes/TestModel.mjs')).default;

    const m = new TestModel(1, { database: db });
    await m.read(['id', 'text']);
    const m2 = new TestModel(2, { database: db });
    await m2.read(['id', 'text']);

    expect(TestModel.tableName).toBe('testmodels');
    expect(m.text).toBe('Hello');
    expect(m2.text).toBe('Foo');
  });

  it('ORM instance setDB', async () => {
    await db.query('INSERT INTO testmodels (id, text) VALUES ($1, $2)', [1, 'Hello']);
    await db.query('INSERT INTO testmodels (id, text) VALUES ($1, $2)', [2, 'Foo']);

    const TestModel = await Central.import('TestModel');

    const m = new TestModel(1, { database: db });
    await m.read(['text']);

    const m2 = await ORM.factory(TestModel, 2, { database: db, columns: ['text'] });

    expect(TestModel.tableName).toBe('testmodels');
    expect(m.text).toBe('Hello');
    expect(m2.text).toBe('Foo');
  });

  it('belongsTo', async () => {
    await db.query('INSERT INTO persons (id, first_name, last_name) VALUES ($1, $2, $3)', [1, 'Peter', 'Pan']);
    await db.query('INSERT INTO addresses (id, person_id, address1) VALUES ($1, $2, $3)', [1, 1, 'Planet X']);

    const Address = await ORM.import('Address');
    const Person = await ORM.import('Person');

    const peter = new Person(1, { database: db });
    await peter.read(['first_name']);
    expect(peter.first_name).toBe('Peter');

    const home = new Address(1, { database: db });
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
  });

  it('belongsToMany', async () => {
    await db.query('INSERT INTO products (id, name) VALUES ($1, $2)', [1, 'bar']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [1, 'foo']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [2, 'tar']);
    await db.query('INSERT INTO product_tags (product_id, tag_id, weight) VALUES ($1, $2, $3)', [1, 1, 0]);
    await db.query('INSERT INTO product_tags (product_id, tag_id, weight) VALUES ($1, $2, $3)', [1, 2, 1]);

    const Product = await ORM.import('Product');
    const Tag = await ORM.import('Tag');

    const product = await ORM.factory(Product, 1, { database: db });

    expect(product.name).toBe('bar');
    const tags = await product.siblings(Tag);

    expect(tags[0].name).toBe('foo');
    expect(tags[1].name).toBe('tar');
  });

  it('ORM get all from model', async () => {
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [1, 'foo']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [2, 'tar']);

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
  });

  it('write update', async () => {
    await db.query('INSERT INTO persons (id, first_name, last_name) VALUES ($1, $2, $3)', [1, 'Peter', 'Pan']);

    const Person = await ORM.import('Person');

    const peter = await ORM.factory(Person, 1, { database: db, columns: ['first_name', 'last_name'] });
    peter.last_name = 'Panther';
    await peter.write();

    const results = await db.query('SELECT last_name FROM persons WHERE id = $1', [1]);
    expect(results[0].last_name).toBe('Panther');
  });

  it('create new record', async () => {
    const Person = await ORM.import('Person');
    const alice = ORM.create(Person, { database: db });
    alice.first_name = 'Alice';
    alice.last_name = 'Lee';
    await alice.write();

    const results = await db.query('SELECT * FROM persons WHERE first_name = $1', ['Alice']);
    expect(results[0].last_name).toBe('Lee');
  });

  it('add belongsToMany', async () => {
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
    await product.write();

    const result1 = await db.query('SELECT * FROM product_tags WHERE product_id = $1', [product.id]);
    expect(result1.length).toBe(1);

    await product.add(tagB);
    await product.write();
    const result2 = await db.query('SELECT * FROM product_tags WHERE product_id = $1', [product.id]);
    expect(result2.length).toBe(2);
  });

  it('remove belongsToMany', async () => {
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

    const result1 = await db.query('SELECT * FROM product_tags WHERE product_id = $1', [product.id]);
    expect(result1.length).toBe(1);

    await product.remove(tagA);
    await product.write();
    const result2 = await db.query('SELECT * FROM product_tags WHERE product_id = $1', [product.id]);
    expect(result2.length).toBe(0);
  });

  it('delete', async () => {
    const Product = await ORM.import('Product');
    const product = new Product(null, { database: db });
    product.name = 'milk';
    await product.write();

    const result1 = await db.query('SELECT * FROM products', []);
    expect(result1.length).toBe(1);

    await product.delete();
    const result2 = await db.query('SELECT * FROM products', []);
    expect(result2.length).toBe(0);
  });

  it('delete unsaved object', async () => {
    const Product = await ORM.import('Product');
    const product = new Product(null, { database: db });
    try {
      await product.delete();
      expect('this line should not exec').toBe('');
    } catch (e) {
      expect(e.message).toBe('ORM delete Error, no id defined');
    }
  });

  it('ORM read fail', async () => {
    await db.query('INSERT INTO persons (id, first_name, last_name) VALUES ($1, $2, $3)', [1, 'Peter', 'Pan']);

    const Person = await ORM.import('Person');
    const a = new Person(1000, { database: db });

    try {
      await a.read(['id']);
      expect('this line should not be loaded').toBe(false);
    } catch (e) {
      expect(e.message).toBe('Record not found. Person id:1000');
    }

    expect(a.created_at).toBe(null);
  });

  it('ORM boolean handling', async () => {
    const Person = await ORM.import('Person');
    const p = ORM.create(Person, { database: db });
    p.enable = true;
    p.first_name = 'Test';
    await p.write();

    const r = await ORM.factory(Person, p.id, { database: db, columns: ['enable'] });
    expect(r.enable).toBe(true);

    const p2 = ORM.create(Person, { database: db });
    p2.enable = false;
    p2.first_name = 'Test2';
    await p2.write();

    const r2 = await ORM.factory(Person, p2.id, { database: db, columns: ['enable'] });
    expect(r2.enable).toBe(false);
  });

  it('ORM count all from model', async () => {
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [1, 'foo']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [2, 'tar']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [3, 'sha']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [4, 'lar']);
    await db.query('INSERT INTO tags (id, name) VALUES ($1, $2)', [5, 'foo']);

    const Tag = await ORM.import('Tag');
    const count = await ORM.countAll(Tag, { database: db });
    expect(count).toBe(5);

    const count2 = await ORM.countAll(Tag, { database: db, kv: new Map([['name', 'foo']]) });
    expect(count2).toBe(2);

    const count2b = await ORM.countBy(Tag, 'name', ['foo'], { database: db });
    expect(count2b).toBe(2);

    const count3 = await ORM.countBy(Tag, 'name', ['foo', 'tar'], { database: db });
    expect(count3).toBe(3);

    const count4 = await ORM.countWith(Tag, [['', 'name', 'EQUAL', 'foo']], { database: db });
    expect(count4).toBe(2);
  });
});
