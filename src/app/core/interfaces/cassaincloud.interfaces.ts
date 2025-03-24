/**
 * Interface representing a Sales Point from Cassa in Cloud API.
 */
export interface ICCSalesPoint {
  id?: number; // Unique identifier for the sales point.
  name: string; // Name of the sales point.
  description: string; // Detailed description of the sales point.

  // Geographic location of the sales point
  latitude?: number | string; // Latitude in decimal degrees. Can be BigDecimal from the API but converted to number or string.
  longitude?: number | string; // Longitude in decimal degrees.

  brand?: string; // Brand associated with the sales point.
  street?: string; // Street address of the sales point.
  city?: string; // City where the sales point is located.
  zipcode?: string; // Postal or ZIP code of the location.
  district?: string; // District or region where the sales point is located.
  country?: string; // Country code in ISO 3166-1 alpha-2 format (e.g., "US", "IT" for Italy).

  vatNumber?: string; // VAT (Value-Added Tax) number for the sales point.
  taxCode?: string; // Tax code for the sales point.

  phoneNumber?: string; // Contact phone number of the sales point.
  email?: string; // Contact email of the sales point.

  currency?: string; // Currency code (e.g., "USD", "EUR") used at the sales point.

  logoSmall?: string; // Optional URL of the small logo for the sales point.
  logoBig?: string; // Optional URL of the big logo for the sales point.
  img?: string; // Optional URL of an additional image representing the sales point.
}

/**
 * Interface representing a Customer from Cassa in Cloud API.
 */
export interface ICCCustomer {
  id?: string; // Unique identifier for the customer.
  idOrganization?: string; // ID of the related organization.
  organization?: ICCOrganization; // Related organization (should be defined as a separate interface).

  name: string; // Full name of the customer.
  dateOfBirth?: string; // Date of birth in the Datetime format (ISO 8601 format recommended).
  gender?: CustomerGender; // Gender of the customer.

  vatNumber?: string; // VAT number for the customer.
  fiscalCode?: string; // Fiscal identification code.

  address?: string; // Street address of the customer.
  city?: string; // City where the customer resides.
  zipcode?: string; // Postal or ZIP code.
  district?: string; // District or region.
  country?: string; // Country code in ISO 3166-1 alpha-2 (e.g., "US", "IT" for Italy).

  phoneNumber?: string; // Contact phone number of the customer.
  email?: string; // Contact email of the customer.
  note?: string; // Additional notes about the customer, if any.

  idSalesMode?: string; // ID of the related sales mode.
  bankAccountHolder?: string; // Name of the bank account holder.
  bankAccountInstitute?: string; // Name of the bank account institute.
  bankAccountIBAN?: string; // Bank account IBAN (International Bank Account Number).

  // Discounts applied to sales for the customer.
  discount1?: number | string; // First percentage discount (Decimal or BigDecimal from the API).
  discount2?: number | string; // Second percentage discount.
  discount3?: number | string; // Third percentage discount.
  discount4?: number | string; // Fourth percentage discount.

  externalId?: string; // External identifier for the customer.
  idSalesPoint?: number; // ID of the sales point related to the customer.

  lastUpdate?: string; // Timestamp of the last update (ISO 8601 format recommended).
  lotteryCode?: string; // Alphanumeric code for receipt lottery participation.
}

/**
 * Interface representing an Organization from Cassa in Cloud API.
 */
export interface ICCOrganization {
  id?: string; // Unique identifier for the organization.
  name: string; // Name of the organization.

  // Address details
  address: string; // Address of the organization (e.g., street name and number).
  city: string; // City where the organization is located.
  zipcode: string; // Postal or ZIP code.
  district: string; // District or administrative division.
  country: string; // Country code in ISO 3166-1 alpha-2 format (e.g., "US", "IT" for Italy).

  splitPayment: boolean; // Indicates whether split payment is enabled for the organization.
  vatNumber?: string; // VAT (Value-Added Tax) number for the organization.
  fiscalCode?: string; // Fiscal code (similar to a tax identifier).

  eInvoiceCode?: string; // Electronic invoice code.
  pec?: string; // PEC (certified email) address of the organization.
  phoneNumber?: string; // Contact phone number of the organization.
  email?: string; // General email address for communication.
  note?: string; // Additional notes about the organization, if any.

  idSalesMode?: string; // ID of the related sales mode.
  bankAccountHolder?: string; // Bank account holder's name.
  bankAccountInstitute?: string; // Name of the bank account institute.
  bankAccountIBAN?: string; // Bank account IBAN (International Bank Account Number).

  // Discounts applied to sales for the organization.
  discount1?: number | string; // First percentage discount (Decimal or BigDecimal from the API).
  discount2?: number | string; // Second percentage discount.
  discount3?: number | string; // Third percentage discount.
  discount4?: number | string; // Fourth percentage discount.

  idSalesPoint?: number; // Identifier of the associated sales point.
  lastUpdate?: string; // Timestamp indicating the last update (ISO 8601 format recommended).
}

/**
 * Interface representing a Tax from Cassa in Cloud API.
 */
export interface ICCTaxes {
  id?: string; // Unique identifier for the tax.
  description: string; // Required. Description.
  rate: string; // Required. Ratio, expressed as percentage (BigDecimal rappresentato come stringa).
  externalId?: string; // Optional. External identifier.
  nature?: string; // Tipo di esenzione, valido e obbligatorio solo se rate è zero.
  noFiscalPrint?: boolean; // If true the receipt row will not be printed (valido solo se rate è zero).
  noFiscalPrintOnMixedReceipt?: boolean; // If true the receipt row will not be printed even in mixed receipts, valid only if rate is zero.
  ventilazione?: boolean; // If true the tax is configured with "ventilazione" for separate accounting.
  atecoCode?: string; // If ventilazione=true, questo codice è obbligatorio e identifica un'attività economica.
  idSalesPoint?: number; // idSalesPoint.
  lastUpdate?: string;
}

/**
 * Interface representing a Category from Cassa in Cloud API.
 */
export interface ICCCategory {
  id?: string; // Unique identifier for the category.
  description: string; // Required. Description of the category.
  externalId?: string; // Optional. External identifier for the category.
  idSalesPoint?: number; // Optional. Identifier of the related sales point.

  // Required fields indicating product availability for different platforms
  enableForRisto: boolean; // If true, products are available for the restaurant interface.
  enableForSale: boolean; // If true, products are available for sale on the Cassa In Cloud app.
  enableForECommerce: boolean; // If true, products are available for sale on e-commerce.
  enableForMobileCommerce: boolean; // If true, products are available for mobile e-commerce.
  enableForSelfOrderMenu: boolean; // If true, products are available for sale on self-order menus.
  enableForKiosk: boolean; // If true, products are available for kiosks on Cassa In Cloud.

  imageUrl?: string; // Optional. Link to an image connected to the category.
}

/**
 * Interface representing a Department from Cassa in Cloud API.
 */
export interface ICCDepartment {
  id?: string; // Unique identifier for the department.
  description: string; // Required. Description of the department.
  descriptionLabel: string; // Required. Label for the department button on the selling interface.
  descriptionReceipt: string; // Required. Description shown on the sales receipt.
  idTax: string; // Required. ID of the Tax to be applied to this department.
  color: string; // Required. Background color of the department button (hexadecimal format).

  amountLimit?: number | string; // Optional. Amount limit for department sales (BigDecimal as number or string).
  externalId?: string; // Optional. External identifier for the department.
  idSalesPoint?: number; // Optional. ID of the sales point associated with this department.
  salesType?: SalesType; // Optional. Type of sales linked to the department (e.g., goods or services).
}

/**
 * Interface representing a New Product.
 * Used to create a new product in the system.
 */
export interface ICCProduct {
  id?: string; // Unique identifier for the product.
  description: string; // Required. Product name.
  descriptionLabel: string; // Required. Label for the product button on the selling interface.
  descriptionExtended: string; // Required. Extended description shown on the product detail.
  idDepartment: string; // Required. ID of the related department.
  department?: any;
  idCategory: string; // Required. ID of the related category.
  category?: any;

  icon?: string; // Optional. Icon ID (see available icons in the API documentation).
  soldByWeight: boolean; // Required. If true, the price is determined by the weight of the product sold.
  defaultTare?: number; // Optional. Default tare weight for the product.
  multivariant: boolean; // Required. If true, the product allows variants.
  color?: string; // Optional. Hexadecimal value for the product button background color on the selling interface.

  // Product variants list
  variants?: any[];

  // Product availability flags
  enableForRisto: boolean; // Required. If true, the product is available for the restaurant interface.
  enableForSale: boolean; // Required. If true, the product is available for sale in the Cassa In Cloud app.
  enableForECommerce: boolean; // Required. If true, the product is available for sale on e-commerce.
  enableForMobileCommerce: boolean; // Required. If true, the product is available for mobile e-commerce.
  enableForSelfOrderMenu: boolean; // Required. If true, the product is available for self-order menus.
  enableForKiosk: boolean; // Required. If true, the product is available for kiosks.

  tags?: string[]; // Optional. Tags to group and help search for the product.

  // Cost details
  costs?: any[]; // Optional. List of costs related to the product.

  // External references
  externalId?: string; // Optional. External identifier for the product.
  idSalesPoint?: number; // Optional. ID of the sales point associated with this product.
  descriptionReceipt?: string; // Required only if 'multivariant' is false. Shown on the sales receipt.
  internalId?: string; // Required only if 'multivariant' is false. Internal ID for the product.

  // Barcodes
  barcodes?: any[]; // List of all product barcodes.

  // Pricing details
  prices: {
    idSalesPoint: string;
    value: number;
  }[]; // Required. List of prices for the product. At least one price is mandatory.

  // Product attributes
  attributes?: any[]; // Required only if 'multivariant' is true. List of product attributes.

  // Modifiers
  modifiers?: any[]; // Optional. List of available product modifiers.

  // Product images
  images?: any[]; // Optional. List of product images.

  // Product composition and menu details
  menu?: boolean; // Optional. If true, 'composition' must be false.
  composition?: boolean; // Optional. If true, 'menu' must be false.
  soldOnlyInCompositions?: boolean; // Optional. Can be true only if both 'menu' and 'composition' are false.

  // Menu-specific courses
  courses?: any[]; // List of courses in case the product is part of a menu.

  // Component details for composite products
  components?: any[]; // List of components if the product is composite.
}

/**
 * Interface representing a Product Variant or similar entity.
 */
export interface ICCProductVariant {
  id?: string; // Required. Unique identifier for the entity.
  description?: string; // Required. Description of the entity.
  descriptionReceipt?: string; // Required. Description shown on the receipt (special characters not recommended).
  descriptionOrderTicket?: string; // Optional. Description shown on the order ticket.
  internalId?: string; // Optional. Internal ID for the entity.
  externalId?: string; // Optional. External ID for mapping with external systems.

  barcodes?: any[]; // Optional. List of product barcodes.
  costs?: any[]; // Optional. List of costs related to the entity.

  // Attributes defining the characteristics of the entity (e.g., Size, Color, Material).
  attributes?: any[]; // Optional. List of SKU attributes values.

  prices?: {
    idSalesPoint: string;
    value: number;
  }[]; // Optional. List of prices for the entity based on sales mode.
}

/**
 * Interface representing a Restaurant Table.
 */
export interface ICCRestaurantTable {
  id?: string; // Unique identifier for the table.
  name: string; // Name of the table.
  idSalesPoint: number; // ID of the sales point associated with the table.
  seatsAvailable: number; // Number of available seats at the table.
  externalId?: string; // External identifier for the table.
  idRoom: string; // Identifier of the room the table belongs to.
}

/**
 * Enum representing possible sales types for a department.
 */
export type SalesType = 'GOODS' | 'SERVICES';

/**
 * Enum for CustomerGender.
 * Defines possible values for the gender of a customer.
 */
export type CustomerGender = 'MALE' | 'FEMALE';
