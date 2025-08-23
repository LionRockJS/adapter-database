import {Model} from '@lionrockjs/central';

export default class Address extends Model{
  person_id = null;
  address1 = null;
  address2 = null;
  city = null;
  company = null;
  country = null;
  country_code = null;
  province = null;
  province_code = null;
  street = null;
  zip = null;

  static joinTablePrefix = 'address';
  static tableName = 'addresses';

  static fields = new Map([
    ["address1", "String!"],
    ["address2", "String"],
    ["city", "String"],
    ["company", "String"],
    ["country", "String"],
    ["country_code", "String"],
    ["province", "String"],
    ["province_code", "String"],
    ["street", "String"],
    ["zip", "String"],
  ]);

  static belongsTo = new Map([
    ['person_id', 'Person']
  ]);

  static hasMany = [
    ['address_id', 'Customer'],
    ['billing_address_id', 'Order'],
    ['shipping_address_id', 'Order'],
    ['address_id', 'Shop'],
    ['shipping_address_id', 'Checkout'],
    ['billing_address_id', 'Checkout']
  ];
}