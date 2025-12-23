export default {
    filename: import.meta.url,
    configs: ['database']
};

import DatabaseAdapterBunPostgres from './adapter/database/BunPostgres.mjs';
import ORMAdapterPostgreSQL from './adapter/orm/PostgreSQL.mjs';

export {
  DatabaseAdapterBunPostgres,
  ORMAdapterPostgreSQL
}
