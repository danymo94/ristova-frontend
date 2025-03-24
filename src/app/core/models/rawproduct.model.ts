export interface RawProduct {
  id: string;
  projectId: string;
  partnerId: string;
  productCode: string;
  productCodeType: string;
  description: string;
  unitOfMeasure: string;
  vatRate: number;
  supplierId: string;
  purchaseHistory: PurchaseHistory[];
  additionalData?: RawProductAdditionalData;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface PurchaseHistory {
  invoiceId: string;
  purchaseDate: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface RawProductAdditionalData {
  category?: string;
  note?: string;
  raw?: string;
  embeddings?: string;
  [key: string]: any; // Per eventuali campi aggiuntivi
}

export interface CreateRawProductDto {
  supplierId: string;
  productCode: string;
  productCodeType: string;
  description: string;
  unitOfMeasure: string;
  vatRate: number;
  purchaseHistory: PurchaseHistory[];
  additionalData?: RawProductAdditionalData;
}

export interface InvoiceRawProduct {
  productId: string;
  productCode: string;
  description: string;
  unitOfMeasure: string;
  vatRate: number;
  totalQuantity: number;
  averageUnitPrice: number;
  totalPrice: number;
}
