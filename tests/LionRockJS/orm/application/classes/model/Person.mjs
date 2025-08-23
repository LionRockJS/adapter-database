import {Model} from '@lionrockjs/central';

export default class Person extends Model{
  first_name;
  last_name;
  phone;
  email;

  static joinTablePrefix = 'person';
  static tableName = 'persons';

  static fields = new Map([
    ['first_name', 'String'],
    ['last_name', 'String'],
    ['phone', 'String'],
    ['email', 'String']
  ]);

  static hasMany = [
    ['person_id', 'Address'],
    ['person_id', 'User'],
    ['person_id', 'Customer'],
  ];
}