/**
 * Definisce il tipo di warehouse
 * - PHYSICAL: Magazzino fisico che gestisce inventario di prodotti materiali
 * - COST_CENTER: Centro di costo utilizzato per assegnare spese e fatture
 */
export type WarehouseType = 'PHYSICAL' | 'COST_CENTER';

/**
 * Rappresenta la posizione fisica di un warehouse
 */
export interface WarehouseLocation {
  address: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Informazioni sul responsabile del warehouse
 */
export interface WarehouseResponsible {
  name: string;
  phone: string;
  email: string;
}

/**
 * Statistiche di base di un warehouse
 */
export interface WarehouseStatistics {
  warehouseId: string;
  totalStock?: number;
  stockValue?: number;
  productCount?: number;
  movementCount?: number;
  lastMovementDate?: string;
  lastUpdate?: string;
}

/**
 * Dati relativi a un singolo prodotto nel saldo del warehouse
 */
export interface WarehouseBalanceItem {
  warehouseId: string;
  projectId: string;
  rawProductId: string;
  currentQuantity: number;
  lastMovementDate: string;
  averageUnitCost: number;
  totalValue: number;
}

/**
 * Saldo complessivo di un warehouse
 */
export interface WarehouseBalance {
  warehouseId: string;
  warehouseName: string;
  type: WarehouseType;
  projectId: string;
  items: WarehouseBalanceItem[];
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lastUpdate: string;
}

/**
 * Entità principale warehouse
 */
export interface Warehouse {
  id?: string;
  projectId?: string;
  partnerId?: string;
  name: string;
  description: string;
  type: WarehouseType;
  isActive: boolean;
  location?: WarehouseLocation;
  responsible?: WarehouseResponsible;
  notes?: string;
  costCenterCode?: string;
  costCenterCategories?: string[];
  createdAt?: string;
  lastUpdatedAt?: string;
  statistics?: WarehouseStatistics;
}

/**
 * DTO per la creazione di un warehouse
 */
export interface CreateWarehouseDto {
  name: string;
  description: string;
  type: WarehouseType;
  isActive: boolean;
  location?: WarehouseLocation;
  responsible?: WarehouseResponsible;
  notes?: string;
  costCenterCode?: string;
  costCenterCategories?: string[];
}

/**
 * DTO per l'aggiornamento di un warehouse
 */
export interface UpdateWarehouseDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  location?: WarehouseLocation;
  responsible?: WarehouseResponsible;
  notes?: string;
  costCenterCode?: string;
  costCenterCategories?: string[];
}

/**
 * Elemento di inventario di un prodotto
 */
export interface InventoryProductItem {
  rawProductId: string;
  quantity: number;
  value: number;
  lastMovementDate: string;
  avgCost: number;
}

/**
 * Dati di inventario di un warehouse fisico
 */
export interface WarehouseInventory {
  warehouseId: string;
  projectId: string;
  inventoryDate: string;
  lastUpdated: string;
  products: InventoryProductItem[];
}

/**
 * Dati di inventario di un singolo prodotto in un warehouse fisico
 */
export interface WarehouseProductInventory {
  rawProductId: string;
  quantity: number;
  value: number;
  lastMovementDate?: string;
  avgCost: number;
  warehouseId?: string;
}

/**
 * Statistiche dettagliate di un warehouse con riepilogo dei movimenti
 */
export interface WarehouseStats {
  warehouseId: string;
  warehouseName: string;
  type: WarehouseType;
  projectId: string;
  stats: {
    warehouseId: string;
    totalStock: number;
    stockValue: number;
    productCount: number;
    movementCount: number;
    lastMovementDate: string;
    lastUpdate: string;
  };
  movementSummary: WarehouseMovementSummary;
}

/**
 * Riepilogo aggregato dei movimenti di stock per un warehouse
 */
export interface WarehouseMovementSummary {
  warehouseId: string;
  movementCount: number;
  totalInQuantity: number;
  totalOutQuantity: number;
  netQuantity: number;
  totalInValue: number;
  totalOutValue: number;
  netValue: number;
  lastMovementDate: string;
}