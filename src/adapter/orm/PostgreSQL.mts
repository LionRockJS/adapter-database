import { ORMAdapter, Central } from '@lionrockjs/central';

export default class ORMAdapterPostgreSQL extends ORMAdapter {
  static OP: Record<string, any> = Object.assign(
    {
      EQUAL: '=',
      GREATER_THAN: '>',
      LESS_THAN: '<',
      GREATER_THAN_EQUAL: '>=',
      LESS_THAN_EQUAL: '<=',
      NOT_EQUAL: '<>',
      BETWEEN: 'BETWEEN',
      LIKE: 'LIKE',
      ILIKE: 'ILIKE', // PostgreSQL case-insensitive LIKE
      IN: 'IN',
      AND: 'AND',
      OR: 'OR',
      TRUE: 'TRUE',
      FALSE: 'FALSE',
      BLANK: "''",
      START_GROUP: '(',
      END_GROUP: ')',
      NULL: 'NULL',
      IS_NULL: 'IS NULL'
    },
    {
      NOT_EQUAL: '!=',
      TRUE: true,
      FALSE: false,
    }
  );

  // Track placeholder index for PostgreSQL $1, $2, etc.
  static placeholderIndex = 0;

  // Quote column names to handle reserved keywords like 'start', 'end'
  static quoteColumn(col: string) {
    return `"${col}"`;
  }

  static quoteColumns(columns: string[]) {
    return columns.map(col => this.quoteColumn(col));
  }

  static resetPlaceholder() {
    this.placeholderIndex = 0;
  }

  static nextPlaceholder() {
    this.placeholderIndex++;
    return `$${this.placeholderIndex}`;
  }

  static op(operator: string | Function | any[], placeHolder = false) {
    if (operator === '') return '';
    if (typeof operator === 'function') return operator();
    if (Array.isArray(operator)) return operator[0];

    if (placeHolder) return this.nextPlaceholder();
    const OP = ORMAdapterPostgreSQL.OP[operator as string];
    if (OP === undefined) {
      return (typeof operator === 'string') ? `'${operator}'` : operator;
    }

    return OP;
  }

  static formatCriteria(criteria: any[][]) {
    if (!Array.isArray(criteria[0])) throw new Error('criteria must group by array.');
    this.resetPlaceholder();
    return criteria.map(
      (x, i) => `${(i === 0) ? '' : this.op(x[0] || '')} ${x[1] ? this.quoteColumn(x[1]) : ''} ${this.op(x[2] || '')} ${this.op(x[3] || '', true)} `,
    ).join("");
  }

  static translateValues(values: any[] = []) {
    return values.map(x => {
      if (x === null) return null;
      // PostgreSQL has native boolean support
      if (typeof x === 'boolean') return x;
      if (typeof x === 'object') return x;
      if (typeof x === 'function') return x();
      //if x start with "{"" and end with "}"
      if (typeof x === 'string' && x.startsWith('{') && x.endsWith('}')) return JSON.parse(x);
      return x;
    });
  }

  static getWheresAndWhereValueFromCriteria(criteria: any[][] = [[]]) {
    const wheres = this.formatCriteria(criteria);
    const whereValues: any[] = [];
    criteria.forEach(v => {
      let nv = v[3];
      if (nv === 'TRUE') nv = true;
      if (nv === 'FALSE') nv = false;
      if (nv === undefined) return;
      if (typeof nv === 'function') return;
      if (Array.isArray(nv)) {
        if (nv[1] !== undefined) {
          if (Array.isArray(nv[1])) {
            nv[1].forEach((it: any) => whereValues.push(it));
          } else {
            whereValues.push(nv[1]);
          }
        }
        return;
      }
      whereValues.push(nv);
    });

    return {
      wheres,
      whereValues,
    };
  }

  static getOrderByStatement(orderBy: Map<string, string> | any[], startIndex = 1) {
    Array.from(orderBy).forEach((kv: any) => {
      if (!/[a-z0-9_:$.]+/.test(kv[0].toLowerCase())) {
        throw new Error(`Invalid order by key: ${kv[0]}. Use alphanumeric characters and underscores only.`);
      }

      if (!/asc|desc/.test(kv[1].toLowerCase())) {
        throw new Error(`Invalid order by value: ${kv[1]}. Use 'ASC' or 'DESC' instead.`);
      }
    });

    const values: any[] = [];
    // let placeholderIdx = startIndex; // Unused
    const statements = Array.from(orderBy).map((kv: any) => {
      // PostgreSQL JSON: column->>'key' instead of json_extract(column, '$.key')
      if (/:\$\./.test(kv[0])) {
        const parts = kv[0].split(':');
        const jsonPath = parts[1].replace('$.', '');
        // Use ->> for text extraction from JSON
        return `${this.quoteColumn(parts[0])}->>'${jsonPath}' ${kv[1] || 'ASC'}`;
      }
      // PostgreSQL: use LOWER() for case-insensitive ordering instead of COLLATE NOCASE
      return `LOWER(${this.quoteColumn(kv[0])}::text) ${kv[1] || 'ASC'}`;
    });

    return {
      statement: ` ORDER BY ${statements.join(',')}`,
      values: values,
    };
  }

  // Helper to generate placeholders for a count starting from an index
  static generatePlaceholders(count: number, startIndex = 1) {
    return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(', ');
  }

  static async getRow(database: any, sql: string, values: any[]) {
    try {
      const results = await database.query(sql, this.translateValues(values));
      return results[0] || null;
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
      return null;
    }
  }

  static async getRows(database: any, sql: string, values: any[]) {
    try {
      return await database.query(sql, this.translateValues(values));
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
      return [];
    }
  }

  static async run(database: any, sql: string, values: any[]) {
    try {
      const translated = this.translateValues(values);
      return await database.query(sql, translated);
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async read(columns = ['id', 'name']) {
    const sql = `SELECT ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumns(columns).join(', ')} FROM ${this.tableName} WHERE id = $1`;
    return (this.constructor as typeof ORMAdapterPostgreSQL).getRow(this.database, sql, [this.client.id]);
  }

  async update(values: any[]) {
    const columns = this.client.getColumns();
    const setClause = columns.map((x: string, i: number) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(x)} = $${i + 1}`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${columns.length + 1}`;
    try {
      return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, sql, [...values, this.client.id]);
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async insert(values: any[]) {
    const columns = this.client.getColumns();
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(columns.length + 1);
    const sql = `INSERT INTO ${this.tableName} (${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumns(columns).join(', ')}, id) VALUES (${placeholders})`;
    try {
      return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, sql, [...values, this.client.id]);
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async delete() {
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, `DELETE FROM ${this.tableName} WHERE id = $1`, [this.client.id]);
  }

  async hasMany(tableName: string, key: string) {
    return (this.constructor as typeof ORMAdapterPostgreSQL).getRows(this.database, `SELECT * FROM ${tableName} WHERE ${key} = $1`, [this.client.id]);
  }

  async belongsToMany(modelTableName: string, jointTableName: string, lk: string, fk: string) {
    const sql = `SELECT ${modelTableName}.* FROM ${modelTableName} JOIN ${jointTableName} ON ${modelTableName}.id = ${jointTableName}.${fk} WHERE ${jointTableName}.${lk} = $1 ORDER BY ${jointTableName}.weight`;
    return (this.constructor as typeof ORMAdapterPostgreSQL).getRows(this.database, sql, [this.client.id]);
  }

  async add(models: any[], weight: number, jointTableName: string, lk: string, fk: string) {
    const ids = models.map(x => x.id);
    const values = models.map((x, i) => {
      const idx = i + 1;
      return `(${this.client.id}, $${idx}, ${weight + (i * 0.000001)})`;
    });
    // PostgreSQL: ON CONFLICT DO NOTHING instead of INSERT OR IGNORE
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `INSERT INTO ${jointTableName} (${lk}, ${fk}, weight) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
      ids
    );
  }

  async remove(models: any[], jointTableName: string, lk: string, fk: string) {
    const ids = models.map(x => x.id);
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(ids.length);
    const sql = `DELETE FROM ${jointTableName} WHERE ${lk} = ${this.client.id} AND ${fk} IN (${placeholders})`;
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, sql, ids);
  }

  async removeAll(jointTableName: string, lk: string) {
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, `DELETE FROM ${jointTableName} WHERE ${lk} = $1`, [this.client.id]);
  }

  async readResult(limit: number, columns: string[], where: string, values: any[]) {
    const sqlSelect = `SELECT ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumns(columns).join(', ')} FROM ${this.tableName} `;
    const sql = sqlSelect + where;

    if (limit === 1) {
      const result = await (this.constructor as typeof ORMAdapterPostgreSQL).getRow(this.database, sql, [...values]);
      return result ? [result] : [];
    }

    return (this.constructor as typeof ORMAdapterPostgreSQL).getRows(this.database, sql, [...values]);
  }

  async readAll(kv: Map<string, any> | null, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const statementOrderBy = (this.constructor as typeof ORMAdapterPostgreSQL).getOrderByStatement(orderBy);

    if (kv) {
      const keys = Array.from(kv.keys());
      const whereClause = keys.map((k, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(k)} = $${i + 1}`).join(' AND ');
      const limitPlaceholder = `$${keys.length + 1}`;
      const offsetPlaceholder = `$${keys.length + 2}`;
      return this.readResult(
        limit,
        columns,
        `WHERE ${whereClause}${statementOrderBy.statement} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
        [...Array.from(kv.values()), ...statementOrderBy.values, limit, offset]
      );
    }

    return this.readResult(
      limit,
      columns,
      `${statementOrderBy.statement} LIMIT $1 OFFSET $2`,
      [...statementOrderBy.values, limit, offset]
    );
  }

  async readBy(key: string, values: any[], columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    if (!values || values.length === 0) return [];
    const statementOrderBy = (this.constructor as typeof ORMAdapterPostgreSQL).getOrderByStatement(orderBy);
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(values.length);
    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;
    return this.readResult(
      limit,
      columns,
      `WHERE ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} IN (${placeholders})${statementOrderBy.statement} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      [...values, ...statementOrderBy.values, limit, offset]
    );
  }

  async readWith(criteria: any[][], columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const { wheres, whereValues } = (this.constructor as typeof ORMAdapterPostgreSQL).getWheresAndWhereValueFromCriteria(criteria);
    const statementOrderBy = (this.constructor as typeof ORMAdapterPostgreSQL).getOrderByStatement(orderBy, whereValues.length + 1);
    const limitPlaceholder = `$${whereValues.length + statementOrderBy.values.length + 1}`;
    const offsetPlaceholder = `$${whereValues.length + statementOrderBy.values.length + 2}`;
    return this.readResult(
      limit,
      columns,
      `WHERE ${wheres} ${statementOrderBy.statement} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      [...whereValues, ...statementOrderBy.values, limit, offset]
    );
  }

  async countAll(kv: Map<string, any> | null = null) {
    let sql, v;
    if (kv) {
      const keys = Array.from(kv.keys());
      const whereClause = keys.map((k, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(k)} = $${i + 1}`).join(' AND ');
      sql = `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${whereClause}`;
      v = Array.from(kv.values());
    } else {
      sql = `SELECT COUNT(id) as count FROM ${this.tableName}`;
      v = [];
    }
    const result = await (this.constructor as typeof ORMAdapterPostgreSQL).getRow(this.database, sql, v);
    return Number(result?.count) || 0;
  }

  async countBy(key: string, values: any[]) {
    if (!values || values.length === 0) return 0;
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(values.length);
    const result = await (this.constructor as typeof ORMAdapterPostgreSQL).getRow(
      this.database,
      `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} IN (${placeholders})`,
      values
    );
    return Number(result?.count) || 0;
  }

  async countWith(criteria: any[][]) {
    const { wheres, whereValues } = (this.constructor as typeof ORMAdapterPostgreSQL).getWheresAndWhereValueFromCriteria(criteria);
    const result = await (this.constructor as typeof ORMAdapterPostgreSQL).getRow(
      this.database,
      `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${wheres}`,
      whereValues
    );
    return Number(result?.count) || 0;
  }

  async deleteAll(kv: Map<string, any> | null = null) {
    if (!kv) return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, `DELETE FROM ${this.tableName}`, []);
    const keys = Array.from(kv.keys());
    const whereClause = keys.map((k, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(k)} = $${i + 1}`).join(' AND ');
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `DELETE FROM ${this.tableName} WHERE ${whereClause}`,
      Array.from(kv.values())
    );
  }

  async deleteBy(key: string, values: any[]) {
    if (!values || values.length === 0) return;
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(values.length);
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `DELETE FROM ${this.tableName} WHERE ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} IN (${placeholders})`,
      values
    );
  }

  async deleteWith(criteria: any[][]) {
    const { wheres, whereValues } = (this.constructor as typeof ORMAdapterPostgreSQL).getWheresAndWhereValueFromCriteria(criteria);
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, `DELETE FROM ${this.tableName} WHERE ${wheres}`, whereValues);
  }

  async updateAll(kv: Map<string, any> | null, columnValues: Map<string, any>) {
    const keys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());
    const setClause = keys.map((key, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} = $${i + 1}`).join(', ');

    if (!kv) {
      return (this.constructor as typeof ORMAdapterPostgreSQL).run(this.database, `UPDATE ${this.tableName} SET ${setClause}`, newValues);
    }

    const kvKeys = Array.from(kv.keys());
    const whereClause = kvKeys.map((k, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(k)} = $${keys.length + i + 1}`).join(' AND ');
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause}`,
      [...newValues, ...Array.from(kv.values())]
    );
  }

  async updateBy(key: string, values: any[], columnValues: Map<string, any>) {
    if (!values || values.length === 0) return;
    const colKeys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());
    const setClause = colKeys.map((k, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(k)} = $${i + 1}`).join(', ');
    const placeholders = (this.constructor as typeof ORMAdapterPostgreSQL).generatePlaceholders(values.length, colKeys.length + 1);
    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} IN (${placeholders})`,
      [...newValues, ...values]
    );
  }

  async updateWith(criteria: any[][], columnValues: Map<string, any>) {
    const keys = Array.from(columnValues.keys());
    const setClause = keys.map((key, i) => `${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumn(key)} = $${i + 1}`).join(', ');
    const { wheres, whereValues } = (this.constructor as typeof ORMAdapterPostgreSQL).getWheresAndWhereValueFromCriteria(criteria);

    // Need to offset the where placeholders
    const offsetWheres = wheres.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + keys.length}`);

    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${offsetWheres}`,
      [...Array.from(columnValues.values()), ...whereValues]
    );
  }

  async insertAll(columns: string[], valueGroups: any[][], ids: any[] = []) {
    // Check columns have id
    const hasId = columns.includes('id');
    if (!hasId) {
      columns.push('id');
      valueGroups.map((it, i) => {
        it.push(ids[i] || ORMAdapterPostgreSQL.defaultID());
        return it;
      });
    }

    // Build values with proper PostgreSQL placeholders
    let placeholderIdx = 1;
    const strValues = valueGroups.map(values => {
      const placeholders = values.map(() => `$${placeholderIdx++}`).join(', ');
      return `(${placeholders})`;
    });

    return (this.constructor as typeof ORMAdapterPostgreSQL).run(
      this.database,
      `INSERT INTO ${this.tableName} (${(this.constructor as typeof ORMAdapterPostgreSQL).quoteColumns(columns).join(', ')}) VALUES ${strValues.join(', ')}`,
      valueGroups.flat()
    );
  }
}
