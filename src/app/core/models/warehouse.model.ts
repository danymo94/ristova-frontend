export type WarehouseType = 'PHYSICAL' | 'COST_CENTER';

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

export interface WarehouseResponsible {
  name: string;
  phone: string;
  email: string;
}

export interface WarehouseStatistics {
  warehouseId: string;
  totalStock?: number;
  stockValue?: number;
  productCount?: number;
  movementCount?: number;
  lastMovementDate?: string;
  lastUpdate?: string;
}

export interface WarehouseBalanceItem {
  warehouseId: string;
  projectId: string;
  rawProductId: string;
  currentQuantity: number;
  lastMovementDate: string;
  averageUnitCost: number;
  totalValue: number;
}

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
