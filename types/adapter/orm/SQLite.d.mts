import { ORMAdapter } from '@lionrockjs/central';
export default class ORMAdapterSQLite extends ORMAdapter {
    static OP: Record<string, string | number>;
    static op(operator: string | Function | any[], placeHolder?: boolean): string | number;
    static formatCriteria(criteria: any[]): string;
    static translateValues(values?: any[]): any[];
    static getWheresAndWhereValueFromCriteria(criteria?: any[]): {
        wheres: string;
        whereValues: any[];
    };
    static getOrderByStatement(orderBy: Map<string, string>): {
        statement: string;
        values: string[];
    };
    static getRow(database: any, sql: string, values: any[]): Promise<any>;
    static getRows(database: any, sql: string, values: any[]): Promise<any>;
    static run(database: any, sql: string, values: any[]): Promise<any>;
    read(columns?: string[]): Promise<any>;
    update(values: any[]): Promise<any>;
    insert(values: any[]): Promise<any>;
    delete(): Promise<any>;
    hasMany(tableName: string, key: string): Promise<any>;
    belongsToMany(modelTableName: string, jointTableName: string, lk: string, fk: string): Promise<any>;
    add(models: any[], weight: number, jointTableName: string, lk: string, fk: string): Promise<any>;
    remove(models: any[], jointTableName: string, lk: string, fk: string): Promise<any>;
    removeAll(jointTableName: string, lk: string): Promise<any>;
    readResult(limit: number, columns: string[], where: string, values: any[]): Promise<any>;
    readAll(kv: Map<string, any>, columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<any>;
    readBy(key: string, values: any[], columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<any>;
    readWith(criteria: any[], columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<any>;
    countAll(kv?: Map<string, any>): Promise<any>;
    countBy(key: string, values: any[]): Promise<any>;
    countWith(criteria: any[]): Promise<any>;
    deleteAll(kv?: Map<string, any>): Promise<any>;
    deleteBy(key: string, values: any[]): Promise<any>;
    deleteWith(criteria: any[]): Promise<any>;
    updateAll(kv: Map<string, any>, columnValues: Map<string, any>): Promise<any>;
    updateBy(key: string, values: any[], columnValues: Map<string, any>): Promise<any>;
    updateWith(criteria: any[], columnValues: Map<string, any>): Promise<any>;
    insertAll(columns: string[], valueGroups: any[][], ids?: any[]): Promise<any>;
}
