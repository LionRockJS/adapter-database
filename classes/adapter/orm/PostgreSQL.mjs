import { ORMAdapter, Central } from '@lionrockjs/central';

export default class ORMAdapterPostgreSQL extends ORMAdapter {
  static OP = Object.assign(
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
  static quoteColumn(col) {
    return `"${col}"`;
  }

  static quoteColumns(columns) {
    return columns.map(col => this.quoteColumn(col));
  }

  static resetPlaceholder() {
    this.placeholderIndex = 0;
  }

  static nextPlaceholder() {
    this.placeholderIndex++;
    return `$${this.placeholderIndex}`;
  }

  static op(operator, placeHolder = false) {
    if (operator === '') return '';
    if (typeof operator === 'function') return operator();
    if (Array.isArray(operator)) return operator[0];

    if (placeHolder) return this.nextPlaceholder();
    const OP = ORMAdapterPostgreSQL.OP[operator];
    if (OP === undefined) {
      return (typeof operator === 'string') ? `'${operator}'` : operator;
    }

    return OP;
  }

  static formatCriteria(criteria) {
    if (!Array.isArray(criteria[0])) throw new Error('criteria must group by array.');
    this.resetPlaceholder();
    return criteria.map(
      (x, i) => `${(i === 0) ? '' : this.op(x[0] || '')} ${x[1] ? this.quoteColumn(x[1]) : ''} ${this.op(x[2] || '')} ${this.op(x[3] || '', true)} `,
    ).join("");
  }

  static translateValues(values = []) {
    return values.map(x => {
      if (x === null) return null;
      // PostgreSQL has native boolean support
      if (typeof x === 'boolean') return x;
      if (typeof x === 'object') return JSON.stringify(x);
      if (typeof x === 'function') return JSON.stringify(x());
      return x;
    });
  }

  static getWheresAndWhereValueFromCriteria(criteria = [[]]) {
    const wheres = this.formatCriteria(criteria);
    const whereValues = [];
    criteria.forEach(v => {
      let nv = v[3];
      if (nv === 'TRUE') nv = true;
      if (nv === 'FALSE') nv = false;
      if (nv === undefined) return;
      if (typeof nv === 'function') return;
      if (Array.isArray(nv)) {
        if (nv[1] !== undefined) {
          if (Array.isArray(nv[1])) {
            nv[1].forEach(it => whereValues.push(it));
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

  static getOrderByStatement(orderBy, startIndex = 1) {
    Array.from(orderBy).forEach(kv => {
      if (!/[a-z0-9_:$.]+/.test(kv[0].toLowerCase())) {
        throw new Error(`Invalid order by key: ${kv[0]}. Use alphanumeric characters and underscores only.`);
      }

      if (!/asc|desc/.test(kv[1].toLowerCase())) {
        throw new Error(`Invalid order by value: ${kv[1]}. Use 'ASC' or 'DESC' instead.`);
      }
    });

    const values = [];
    let placeholderIdx = startIndex;
    const statements = Array.from(orderBy).map(kv => {
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
  static generatePlaceholders(count, startIndex = 1) {
    return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(', ');
  }

  static async getRow(database, sql, values) {
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

  static async getRows(database, sql, values) {
    try {
      return await database.query(sql, this.translateValues(values));
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
      return [];
    }
  }

  static async run(database, sql, values) {
    try {
      return await database.query(sql, this.translateValues(values));
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async read(columns = ['id', 'name']) {
    const sql = `SELECT ${this.constructor.quoteColumns(columns).join(', ')} FROM ${this.tableName} WHERE id = $1`;
    return this.constructor.getRow(this.database, sql, [this.client.id]);
  }

  async update(values) {
    const columns = this.client.getColumns();
    const setClause = columns.map((x, i) => `${this.constructor.quoteColumn(x)} = $${i + 1}`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${columns.length + 1}`;
    try {
      return this.constructor.run(this.database, sql, [...values, this.client.id]);
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async insert(values) {
    const columns = this.client.getColumns();
    const placeholders = this.constructor.generatePlaceholders(columns.length + 1);
    const sql = `INSERT INTO ${this.tableName} (${this.constructor.quoteColumns(columns).join(', ')}, id) VALUES (${placeholders})`;
    try {
      return this.constructor.run(this.database, sql, [...values, this.client.id]);
    } catch (e) {
      Central.log(e);
      Central.log(sql);
      Central.log(values);
    }
  }

  async delete() {
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE id = $1`, [this.client.id]);
  }

  async hasMany(tableName, key) {
    return this.constructor.getRows(this.database, `SELECT * FROM ${tableName} WHERE ${key} = $1`, [this.client.id]);
  }

  async belongsToMany(modelTableName, jointTableName, lk, fk) {
    const sql = `SELECT ${modelTableName}.* FROM ${modelTableName} JOIN ${jointTableName} ON ${modelTableName}.id = ${jointTableName}.${fk} WHERE ${jointTableName}.${lk} = $1 ORDER BY ${jointTableName}.weight`;
    return this.constructor.getRows(this.database, sql, [this.client.id]);
  }

  async add(models, weight, jointTableName, lk, fk) {
    const ids = models.map(x => x.id);
    const values = models.map((x, i) => {
      const idx = i + 1;
      return `(${this.client.id}, $${idx}, ${weight + (i * 0.000001)})`;
    });
    // PostgreSQL: ON CONFLICT DO NOTHING instead of INSERT OR IGNORE
    return this.constructor.run(
      this.database,
      `INSERT INTO ${jointTableName} (${lk}, ${fk}, weight) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
      ids
    );
  }

  async remove(models, jointTableName, lk, fk) {
    const ids = models.map(x => x.id);
    const placeholders = this.constructor.generatePlaceholders(ids.length);
    const sql = `DELETE FROM ${jointTableName} WHERE ${lk} = ${this.client.id} AND ${fk} IN (${placeholders})`;
    return this.constructor.run(this.database, sql, ids);
  }

  async removeAll(jointTableName, lk) {
    return this.constructor.run(this.database, `DELETE FROM ${jointTableName} WHERE ${lk} = $1`, [this.client.id]);
  }

  async readResult(limit, columns, where, values) {
    const sqlSelect = `SELECT ${this.constructor.quoteColumns(columns).join(', ')} FROM ${this.tableName} `;
    const sql = sqlSelect + where;

    if (limit === 1) {
      const result = await this.constructor.getRow(this.database, sql, [...values]);
      return result ? [result] : [];
    }

    return this.constructor.getRows(this.database, sql, [...values]);
  }

  async readAll(kv, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy);

    if (kv) {
      const keys = Array.from(kv.keys());
      const whereClause = keys.map((k, i) => `${this.constructor.quoteColumn(k)} = $${i + 1}`).join(' AND ');
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

  async readBy(key, values, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    if (!values || values.length === 0) return [];
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
    const placeholders = this.constructor.generatePlaceholders(values.length);
    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;
    return this.readResult(
      limit,
      columns,
      `WHERE ${this.constructor.quoteColumn(key)} IN (${placeholders})${statementOrderBy.statement} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      [...values, ...statementOrderBy.values, limit, offset]
    );
  }

  async readWith(criteria, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy, whereValues.length + 1);
    const limitPlaceholder = `$${whereValues.length + statementOrderBy.values.length + 1}`;
    const offsetPlaceholder = `$${whereValues.length + statementOrderBy.values.length + 2}`;
    return this.readResult(
      limit,
      columns,
      `WHERE ${wheres} ${statementOrderBy.statement} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      [...whereValues, ...statementOrderBy.values, limit, offset]
    );
  }

  async countAll(kv = null) {
    let sql, v;
    if (kv) {
      const keys = Array.from(kv.keys());
      const whereClause = keys.map((k, i) => `${this.constructor.quoteColumn(k)} = $${i + 1}`).join(' AND ');
      sql = `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${whereClause}`;
      v = Array.from(kv.values());
    } else {
      sql = `SELECT COUNT(id) as count FROM ${this.tableName}`;
      v = [];
    }
    const result = await this.constructor.getRow(this.database, sql, v);
    return Number(result?.count) || 0;
  }

  async countBy(key, values) {
    if (!values || values.length === 0) return 0;
    const placeholders = this.constructor.generatePlaceholders(values.length);
    const result = await this.constructor.getRow(
      this.database,
      `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${this.constructor.quoteColumn(key)} IN (${placeholders})`,
      values
    );
    return Number(result?.count) || 0;
  }

  async countWith(criteria) {
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    const result = await this.constructor.getRow(
      this.database,
      `SELECT COUNT(id) as count FROM ${this.tableName} WHERE ${wheres}`,
      whereValues
    );
    return Number(result?.count) || 0;
  }

  async deleteAll(kv = null) {
    if (!kv) return this.constructor.run(this.database, `DELETE FROM ${this.tableName}`, []);
    const keys = Array.from(kv.keys());
    const whereClause = keys.map((k, i) => `${this.constructor.quoteColumn(k)} = $${i + 1}`).join(' AND ');
    return this.constructor.run(
      this.database,
      `DELETE FROM ${this.tableName} WHERE ${whereClause}`,
      Array.from(kv.values())
    );
  }

  async deleteBy(key, values) {
    if (!values || values.length === 0) return;
    const placeholders = this.constructor.generatePlaceholders(values.length);
    return this.constructor.run(
      this.database,
      `DELETE FROM ${this.tableName} WHERE ${this.constructor.quoteColumn(key)} IN (${placeholders})`,
      values
    );
  }

  async deleteWith(criteria) {
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${wheres}`, whereValues);
  }

  async updateAll(kv, columnValues) {
    const keys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());
    const setClause = keys.map((key, i) => `${this.constructor.quoteColumn(key)} = $${i + 1}`).join(', ');

    if (!kv) {
      return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${setClause}`, newValues);
    }

    const kvKeys = Array.from(kv.keys());
    const whereClause = kvKeys.map((k, i) => `${this.constructor.quoteColumn(k)} = $${keys.length + i + 1}`).join(' AND ');
    return this.constructor.run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause}`,
      [...newValues, ...Array.from(kv.values())]
    );
  }

  async updateBy(key, values, columnValues) {
    if (!values || values.length === 0) return;
    const colKeys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());
    const setClause = colKeys.map((k, i) => `${this.constructor.quoteColumn(k)} = $${i + 1}`).join(', ');
    const placeholders = this.constructor.generatePlaceholders(values.length, colKeys.length + 1);
    return this.constructor.run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.constructor.quoteColumn(key)} IN (${placeholders})`,
      [...newValues, ...values]
    );
  }

  async updateWith(criteria, columnValues) {
    const keys = Array.from(columnValues.keys());
    const setClause = keys.map((key, i) => `${this.constructor.quoteColumn(key)} = $${i + 1}`).join(', ');
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);

    // Need to offset the where placeholders
    const offsetWheres = wheres.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + keys.length}`);

    return this.constructor.run(
      this.database,
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${offsetWheres}`,
      [...Array.from(columnValues.values()), ...whereValues]
    );
  }

  async insertAll(columns, valueGroups, ids = []) {
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

    return this.constructor.run(
      this.database,
      `INSERT INTO ${this.tableName} (${this.constructor.quoteColumns(columns).join(', ')}) VALUES ${strValues.join(', ')}`,
      valueGroups.flat()
    );
  }
}
