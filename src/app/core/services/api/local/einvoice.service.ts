import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  EInvoice,
  CreateEInvoiceDto,
  UpdateEInvoiceDto,
} from '../../../models/einvoice.model';

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

  // Admin endpoints
  getAdminProjectInvoices(projectId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAdminPartnerInvoices(partnerId: string): Observable<EInvoice[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/partners/${partnerId}/einvoices`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAdminInvoice(invoiceId: string): Observable<EInvoice> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/einvoices/${invoiceId}`)
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  updateAdminInvoice(
    invoiceId: string,
    invoice: UpdateEInvoiceDto
  ): Observable<EInvoice> {
    return this.http
      .put<any>(`${this.apiUrl}/admin/einvoices/${invoiceId}`, invoice)
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}
