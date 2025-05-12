import { ORMAdapter, Central } from '@lionrockjs/central';

export default class ORMAdapterSQLite extends ORMAdapter {
  static OP = Object.assign(
    { EQUAL: '=',
      GREATER_THAN: '>',
      LESS_THAN: '<',
      GREATER_THAN_EQUAL: '>=',
      LESS_THAN_EQUAL: '<=',
      NOT_EQUAL: '<>',
      BETWEEN: 'BETWEEN',
      LIKE: 'LIKE',
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
    TRUE: 1,
    FALSE: 0,
  })

  static op(operator, placeHolder = false) {
    if (operator === '') return '';
    if (typeof operator === 'function')return operator();
    if (Array.isArray(operator))return operator[0];

    if (placeHolder) return '?';
    const OP = ORMAdapterSQLite.OP[operator];
    if (OP === undefined) {
      return (typeof operator === 'string') ? `'${operator}'` : operator;
    }

    return OP;
  }

  static formatCriteria(criteria) {
    if (!Array.isArray(criteria[0])) throw new Error('criteria must group by array.');
    return criteria.map(
      (x, i) => `${(i === 0) ? '' : this.op(x[0] || '')} ${x[1] || ''} ${this.op(x[2] || '')} ${this.op(x[3] || '', true)} `,
    ).join("");
  }

  static translateValues(values = []) {
    return values.map(x => {
      if (x === null) return null;
      if (typeof x === 'boolean') return x ? 1 : 0;
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
      if (nv === 'TRUE')nv = 1;
      if (nv === 'FALSE')nv = 0;
      if (nv === undefined) return;
      if (typeof nv === 'function')return;
      if (Array.isArray(nv)){
        if(nv[1] !== undefined){
          if(Array.isArray(nv[1])){
            nv[1].forEach(it => whereValues.push(it));
          }else{
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

  static getOrderByStatement(orderBy) {
    return ` ORDER BY ${Array.from(orderBy).map(kv => kv[0] + ' ' + kv[1]).join(',')}`;
  }

  static async getRow(database, sql, values) {
    try{
      return database.prepare(sql).get(...this.translateValues(values));
    }catch(e){
      Central.log(e);
      Central.log(sql);
      return null;
    }
  }

  static async getRows(database, sql, values){
    try{
      return database.prepare(sql).all(...this.translateValues(values));
    }catch(e){
      Central.log(e);
      Central.log(sql);
      return [];
    }
  }

  static async run(database, sql, values){
    try {
      return database.prepare(sql).run(...this.translateValues(values));
    }catch(e){
      Central.log(e);
      Central.log(sql);
    }
  }

  async read(columns = ['id','name']) {
    const sql = `SELECT ${columns.join(', ')} FROM ${this.tableName} WHERE id = ?`;
    return this.constructor.getRow(this.database, sql, [this.client.id]);
  }

  async update(values) {
    const columns = this.client.getColumns();
    const sql = `UPDATE ${this.tableName} SET ${columns.map(x => x + ' = ?').join(', ')} WHERE id = ?`;
    try{
      return this.constructor.run(this.database, sql, [...values, this.client.id]);
    }catch(e){
      Central.log(e);
      Central.log(sql);
    }
  }

  async insert(values) {
    const columns = this.client.getColumns();
    const sql = `INSERT OR FAIL INTO ${this.tableName} (${columns.join(', ')}, id) VALUES (?, ${columns.map(() => '?').join(', ')})`;
    try{
      return this.constructor.run(this.database, sql, [...values, this.client.id]);
    }catch(e){
      Central.log(e);
      Central.log(sql);
    }
  }

  async delete() {
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE id = ?`, [this.client.id]);
  }

  async hasMany(tableName, key) {
    return this.constructor.getRows(this.database, `SELECT * FROM ${tableName} WHERE ${key} = ?`, [this.client.id]);
  }

  async belongsToMany(modelTableName, jointTableName, lk, fk) {
    const sql = `SELECT ${modelTableName}.* FROM ${modelTableName} JOIN ${jointTableName} ON ${modelTableName}.id = ${jointTableName}.${fk} WHERE ${jointTableName}.${lk} = ? ORDER BY ${jointTableName}.weight`

    return this.constructor.getRows(this.database, sql, [this.client.id]);
  }

  async add(models, weight, jointTableName, lk, fk) {
    const ids = models.map(x => x.id);
    const values = models.map((x, i) => `(${this.client.id} , ?, ${weight + (i * 0.000001)})`);
    return this.constructor.run(this.database, `INSERT OR IGNORE INTO ${jointTableName} (${lk}, ${fk}, weight) VALUES ${values.join(', ')}`, ids);
  }

  async remove(models, jointTableName, lk, fk) {
    const ids = models.map(x => x.id);
    const sql = `DELETE FROM ${jointTableName} WHERE ${lk} = ${this.client.id} AND ${fk} IN (${ids.map(() => '?').join(', ')})`;
    return this.constructor.run(this.database, sql, ids);
  }

  async removeAll(jointTableName, lk) {
    return this.constructor.run(this.database, `DELETE FROM ${jointTableName} WHERE ${lk} = ?`, [this.client.id]);
  }

  async readResult(limit, columns, where, values) {
    const sqlSelect = `SELECT ${columns.join(', ')} FROM ${this.tableName} `;
    const sql = sqlSelect + where;

    if(limit === 1){
      const result = await this.constructor.getRow(this.database, sql, [...values]);
      return result ? [result] : [];
    }
    return this.constructor.getRows(this.database, sql,[...values]);
  }

  async readAll(kv, columns=['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy);

    return kv ?
      this.readResult(
        limit,
        columns,
        `WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}${statementOrderBy} LIMIT ${limit} OFFSET ${offset}`,
        Array.from(kv.values())
      ) :
      this.readResult(
        limit,
        columns,
        `${statementOrderBy} LIMIT ${limit} OFFSET ${offset}`,
        []
      );
  }

  async readBy(key, values, columns=['id', 'name'],  limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
    return this.readResult(limit,
      columns,
      `WHERE ${key} IN (${values.map(() => '?').join(', ')})${statementOrderBy} LIMIT ${limit} OFFSET ${offset}`,
      values
    );
  }

  async readWith(criteria, columns=['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
    const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    return this.readResult(
      limit,
      columns,
      `WHERE ${wheres} ${statementOrderBy} LIMIT ${limit} OFFSET ${offset}`,
      whereValues
    );
  }

  async countAll(kv = null) {
    const where = kv ? ` WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}` : '';
    const v = kv ? Array.from(kv.values()) : [];
    const result = await this.constructor.getRow(this.database, `SELECT COUNT(id) FROM ${this.tableName}${where}`, v);
    return result['COUNT(id)'];
  }

  async countBy(key, values) {
    const result = await this.constructor.getRow(this.database,
      `SELECT COUNT(id) FROM ${this.tableName} WHERE ${key} IN (${values.map(() => '?').join(', ')})`,
      values);
    
    return result['COUNT(id)'];
  }

  async countWith(criteria) {
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    const result = await this.constructor.getRow(this.database,
      `SELECT COUNT(id) FROM ${this.tableName} WHERE ${wheres}`,
      whereValues);

    return result['COUNT(id)'];
  }

  async deleteAll(kv = null) {
    if (!kv) return this.constructor.run(this.database, `DELETE FROM ${this.tableName}`, []);
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}`, Array.from(kv.values()))
  }

  async deleteBy(key, values) {
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${key} IN (${values.map(() => '?').join(', ')})`, values);
  }

  async deleteWith(criteria) {
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
    return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${wheres}`, whereValues);
  }

  async updateAll(kv, columnValues) {
    const keys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());

    if(!kv) return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')}`, newValues);

    return this.constructor.run( this.database,
      `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')} WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}`,
      [...newValues, ...Array.from(kv.values())]
    )
  }

  async updateBy(key, values, columnValues) {
    const keys = Array.from(columnValues.keys());
    const newValues = Array.from(columnValues.values());
    return this.constructor.run(this.database,
      `UPDATE ${this.tableName} SET ${keys.map(k => k + ' = ?')} WHERE ${key} IN (${values.map(() => '?').join(', ')})`,
      [...newValues, ...values]
    )
  }

  async updateWith(criteria, columnValues) {
    const keys = Array.from(columnValues.keys());
    const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);

    return this.constructor.run(this.database,
      `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')} WHERE ${wheres}`,
      Array.from(columnValues.values()).concat(whereValues)
    );
  }

  async insertAll(columns, valueGroups, ids=[]) {
    //check columns have id
    const hasId = columns.includes('id');
    if(!hasId){
      columns.push('id');
      valueGroups.map((it, i) => {
        it.push(ids[i] || ORMAdapterSQLite.defaultID());
        return it;
      })
    }

    //change value group values to ? for SQL
    const strValues = valueGroups.map(values => `(${values.map(() => '?').join(', ')})`);

    return this.constructor.run(
      this.database,
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES ${strValues.join(', ')}`,
      valueGroups.flat()
    )
  }
}