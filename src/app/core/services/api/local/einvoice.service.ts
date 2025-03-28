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
} from '../../../models/einvoice.model';
import { StockMovement } from '../../../models/stock-movement.model';

@Injectable({
  providedIn: 'root',
})
export class EinvoiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ===== PARTNER ENDPOINTS =====
  
  /**
   * Recupera tutte le fatture elettroniche associate a un progetto specifico
   */
  getPartnerProjectInvoices(projectId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/partner/projects/${projectId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera tutte le fatture associate al partner autenticato
   */
  getAllPartnerInvoices(): Observable<EInvoice[]> {
    return this.http.get<any>(`${this.apiUrl}/partner/einvoices`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  /**
   * Recupera i dettagli di una specifica fattura elettronica
   */
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

  /**
   * Crea una nuova fattura elettronica associata a un progetto
   */
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

  /**
   * Aggiorna una fattura elettronica esistente
   */
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

  /**
   * Elimina una fattura elettronica esistente
   */
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

  /**
   * Aggiorna lo stato di pagamento di una fattura
   */
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

  /**
   * Assegna una fattura a un centro di costo
   * Crea un movimento di tipo EXPENSE
   */
  assignInvoiceToCostCenter(
    projectId: string,
    invoiceId: string,
    costCenterId: string
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}/costcenter/${costCenterId}`,
        {}
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Elabora una fattura creando un movimento di stock in un magazzino fisico
   * Se lineIndices è specificato, elabora solo le righe indicate
   */
  processInvoiceToWarehouse(
    projectId: string,
    invoiceId: string,
    warehouseId: string,
    options?: { lineIndices?: number[] }
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/einvoices/${invoiceId}/process-to-warehouse/${warehouseId}`,
        options || {}
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // ===== ADMIN ENDPOINTS =====
  
  /**
   * Recupera tutte le fatture elettroniche associate a un progetto specifico (solo admin)
   */
  getAdminProjectInvoices(projectId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }
  
  /**
   * Recupera tutte le fatture elettroniche nel sistema (solo admin)
   */
  getAllAdminInvoices(): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Gestisce gli errori delle richieste API
   */
  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}