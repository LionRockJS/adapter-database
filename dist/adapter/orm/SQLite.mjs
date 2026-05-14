import { ORMAdapter, Central } from '@lionrockjs/central';
export default class ORMAdapterSQLite extends ORMAdapter {
    static OP = Object.assign({ EQUAL: '=',
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
    }, {
        NOT_EQUAL: '!=',
        TRUE: 1,
        FALSE: 0,
    });
    static op(operator, placeHolder = false) {
        if (operator === '')
            return '';
        if (typeof operator === 'function')
            return operator();
        if (Array.isArray(operator))
            return operator[0];
        if (placeHolder)
            return '?';
        const OP = ORMAdapterSQLite.OP[operator];
        if (OP === undefined) {
            return (typeof operator === 'string') ? `'${operator}'` : operator;
        }
        return OP;
    }
    static formatCriteria(criteria) {
        if (!Array.isArray(criteria[0]))
            throw new Error('criteria must group by array.');
        return criteria.map((x, i) => `${(i === 0) ? '' : this.op(x[0] || '')} ${x[1] || ''} ${this.op(x[2] || '')} ${this.op(x[3] || '', true)} `).join("");
    }
    static translateValues(values = []) {
        return values.map(x => {
            if (x === null)
                return null;
            if (typeof x === 'boolean')
                return x ? 1 : 0;
            if (typeof x === 'object')
                return JSON.stringify(x);
            if (typeof x === 'function')
                return JSON.stringify(x());
            return x;
        });
    }
    static getWheresAndWhereValueFromCriteria(criteria = [[]]) {
        const wheres = this.formatCriteria(criteria);
        const whereValues = [];
        criteria.forEach(v => {
            let nv = v[3];
            if (nv === 'TRUE')
                nv = 1;
            if (nv === 'FALSE')
                nv = 0;
            if (nv === undefined)
                return;
            if (typeof nv === 'function')
                return;
            if (Array.isArray(nv)) {
                if (nv[1] !== undefined) {
                    if (Array.isArray(nv[1])) {
                        nv[1].forEach(it => whereValues.push(it));
                    }
                    else {
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
        Array.from(orderBy).forEach(kv => {
            if (!/[a-z0-9_:$.]+/.test(kv[0].toLowerCase())) {
                throw new Error(`Invalid order by key: ${kv[0]}. Use alphanumeric characters and underscores only.`);
            }
            if (!/asc|desc/.test(kv[1].toLowerCase())) {
                throw new Error(`Invalid order by value: ${kv[1]}. Use 'ASC' or 'DESC' instead.`);
            }
        });
        const values = [];
        const statements = Array.from(orderBy).map(kv => {
            if (/:\$\./.test(kv[0])) {
                const parts = kv[0].split(':');
                values.push(parts[1]);
                return `json_extract(${parts[0]}, ?) COLLATE NOCASE ${kv[1] || 'ASC'}`;
            }
            return `${kv[0]} COLLATE NOCASE ${kv[1] || 'ASC'}`;
        });
        return {
            statement: ` ORDER BY ${statements.join(',')}`,
            values: values,
        };
    }
    static async getRow(database, sql, values) {
        try {
            // @ts-ignore
            return database.prepare(sql).get(this.translateValues(values));
        }
        catch (e) {
            Central.log(e);
            Central.log(sql);
            Central.log(values);
            return null;
        }
    }
    static async getRows(database, sql, values) {
        try {
            // @ts-ignore
            return database.prepare(sql).all(this.translateValues(values));
        }
        catch (e) {
            Central.log(e);
            Central.log(sql);
            Central.log(values);
            return [];
        }
    }
    static async run(database, sql, values) {
        try {
            // @ts-ignore
            return database.prepare(sql).run(this.translateValues(values));
        }
        catch (e) {
            Central.log(e);
            Central.log(sql);
            Central.log(values);
            throw e;
        }
    }
    async read(columns = ['id', 'name']) {
        const sql = `SELECT ${columns.join(', ')} FROM ${this.tableName} WHERE id = ?`;
        // @ts-ignore
        return this.constructor.getRow(this.database, sql, [this.client.id]);
    }
    async update(values) {
        const columns = this.client.getColumns();
        const sql = `UPDATE ${this.tableName} SET ${columns.map((x) => x + ' = ?').join(', ')} WHERE id = ?`;
        try {
            // @ts-ignore
            return this.constructor.run(this.database, sql, [...values, this.client.id]);
        }
        catch (e) {
            Central.log(e);
            Central.log(sql);
            Central.log(values);
        }
    }
    async insert(values) {
        const columns = this.client.getColumns();
        const sql = `INSERT OR FAIL INTO ${this.tableName} (${columns.join(', ')}, id) VALUES (?, ${columns.map(() => '?').join(', ')})`;
        try {
            // @ts-ignore
            return this.constructor.run(this.database, sql, [...values, this.client.id]);
        }
        catch (e) {
            Central.log(e);
            Central.log(sql);
            Central.log(values);
        }
    }
    async delete() {
        this.database.run('PRAGMA foreign_keys = ON;');
        // @ts-ignore
        return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE id = ?`, [this.client.id]);
    }
    async hasMany(tableName, key) {
        // @ts-ignore
        return this.constructor.getRows(this.database, `SELECT * FROM ${tableName} WHERE ${key} = ?`, [this.client.id]);
    }
    async belongsToMany(modelTableName, jointTableName, lk, fk) {
        const sql = `SELECT ${modelTableName}.* FROM ${modelTableName} JOIN ${jointTableName} ON ${modelTableName}.id = ${jointTableName}.${fk} WHERE ${jointTableName}.${lk} = ? ORDER BY ${jointTableName}.weight`;
        // @ts-ignore
        return this.constructor.getRows(this.database, sql, [this.client.id]);
    }
    async add(models, weight, jointTableName, lk, fk) {
        const ids = models.map(x => x.id);
        const values = models.map((x, i) => `(${this.client.id} , ?, ${weight + (i * 0.000001)})`);
        // @ts-ignore
        return this.constructor.run(this.database, `INSERT OR IGNORE INTO ${jointTableName} (${lk}, ${fk}, weight) VALUES ${values.join(', ')}`, ids);
    }
    async remove(models, jointTableName, lk, fk) {
        const ids = models.map(x => x.id);
        const sql = `DELETE FROM ${jointTableName} WHERE ${lk} = ${this.client.id} AND ${fk} IN (${ids.map(() => '?').join(', ')})`;
        // @ts-ignore
        return this.constructor.run(this.database, sql, ids);
    }
    async removeAll(jointTableName, lk) {
        Central.log('Removing all from ' + jointTableName + ' lk: ' + lk + ' id: ' + this.client.id);
        // @ts-ignore
        return this.constructor.run(this.database, `DELETE FROM ${jointTableName} WHERE ${lk} = ?`, [this.client.id]);
    }
    async readResult(limit, columns, where, values) {
        const sqlSelect = `SELECT ${columns.join(', ')} FROM ${this.tableName} `;
        const sql = sqlSelect + where;
        if (limit === 1) {
            // @ts-ignore
            const result = await this.constructor.getRow(this.database, sql, [...values]);
            return result ? [result] : [];
        }
        // @ts-ignore
        return this.constructor.getRows(this.database, sql, [...values]);
    }
    async readAll(kv, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
        // @ts-ignore
        const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
        return kv ?
            this.readResult(limit, columns, `WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}${statementOrderBy.statement} LIMIT ? OFFSET ?`, [...Array.from(kv.values()), ...statementOrderBy.values, limit, offset]) :
            this.readResult(limit, columns, `${statementOrderBy.statement} LIMIT ? OFFSET ?`, [...statementOrderBy.values, limit, offset]);
    }
    async readBy(key, values, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
        // @ts-ignore
        const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
        return this.readResult(limit, columns, `WHERE ${key} IN (${values.map(() => '?').join(', ')})${statementOrderBy.statement} LIMIT ? OFFSET ?`, [...values, ...statementOrderBy.values, limit, offset]);
    }
    async readWith(criteria, columns = ['id', 'name'], limit = 1000, offset = 0, orderBy = new Map([['id', 'ASC']])) {
        // @ts-ignore
        const statementOrderBy = this.constructor.getOrderByStatement(orderBy);
        // @ts-ignore
        const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
        return this.readResult(limit, columns, `WHERE ${wheres} ${statementOrderBy.statement} LIMIT ? OFFSET ?`, [...whereValues, ...statementOrderBy.values, limit, offset]);
    }
    async countAll(kv = null) {
        const where = kv ? ` WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}` : '';
        const v = kv ? Array.from(kv.values()) : [];
        // @ts-ignore
        const result = await this.constructor.getRow(this.database, `SELECT COUNT(id) FROM ${this.tableName}${where}`, v);
        return result['COUNT(id)'];
    }
    async countBy(key, values) {
        // @ts-ignore
        const result = await this.constructor.getRow(this.database, `SELECT COUNT(id) FROM ${this.tableName} WHERE ${key} IN (${values.map(() => '?').join(', ')})`, values);
        return result['COUNT(id)'];
    }
    async countWith(criteria) {
        // @ts-ignore
        const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
        // @ts-ignore
        const result = await this.constructor.getRow(this.database, `SELECT COUNT(id) FROM ${this.tableName} WHERE ${wheres}`, whereValues);
        return result['COUNT(id)'];
    }
    async deleteAll(kv = null) {
        // @ts-ignore
        if (!kv)
            return this.constructor.run(this.database, `DELETE FROM ${this.tableName}`, []);
        // @ts-ignore
        return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}`, Array.from(kv.values()));
    }
    async deleteBy(key, values) {
        // @ts-ignore
        return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${key} IN (${values.map(() => '?').join(', ')})`, values);
    }
    async deleteWith(criteria) {
        // @ts-ignore
        const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
        // @ts-ignore
        return this.constructor.run(this.database, `DELETE FROM ${this.tableName} WHERE ${wheres}`, whereValues);
    }
    async updateAll(kv, columnValues) {
        const keys = Array.from(columnValues.keys());
        const newValues = Array.from(columnValues.values());
        // @ts-ignore
        if (!kv)
            return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')}`, newValues);
        // @ts-ignore
        return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')} WHERE ${Array.from(kv.keys()).map(k => k + ' = ?').join(' AND ')}`, [...newValues, ...Array.from(kv.values())]);
    }
    async updateBy(key, values, columnValues) {
        const keys = Array.from(columnValues.keys());
        const newValues = Array.from(columnValues.values());
        // @ts-ignore
        return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${keys.map(k => k + ' = ?')} WHERE ${key} IN (${values.map(() => '?').join(', ')})`, [...newValues, ...values]);
    }
    async updateWith(criteria, columnValues) {
        const keys = Array.from(columnValues.keys());
        // @ts-ignore
        const { wheres, whereValues } = this.constructor.getWheresAndWhereValueFromCriteria(criteria);
        // @ts-ignore
        return this.constructor.run(this.database, `UPDATE ${this.tableName} SET ${keys.map(key => key + ' = ?')} WHERE ${wheres}`, Array.from(columnValues.values()).concat(whereValues));
    }
    async insertAll(columns, valueGroups, ids = []) {
        //check columns have id
        const hasId = columns.includes('id');
        if (!hasId) {
            columns.push('id');
            valueGroups.map((it, i) => {
                // @ts-ignore
                it.push(ids[i] || ORMAdapterSQLite.defaultID());
                return it;
            });
        }
        //change value group values to ? for SQL
        const strValues = valueGroups.map(values => `(${values.map(() => '?').join(', ')})`);
        // @ts-ignore
        return this.constructor.run(this.database, `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES ${strValues.join(', ')}`, valueGroups.flat());
    }
}
