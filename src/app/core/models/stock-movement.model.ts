export type MovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'INVENTORY'
  | 'TRANSFER'
  | 'WASTE'
  | 'INTERNAL_USE'
  | 'RETURN'
  | 'EXPENSE'
  | 'OTHER';

export type MovementStatus = 'draft' | 'confirmed' | 'cancelled';
export type MovementDirection = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  projectId: string;
  partnerId: string;
  warehouseId: string;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
  movementDate: string;
  movementType: MovementType;
  reference?: string;
  invoiceId?: string;
  totalQuantity: number;
  totalAmount: number;
  status: MovementStatus;
  notes?: string;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface StockMovementDetail {
  id: string;
  movementId: string;
  projectId: string;
  partnerId: string;
  rawProductId: string;
  direction: MovementDirection;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  warehouseId: string;
  notes?: string;
}

export interface ProductBalance {
  warehouseId: string;
  rawProductId: string;
  projectId: string;
  currentQuantity: number;
  lastMovementDate: string;
  averageUnitCost: number;
  totalValue: number;
}

export interface WarehouseBalance {
  balance: ProductBalance[];
  totalValue: number;
  productCount: number;
  warehouseId: string;
}

// DTOs per le richieste
export interface CreateMovementFromInvoiceDto {
  details: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }[];
}

export interface InboundMovementDto {
  movementType: MovementType;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface OutboundMovementDto {
  movementType: MovementType;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface InventoryCheckDto {
  products: {
    rawProductId: string;
    expectedQty: number;
    actualQty: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface TransferMovementDto {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface UpdateMovementStatusDto {
  status: MovementStatus;
}
