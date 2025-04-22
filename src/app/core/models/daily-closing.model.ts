export interface DailyClosing {
  id?: string;
  date: Date;
  projectId?: string;
  eTickets: number;
  paperTickets: number;
  charges: number;
  cash: number;
  creditCard: number;
  debitCard: number;
  invoices: number;
  deferredInvoices: number;
  other: number;
  operatorName: string;
  notes?: string;
  isSent?: boolean; // Indica se la chiusura è stata inviata
  sentAt?: Date; // Data e ora in cui è stata inviata la chiusura
  createdAt?: Date;
  updatedAt?: Date;
}


/**
 * Interfaccia per il filtro di esportazione delle chiusure
 */
export interface ClosingExportOptions {
  month: number;
  year: number;
  projectId?: string;
}
