import {Model} from '@lionrockjs/central';

export default class Person extends Model{
  constructor(id, options) {
    super(id, options);

    this.enable = null;
  }
}

Person.joinTablePrefix = 'person';
Person.tableName = 'persons';

Person.fields = new Map([
  ['enable','Boolean'],
]);

Person.belongsTo = new Map([
  
]);

Person.hasMany   = [
];

Person.belongsToMany = [
];