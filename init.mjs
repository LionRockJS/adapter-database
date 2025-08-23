import {ControllerMixinDatabase, Model} from "@lionrockjs/central";
import {DatabaseAdapterBunSqlite, ORMAdapterSQLite} from "./index.js";

Model.defaultAdapter = ORMAdapterSQLite;
ControllerMixinDatabase.defaultAdapter = DatabaseAdapterBunSqlite;