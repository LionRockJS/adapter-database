import {Model} from '@lionrockjs/central';

export default class Product extends Model{
  //foreignKeys
  default_image_id = null;
  type_id = null;
  vendor_id = null;
  name = null;
  content = null;
  handle = null;
  title = null;
  description = null;
  template_suffix = null;
  available = null;

  static joinTablePrefix = 'product';
  static tableName = 'products';

  static fields = new Map([
    ['name', 'String'],
    ['content', 'String'],
    ['handle', 'String'],
    ['title', 'String'],
    ['description', 'String'],
    ['template_suffix', 'String'],
    ['available', 'Boolean!'],
  ]);

  static belongsTo = new Map([
    ['default_image_id', 'Image'],
    ['type_id', 'Type'],
    ['vendor_id', 'Vendor']
  ]);

  static hasMany = [
    ['product_id', 'Variant'],
    ['product_id', 'LineItem'],
    ['product_id', 'GiftCard']
  ];

  static belongsToMany = new Set([
    'Tag',
  ]);
}