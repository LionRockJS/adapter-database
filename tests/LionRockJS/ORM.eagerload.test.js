import { beforeEach, afterEach, describe, it, expect } from 'bun:test';

import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
import {Database} from 'bun:sqlite';
import { Central, ORM, Model } from '@lionrockjs/central';
import ORMAdapterSQLite from '../../classes/adapter/orm/SQLite.mjs';
Model.defaultAdapter = ORMAdapterSQLite;

class Product extends Model {
  name = null;

  static joinTablePrefix = 'product';

  static tableName = 'products';

  static fields = new Map([
    ['name', 'String'],
  ]);

  static hasMany = [
    ['product_id', 'Variant'],
  ];

  static belongsToMany = new Set([
    'Tag',
  ]);
}

class Variant extends Model {
  product_id = null;

  price = 0;

  static joinTablePrefix = 'variant';

  static tableName = 'variants';

  static fields = new Map([
    ['price', 'Float!'],
  ]);

  static belongsTo = new Map([
    ['product_id', 'Product'],
  ]);

  static hasMany = [
    ['variant_id', 'Inventory'],
  ];
}

class Inventory extends Model {
  variant_id = null;

  quantity = 0;

  static joinTablePrefix = 'inventory';

  static tableName = 'inventories';

  static fields = new Map([
    ['quantity', 'Int!'],
  ]);

  static belongsTo = new Map([
    ['variant_id', 'Variant'],
  ]);
}

class Collection extends Model {
  name = null;

  static joinTablePrefix = 'collection';

  static tableName = 'collections';

  static fields = new Map([
    ['name', 'String'],
  ]);

  static belongsToMany = new Set([
    'Product',
  ]);
}

describe('orm test', () => {
  beforeEach(async () => {
    await Central.init({
      EXE_PATH: `${__dirname}/test18`,
    });
  });

  afterEach(async () => {
  });

  const db = new Database(':memory:');
  db.exec(`CREATE TABLE products(
id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
name TEXT);

CREATE TRIGGER products AFTER UPDATE ON products WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;`);

  db.exec(`CREATE TABLE variants(
    id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    available BOOLEAN DEFAULT TRUE NOT NULL ,
    price REAL DEFAULT 0 NOT NULL ,
    product_id INTEGER ,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);
CREATE TRIGGER variants_updated_at AFTER UPDATE ON variants WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
    UPDATE variants SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;`);

  db.exec(`CREATE TABLE inventories(
    id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    quantity INTEGER DEFAULT 0 NOT NULL ,
    variant_id INTEGER ,
    FOREIGN KEY (variant_id) REFERENCES variants (id) ON DELETE CASCADE
);
CREATE TRIGGER inventories_updated_at AFTER UPDATE ON inventories WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
    UPDATE inventories SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;`);

  db.exec(`CREATE TABLE tags(
    id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    name TEXT UNIQUE NOT NULL
);
CREATE TRIGGER tags_updated_at AFTER UPDATE ON tags WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;`);

  db.exec(`CREATE TABLE product_tags(
    product_id INTEGER NOT NULL ,
    tag_id INTEGER NOT NULL ,
    weight REAL ,
    UNIQUE(product_id, tag_id) ,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);`);

  db.exec(`CREATE TABLE collections(
    id INTEGER UNIQUE DEFAULT ((( strftime('%s','now') - 1563741060 ) * 100000) + (RANDOM() & 65535)) NOT NULL ,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ,
    name TEXT
);
CREATE TRIGGER collections_updated_at AFTER UPDATE ON collections WHEN old.updated_at < CURRENT_TIMESTAMP BEGIN
    UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;
CREATE TABLE collection_products(
    collection_id INTEGER NOT NULL ,
    product_id INTEGER NOT NULL ,
    weight REAL ,
    UNIQUE(collection_id, product_id) ,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE ,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);
`);

  beforeEach(() => {
    Central.init({
      EXE_PATH: `${__dirname}`,
      APP_PATH : `${__dirname}/orm/application`,
    })
    Central.classPath.set('model/Product.mjs', Product);
    Central.classPath.set('model/Variant.mjs', Variant);
    Central.classPath.set('model/Inventory.mjs', Inventory);
    Central.classPath.set('model/Collection.mjs', Collection);

    db.prepare('INSERT INTO products (id, name) VALUES (?, ?);').run(1, 'Foo');
    db.prepare('INSERT INTO products (id, name) VALUES (?, ?);').run(2, 'Tar');
    db.prepare('INSERT INTO products (id, name) VALUES (?, ?);').run(3, 'Sar');
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(1, 100, 1);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(2, 200, 1);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(3, 300, 1);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(4, 110, 2);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(5, 210, 2);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(6, 310, 2);
    db.prepare('INSERT INTO variants (id, price, product_id) VALUES (?, ?, ?);').run(7, 999, 3);
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?);').run(1, 'best seller');
    db.prepare('INSERT INTO collection_products (collection_id, product_id) VALUES (?, ?);').run(1, 1);
    db.prepare('INSERT INTO collection_products (collection_id, product_id) VALUES (?, ?);').run(1, 3);
  });

  afterEach(() => {
    db.exec('DELETE FROM products;');
    db.exec('DELETE FROM variants;');
    db.exec('DELETE FROM inventories;');
    db.exec('DELETE FROM tags;');
    db.exec('DELETE FROM product_tags;');
    db.exec('DELETE FROM collections;');
    db.exec('DELETE FROM collection_products;');
  });

  it('orm setup', async () => {
    const p = await ORM.factory(Product, 1, { database: db});
    expect(p.name).toBe('Foo');
  });

  it('eager load one level', async () => {
    const collection = await ORM.factory(Collection, 1, { database: db });
    expect(collection.products).toBe(undefined);

    await collection.eagerLoad({
      with: ['Product'],
      products: {
        with: ['Variant'],
        variants: {
          with: null,
        },
      },
    });

    expect(collection.products[0].name).toBe('Foo');

    const c2 = await ORM.factory(Collection, 1, { database: db });
    await c2.eagerLoad({
      products: {
        with: null,
        variants: {
          with: null,
        },
      },
    });

    expect(c2.products).toBe(undefined);
  });

  it('empty options', async () => {
    const collection = await ORM.factory(Collection, 1, { database: db });
    await collection.eagerLoad();
    expect(collection.products).toBe(undefined);
  });

  it('parent', async () => {
    const variant = await ORM.factory(Variant, 1, { database: db, columns:['id', 'product_id','price'] });
    expect(variant.price).toBe(100);
    await variant.eagerLoad({
      with: ['Product'],
      product: { with: null},
      columns: ['id', 'name'],
    });
    expect(variant.product.name).toBe('Foo');
  });

  it('count', async () => {
    const variants = await ORM.countAll(Variant, { database: db });
    expect(variants).toBe(7);
  });
});
