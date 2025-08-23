import {Model} from '@lionrockjs/central';

export default class Person extends Model{
  constructor(id, options) {
    super(id, options);

    this.enable = null;
    this.name = null;
    this.email = null;
  }
}

Person.joinTablePrefix = 'person';
Person.tableName = 'persons';

Person.fields = new Map([
  ['enable','Boolean'],
  ['name','String'],
  ['email','String'],
]);

Person.belongsTo = new Map([
  
]);

Person.hasMany   = [
];

Person.belongsToMany = [
];