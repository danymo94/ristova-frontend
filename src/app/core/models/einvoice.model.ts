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
  status?:any;
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
}

export interface CreateEInvoiceDto {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  invoiceLines: InvoiceLine[];
}

export interface UpdateEInvoiceDto {
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  invoiceLines?: InvoiceLine[];
}
