import { ICCProduct } from '../interfaces/cassaincloud.interfaces';

/**
 * Main interface for product management in the application
 * Supports both local APIs and integration with Cassa in Cloud
 */
export interface Product {
  id?: string;

  // Basic product info
  name: string;
  description: string;
  price: number;
  allergens: string[];
  calories: number;
  sortOrder: number; // Was "index" in the old interface
  isActive: boolean;

  // Relations
  categoryId: string;
  projectId: string;
  partnerId: string;

  // Cassa in Cloud integration
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  CCProductId?: string;
  CCProductVariantId?: string;
  CCProduct?: ICCProduct;

  // TheFork integration
  TConnection?: boolean;
  TSalesPointId?: string;
  TCategoryId?: string;
  TProductId?: string;
  TProduct?: Record<string, any>;

  // Additional data
  additionalData?: {
    ingredients?: string[];
    nutritionalInfo?: {
      proteins?: number;
      carbs?: number;
      fats?: number;
      fiber?: number;
    };
    isVegetarian?: boolean;
    isVegan?: boolean;
    isGlutenFree?: boolean;
    isLactoseFree?: boolean;
    isSpecialty?: boolean;
    image?: string;
    tags?: string[];
    [key: string]: any;
  };

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface for creating a new product
 */
export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  allergens?: string[];
  calories?: number;
  sortOrder?: number;
  isActive?: boolean;
  categoryId: string;
  projectId: string;
  partnerId?: string; // Can be optional if inferred from context
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  CCProductId?: string;
  CCProductVariantId?: string;
  CCProduct?: ICCProduct | null;
  TConnection?: boolean;
  TSalesPointId?: string;
  TCategoryId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Interface for updating an existing product
 */
export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  allergens?: string[];
  calories?: number;
  sortOrder?: number;
  isActive?: boolean;
  categoryId?: string;
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  CCProductId?: string;
  CCProductVariantId?: string;
  TConnection?: boolean;
  TSalesPointId?: string;
  TCategoryId?: string;
  TProductId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Interface for product search filters
 */
export interface ProductSearchFilters {
  projectId?: string;
  categoryId?: string;
  partnerId?: string;
  isActive?: boolean;
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  isSpecialty?: boolean;
  CCConnection?: boolean;
  TConnection?: boolean;
}

/**
 * Maps a product from Cassa in Cloud to the local product model
 * @param ccProduct - Product from Cassa in Cloud
 * @param projectId - Current project ID
 * @param partnerId - Current partner ID
 * @param categoryId - Category ID for the product
 * @returns Product in the application format
 */
export function mapCCProductToProduct(
  ccProduct: ICCProduct,
  projectId: string,
  partnerId: string,
  categoryId: string,
  salesPointId: string
): Product {
  // CORREZIONE: Estrazione del prezzo semplificata
  let price = 0;
  
  if (ccProduct.prices && ccProduct.prices.length > 0) {
    // Strategia di fallback: usa il primo prezzo disponibile se non c'è una corrispondenza specifica
    price = ccProduct.prices[0].value;
    
    // Prova a cercare un prezzo specifico per questo punto vendita
    const salesPointIdNum = parseInt(salesPointId, 10);
    const matchingPrice = ccProduct.prices.find(p => 
      parseInt(p.idSalesPoint.toString(), 10) === salesPointIdNum);
    
    if (matchingPrice) {
      price = matchingPrice.value;
    }
  }

  // Extract product name for local model
  const name = ccProduct.description || '';

  // Extract description (use extended description or fallback to regular description)
  const description =
    ccProduct.descriptionExtended || ccProduct.description || '';

  // Extract variant data if available
  const isMultivariant = ccProduct.multivariant || false;
  const variantId = ccProduct.variants ? ccProduct.variants[0].id : '';

  return {
    name,
    description,
    price,
    allergens: [], // CC doesn't have direct allergen info, need manual mapping
    calories: 0, // CC doesn't have calorie info
    sortOrder: 0, // Set default order
    isActive: true, // Assume active by default

    categoryId,
    projectId,
    partnerId,

    // CC Integration data
    CCConnection: true,
    CCSalesPointId: salesPointId,
    CCCategoryId: ccProduct.idCategory,
    CCProductId: ccProduct.id,
    CCProductVariantId: variantId,
    CCProduct: ccProduct,

    // Additional data with automatic tag extraction if available
    additionalData: {
      tags: ccProduct.tags || [],
      // Add any additional data mappings as needed
    },

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Maps a local product to Cassa in Cloud product creation parameters
 * @param product - Local product model
 * @returns Parameters for creating a product in Cassa in Cloud or null if required data is missing
 */
export function mapProductToCCCreateParams(product: Product): any | null {
  if (!product.CCSalesPointId || !product.CCCategoryId) {
    return null;
  }

  const salesPointId = parseInt(product.CCSalesPointId, 10);
  if (isNaN(salesPointId)) {
    return null;
  }

  // Basic product data
  const ccProduct = {
    description: product.name,
    descriptionLabel: product.name,
    descriptionExtended: product.description,
    descriptionReceipt: product.name.substring(0, 32), // Limit receipt description length
    idCategory: product.CCCategoryId,
    idDepartment: '', // Required field but needs to be provided
    idSalesPoint: salesPointId,

    // Default settings
    multivariant: false,
    soldByWeight: false,

    // Enable for all channels by default
    enableForRisto: true,
    enableForSale: true,
    enableForECommerce: true,
    enableForMobileCommerce: true,
    enableForSelfOrderMenu: true,
    enableForKiosk: true,

    // Optional metadata
    externalId: product.id, // Use our ID as external reference
    tags: product.additionalData?.tags || [],

    // Pricing: Requires at least a base price with no sales mode
    prices: [
      {
        value: product.price,
        idSalesPoint: salesPointId,
      },
    ],
  };

  return ccProduct;
}
