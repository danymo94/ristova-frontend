import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  EInvoice,
  CreateEInvoiceDto,
  UpdateEInvoiceDto,
  UpdatePaymentStatusDto,
  AssignCostCenterDto,
  ProcessInventoryDto,
} from '../../../models/einvoice.model';
import {
  AssignInvoiceToCostCenterResponse,
  StockMovement,
} from '../../../models/stock-movement.model';

@Injectable({
  providedIn: 'root',
})
export class EinvoiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Partner endpoints
  getPartnerProjectInvoices(projectId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/partner/projects/${projectId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAllPartnerInvoices(): Observable<EInvoice[]> {
    return this.http.get<any>(`${this.apiUrl}/partner/einvoices`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  getPartnerInvoice(
    projectId: string,
    invoiceId: string
  ): Observable<EInvoice> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  createInvoice(
    projectId: string,
    invoice: CreateEInvoiceDto
  ): Observable<EInvoice> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices`,
        invoice
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  updateInvoice(
    projectId: string,
    invoiceId: string,
    invoice: UpdateEInvoiceDto
  ): Observable<EInvoice> {
    return this.http
      .put<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}`,
        invoice
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  deleteInvoice(projectId: string, invoiceId: string): Observable<any> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // Payment status updating
  updatePaymentStatus(
    projectId: string,
    invoiceId: string,
    paymentStatusData: UpdatePaymentStatusDto
  ): Observable<EInvoice> {
    return this.http
      .put<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}/payment-status`,
        paymentStatusData
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // Nuovi metodi per l'assegnazione e l'elaborazione delle fatture

  /**
   * Assegna una fattura a un centro di costo
   */
  assignInvoiceToCostCenter(
    projectId: string,
    invoiceId: string,
    costCenterId: string
  ): Observable<AssignInvoiceToCostCenterResponse> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/invoices/${invoiceId}/costcenter/${costCenterId}`,
        {}
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Elabora una fattura creando un movimento di stock in un magazzino fisico
   */
  processInvoiceToWarehouse(
    projectId: string,
    invoiceId: string,
    warehouseId: string,
    data: any
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/invoices/${invoiceId}/process-to-warehouse/${warehouseId}`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // Admin endpoints (mantenuti solo quelli essenziali)
  getAdminProjectInvoices(projectId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}
