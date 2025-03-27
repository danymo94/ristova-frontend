export interface EInvoice {
  id?: string;
  projectId: string; // Each invoice belongs to a single project
  partnerId: string; // …and a single partner
  createdAt: string;
  lastUpdatedAt: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  supplierId: string; // Link to the supplier (ISupplier.id)
  invoiceLines: InvoiceLine[];
  status: InvoiceStatus;
  processing?: boolean;
}

export interface InvoiceLine {
  lineNumber: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  articleCode: string; // Single code for matching products
  codeType: string; // Indicates the source of the code (from XML or derived)
  additionalData?: any;
  processed?: boolean; // Flag per indicare se la riga è stata elaborata
  processedWarehouseId?: string; // ID del magazzino in cui è stata elaborata
  processedDate?: string; // Data di elaborazione
}

export interface InvoiceStatus {
  // Stato del pagamento
  paymentStatus: 'pending' | 'scheduled' | 'paid' | 'canceled';
  paymentDate?: string; // Data di pagamento effettivo
  scheduledPaymentDate?: string; // Data programmata per il pagamento

  // Stato centro di costo
  costCenterStatus: 'not_assigned' | 'assigned';
  costCenterId?: string;
  costCenterAssignDate?: string;

  // Stato magazzino
  inventoryStatus: 'not_processed' | 'processed' | 'partially_processed';
  inventoryIds?: string[]; // Array di ID magazzini associati
  inventoryProcessDate?: string;

  // Stato prodotti grezzi
  rawProductStatus: 'not_processed' | 'processing' | 'processed';
  rawProductProcessDate?: string;
}

export interface CreateEInvoiceDto {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  invoiceLines: InvoiceLine[];
  status?: Partial<InvoiceStatus>;
}

export interface UpdateEInvoiceDto {
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  invoiceLines?: InvoiceLine[];
  status?: Partial<InvoiceStatus>;
}

// DTO per l'aggiornamento dello stato di pagamento
export interface UpdatePaymentStatusDto {
  paymentStatus: 'pending' | 'scheduled' | 'paid' | 'canceled';
  paymentDate?: string;
  scheduledPaymentDate?: string;
}

// DTO per l'assegnazione del centro di costo
export interface AssignCostCenterDto {
  costCenterId: string;
}

// DTO per l'elaborazione in magazzino
export interface ProcessInventoryDto {
  inventoryId: string;
  invoiceLines?: number[]; // Array di indici delle righe selezionate per la valorizzazione parziale
}
