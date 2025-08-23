import {Model} from '@lionrockjs/central';

export default class Tag extends Model{
  name;

  static joinTablePrefix = 'tag';
  static tableName = 'tags';

  static fields = new Map([
    ['name', 'String']
  ]);
}
