import { ORMAdapter } from '@lionrockjs/central';
import { Database } from "bun:sqlite";
export default class ORMAdapterSQLite extends ORMAdapter {
    static OP: Record<string, string | number>;
    static op(operator: string | Function | any[], placeHolder?: boolean): string | number;
    static formatCriteria(criteria: any[][]): string;
    static translateValues(values?: any[]): any[];
    static getWheresAndWhereValueFromCriteria(criteria?: any[][]): {
        wheres: string;
        whereValues: any[];
    };
    static getOrderByStatement(orderBy: Map<string, string>): {
        statement: string;
        values: any[];
    };
    static getRow(database: Database, sql: string, values: any[]): Promise<unknown>;
    static getRows(database: Database, sql: string, values: any[]): Promise<unknown[]>;
    static run(database: Database, sql: string, values: any[]): Promise<import("bun:sqlite").Changes>;
    read(columns?: string[]): Promise<unknown>;
    update(values: any[]): Promise<import("bun:sqlite").Changes | undefined>;
    insert(values: any[]): Promise<import("bun:sqlite").Changes | undefined>;
    delete(): Promise<import("bun:sqlite").Changes>;
    hasMany(tableName: string, key: string): Promise<unknown[]>;
    belongsToMany(modelTableName: string, jointTableName: string, lk: string, fk: string): Promise<unknown[]>;
    add(models: any[], weight: number, jointTableName: string, lk: string, fk: string): Promise<import("bun:sqlite").Changes>;
    remove(models: any[], jointTableName: string, lk: string, fk: string): Promise<import("bun:sqlite").Changes>;
    removeAll(jointTableName: string, lk: string): Promise<import("bun:sqlite").Changes>;
    readResult(limit: number, columns: string[], where: string, values: any[]): Promise<unknown[]>;
    readAll(kv: Map<string, any> | null, columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<unknown[]>;
    readBy(key: string, values: any[], columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<unknown[]>;
    readWith(criteria: any[][], columns?: string[], limit?: number, offset?: number, orderBy?: Map<string, string>): Promise<unknown[]>;
    countAll(kv?: Map<string, any> | null): Promise<any>;
    countBy(key: string, values: any[]): Promise<any>;
    countWith(criteria: any[][]): Promise<any>;
    deleteAll(kv?: Map<string, any> | null): Promise<import("bun:sqlite").Changes>;
    deleteBy(key: string, values: any[]): Promise<import("bun:sqlite").Changes>;
    deleteWith(criteria: any[][]): Promise<import("bun:sqlite").Changes>;
    updateAll(kv: Map<string, any> | null, columnValues: Map<string, any>): Promise<import("bun:sqlite").Changes>;
    updateBy(key: string, values: any[], columnValues: Map<string, any>): Promise<import("bun:sqlite").Changes>;
    updateWith(criteria: any[][], columnValues: Map<string, any>): Promise<import("bun:sqlite").Changes>;
    insertAll(columns: string[], valueGroups: any[][], ids?: any[]): Promise<import("bun:sqlite").Changes>;
}
