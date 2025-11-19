import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import DatabaseAdapter from '../classes/adapter/database/BunSqlite.mjs';
import { Database } from "bun:sqlite";
const db = new Database('/Users/colin/Documents/code/frameworks/lionrockjs/adapter/database/bun/tests/db/empty.sqlite', {readwrite: true, create: false} )

//const db = await DatabaseAdapter.create(`${__dirname}/db/empty.sqlite`);
//console.log("Database opened:", db.database);