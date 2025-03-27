export enum StockMovementType {
  PURCHASE = 'PURCHASE', // Acquisto (da fattura)
  SALE = 'SALE', // Vendita
  INVENTORY = 'INVENTORY', // Rettifica da inventario
  TRANSFER = 'TRANSFER', // Trasferimento tra magazzini
  WASTE = 'WASTE', // Scarico per sprechi
  INTERNAL_USE = 'INTERNAL_USE', // Uso interno
  RETURN = 'RETURN', // Reso a fornitore
  EXPENSE = 'EXPENSE', // Spesa (per centri di costo)
  OTHER = 'OTHER', // Altro
}

export enum MovementDetailDirection {
  IN = 'IN', // Entrata
  OUT = 'OUT', // Uscita
}

export type MovementStatus = 'draft' | 'confirmed' | 'cancelled';

export interface StockMovement {
  id?: string;
  projectId: string;
  partnerId: string;
  warehouseId: string; // Magazzino o centro di costo di riferimento
  createdAt?: string;
  lastUpdatedAt?: string;
  movementDate: string; // Data del movimento (ISO string)
  movementType: StockMovementType;
  invoiceId?: string; // Se legato a una fattura
  reference?: string; // Descrizione o ID esterno
  notes?: string; // Note aggiuntive
  totalQuantity?: number; // Quantità totale movimentata
  totalAmount: number; // Valore totale movimentato
  documentNumber?: string; // Numero documento associato
  userId?: string; // Utente che ha creato il movimento
  sourceWarehouseId?: string; // Per i trasferimenti: magazzino di origine
  targetWarehouseId?: string; // Per i trasferimenti: magazzino di destinazione
  status?: MovementStatus; // Stato del movimento
  isInvoiceProcessed?: boolean; // Flag per indicare se la fattura è già stata utilizzata per questo magazzino
}

export interface StockMovementDetail {
  id?: string;
  movementId: string; // Collega il movimento principale
  projectId: string;
  partnerId: string;
  rawProductId: string; // Prodotto grezzo movimentato (campo obbligatorio)
  productId?: string; // Opzionale: riferimento a un prodotto finito se necessario
  direction: MovementDetailDirection; // Entrata o uscita
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string; // Data del movimento
  warehouseId: string; // Magazzino specifico di destinazione
  notes?: string;
  metadata?: Record<string, any>;
  lot?: string; // Lotto (se applicabile)
  expiry?: string; // Data di scadenza (se applicabile)
}

// DTOs per le richieste
export interface InboundMovementDto {
  movementType: StockMovementType;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface OutboundMovementDto {
  movementType: StockMovementType;
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

export interface WarehouseBalance {
  balance: {
    warehouseId: string;
    projectId: string;
    rawProductId: string;
    currentQuantity: number;
    lastMovementDate: string;
    averageUnitCost: number;
    totalValue: number;
  }[];
  totalValue: number;
  productCount: number;
  warehouseId: string;
}

export interface AssignInvoiceToCostCenterResponse {
  id: string;
  projectId: string;
  partnerId: string;
  warehouseId: string;
  movementDate: string;
  movementType: StockMovementType;
  invoiceId: string;
  totalAmount: number;
  status: MovementStatus;
  createdAt: string;
  lastUpdatedAt: string;
}
