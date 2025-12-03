import {ControllerMixinDatabase, Model} from "@lionrockjs/central";
import {DatabaseAdapterBunPostgres, ORMAdapterPostgreSQL} from "./index.js";

Model.defaultAdapter = ORMAdapterPostgreSQL;
ControllerMixinDatabase.defaultAdapter = DatabaseAdapterBunPostgres;