export interface EInvoice {
  id: string;
  projectId: string;
  partnerId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  invoiceLines: InvoiceLine[];
  createdAt: string;
  lastUpdatedAt: string;
  status: InvoiceStatus;
}

export interface InvoiceLine {
  lineNumber: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  articleCode: string;
  codeType: string;
  additionalData?: any;
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
}
