import url from "node:url";
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import DatabaseAdapter from '../classes/adapter/database/BunPostgres.mjs';

// Test connection to PostgreSQL
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/lionrock_test';
const db = DatabaseAdapter.create(TEST_DATABASE_URL);

console.log("Database connection created:", db.database !== null);