import { ICCCategory } from '../interfaces/cassaincloud.interfaces';

/**
 * Interfaccia principale per la gestione delle categorie nell'applicazione
 * Supporta sia le API locali che l'integrazione con Cassa in Cloud
 */
export interface Category {
  id?: string;

  // Informazioni di base
  name: string;
  description?: string;
  sortOrder?: number;
  isActive: boolean;

  // Informazioni relazionali
  projectId: string;
  partnerId: string;

  // Integrazione con Cassa in Cloud
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  CCCategory?: ICCCategory;

  // Integrazione con TheFork
  TConnection?: boolean;
  TSalesPointId?: string;
  TCategoryId?: string;
  TCategory?: Record<string, any>;

  // Metadati
  createdAt?: string;
  updatedAt?: string;
  additionalData?: Record<string, any>;
}

/**
 * Interfaccia per la creazione di una nuova categoria
 */
export interface CreateCategoryDto {
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  projectId: string;
  partnerId?: string; // Può essere opzionale se dedotto dal contesto
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  CCCategory?: ICCCategory | null;
  TConnection?: boolean;
  TSalesPointId?: string;
}

/**
 * Interfaccia per l'aggiornamento di una categoria esistente
 */
export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  CCConnection?: boolean;
  CCSalesPointId?: string;
  CCCategoryId?: string;
  TConnection?: boolean;
  TSalesPointId?: string;
  TCategoryId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Interfaccia per i parametri di creazione di una categoria su Cassa in Cloud
 */
export interface CCCategoryCreateParams {
  description: string; // Nome della categoria
  externalId?: string; // ID esterno per riferimento incrociato con il nostro sistema
  idSalesPoint: number; // ID del punto vendita
  // Flag di abilitazione
  enableForRisto?: boolean;
  enableForSale?: boolean;
  enableForECommerce?: boolean;
  enableForMobileCommerce?: boolean;
  enableForSelfOrderMenu?: boolean;
  enableForKiosk?: boolean;
  imageUrl?: string; // URL immagine categoria
}

/**
 * Interfaccia per i parametri di aggiornamento di una categoria su Cassa in Cloud
 */
export interface CCCategoryUpdateParams {
  description?: string;
  externalId?: string;
  // Flag di abilitazione
  enableForRisto?: boolean;
  enableForSale?: boolean;
  enableForECommerce?: boolean;
  enableForMobileCommerce?: boolean;
  enableForSelfOrderMenu?: boolean;
  enableForKiosk?: boolean;
  imageUrl?: string;
}

/**
 * Interfaccia per i filtri di ricerca delle categorie
 */
export interface CategorySearchFilters {
  projectId?: string;
  partnerId?: string;
  isActive?: boolean;
  name?: string;
  CCConnection?: boolean;
  TConnection?: boolean;
}

/**
 * Funzione di mappatura da categoria Cassa in Cloud a categoria locale
 * @param ccCategory Categoria da Cassa in Cloud
 * @param projectId ID del progetto corrente
 * @param partnerId ID del partner corrente
 * @returns Categoria nel formato dell'applicazione
 */
export function mapCCCategoryToCategory(
  ccCategory: ICCCategory,
  projectId: string,
  partnerId: string,
  salesPointId: string
): Category {
  return {
    name: ccCategory.description,
    description: ccCategory.description,
    isActive: true, // Assumiamo che le categorie da CC siano sempre attive
    projectId,
    partnerId,
    CCConnection: true,
    CCSalesPointId: salesPointId,
    CCCategoryId: ccCategory.id,
    CCCategory: ccCategory,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Funzione di mappatura da categoria locale a parametri creazione categoria CC
 * @param category Categoria nell'applicazione
 * @returns Parametri per la creazione di una categoria in Cassa in Cloud
 */
export function mapCategoryToCCCreateParams(
  category: Category
): CCCategoryCreateParams | null {
  if (!category.CCSalesPointId) {
    return null;
  }

  const salesPointId = parseInt(category.CCSalesPointId, 10);
  if (isNaN(salesPointId)) {
    return null;
  }

  return {
    description: category.name,
    externalId: category.id, // Usiamo il nostro ID come riferimento esterno
    idSalesPoint: salesPointId,
    // Impostiamo tutti i flag di abilitazione a true di default
    enableForRisto: true,
    enableForSale: true,
    enableForECommerce: true,
    enableForMobileCommerce: true,
    enableForSelfOrderMenu: true,
    enableForKiosk: true,
  };
}
