/**
 * Tipi di movimento di magazzino supportati
 */
export enum StockMovementType {
  PURCHASE = 'PURCHASE',       // Acquisto (da fattura o manuale)
  SALE = 'SALE',               // Vendita di prodotti
  INVENTORY = 'INVENTORY',     // Rettifica da inventario
  TRANSFER = 'TRANSFER',       // Trasferimento tra magazzini
  WASTE = 'WASTE',             // Scarico per sprechi/perdite
  INTERNAL_USE = 'INTERNAL_USE', // Consumo interno
  RETURN = 'RETURN',           // Reso a fornitore
  EXPENSE = 'EXPENSE',         // Spesa (per centri di costo)
  OTHER = 'OTHER',             // Altra tipologia
}

/**
 * Direzione del movimento a livello di dettaglio
 */
export enum MovementDetailDirection {
  IN = 'IN',   // Entrata
  OUT = 'OUT', // Uscita
}

/**
 * Stati possibili di un movimento
 */
export type MovementStatus = 'draft' | 'confirmed' | 'cancelled';

/**
 * Dettaglio di un movimento di magazzino (riga)
 */
export interface StockMovementDetail {
  id?: string;
  movementId: string;          // ID del movimento principale
  projectId: string;
  partnerId: string;
  rawProductId: string;        // Prodotto grezzo movimentato
  productId?: string;          // Opzionale: riferimento a prodotto finito
  direction: MovementDetailDirection;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;                // Data del movimento
  warehouseId: string;         // Magazzino specifico
  notes?: string;
  metadata?: Record<string, any>;
  lot?: string;                // Lotto (se applicabile)
  expiry?: string;             // Data di scadenza (se applicabile)
}

/**
 * Movimento di magazzino (testata)
 */
export interface StockMovement {
  id?: string;
  projectId: string;
  partnerId: string;
  warehouseId: string;         // Magazzino principale di riferimento
  createdAt?: string;
  lastUpdatedAt?: string;
  movementDate: string;        // Data del movimento (ISO string)
  movementType: StockMovementType;
  invoiceId?: string;          // Se legato a una fattura
  reference?: string;          // Descrizione o ID esterno
  notes?: string;              // Note aggiuntive
  totalQuantity?: number;      // Quantità totale movimentata
  totalAmount: number;         // Valore totale movimentato
  documentNumber?: string;     // Numero documento associato
  userId?: string;             // Utente che ha creato il movimento
  sourceWarehouseId?: string;  // Per i trasferimenti: magazzino di origine
  targetWarehouseId?: string;  // Per i trasferimenti: magazzino di destinazione
  status?: MovementStatus;     // Stato del movimento
  isInvoiceProcessed?: boolean; // Flag per fatture già processate
}

/**
 * DTO per la creazione di un movimento di carico
 */
export interface InboundMovementDto {
  movementType: StockMovementType;
  movementDate?: string;
  reference?: string;
  notes?: string;
  documentNumber?: string;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    lot?: string;
    expiry?: string;
  }[];
}

/**
 * DTO per la creazione di un movimento di scarico
 */
export interface OutboundMovementDto {
  movementType: StockMovementType;
  movementDate?: string;
  reference?: string;
  notes?: string;
  documentNumber?: string;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    lot?: string;
  }[];
}

/**
 * DTO per la creazione di una rettifica inventario
 */
export interface InventoryCheckDto {
  movementDate?: string;
  reference?: string;
  notes?: string;
  documentNumber?: string;
  products: {
    rawProductId: string;
    expectedQty: number;   // Quantità attesa nel sistema
    actualQty: number;     // Quantità effettiva rilevata
    unitPrice: number;
    notes?: string;
    lot?: string;
  }[];
}

/**
 * DTO per la creazione di un trasferimento
 */
export interface TransferMovementDto {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  movementDate?: string;
  reference?: string;
  notes?: string;
  documentNumber?: string;
  products: {
    rawProductId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    lot?: string;
    expiry?: string;
  }[];
}

/**
 * DTO per l'aggiornamento dello stato di un movimento
 */
export interface UpdateMovementStatusDto {
  status: MovementStatus;
}

/**
 * Informazioni sul saldo di un prodotto in un magazzino
 */
export interface StockBalance {
  warehouseId: string;
  projectId: string;
  rawProductId: string;
  currentQuantity: number;
  lastMovementDate: string;
  averageUnitCost: number;
  totalValue: number;
}

/**
 * Saldi complessivi di un magazzino
 */
export interface WarehouseBalance {
  balance: StockBalance[];
  totalValue: number;
  productCount: number;
  warehouseId: string;
}

/**
 * Riepilogo dell'inventario di un magazzino
 */
export interface WarehouseInventorySummary {
  id: string;
  name: string;
  type: string;
  projectId: string;
  partnerId: string;
  summary: {
    warehouseId: string;
    movementCount: number;
    totalInQuantity: number;
    totalOutQuantity: number;
    netQuantity: number;
    totalInValue: number;
    totalOutValue: number;
    netValue: number;
    lastMovementDate: string;
  };
  productCount: number;
}

/**
 * Risposta quando si assegna una fattura a un centro di costo
 */
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