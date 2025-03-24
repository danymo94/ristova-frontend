import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  RawProduct,
  CreateRawProductDto,
  InvoiceRawProduct,
} from '../../../models/rawproduct.model';

@Injectable({
  providedIn: 'root',
})
export class RawproductService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Partner endpoints
  getPartnerProjectRawProducts(projectId: string): Observable<RawProduct[]> {
    return this.http
      .get<any>(`${this.apiUrl}/partner/projects/${projectId}/rawproducts`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getPartnerRawProduct(projectId: string, id: string): Observable<RawProduct> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/rawproducts/${id}`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  createOrUpdateRawProduct(
    projectId: string,
    rawProduct: CreateRawProductDto
  ): Observable<RawProduct> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/rawproducts`,
        rawProduct
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  deleteRawProduct(projectId: string, id: string): Observable<void> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/rawproducts/${id}`
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  getRawProductsByInvoice(
    projectId: string,
    invoiceId: string
  ): Observable<InvoiceRawProduct[]> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/rawproducts/invoice/${invoiceId}`
      )
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  generateEmbeddings(projectId: string): Observable<void> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/rawproducts/vectorize`,
        {}
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  // Admin endpoints
  getAdminProjectRawProducts(projectId: string): Observable<RawProduct[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/rawproducts`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAdminRawProduct(id: string): Observable<RawProduct> {
    return this.http.get<any>(`${this.apiUrl}/admin/rawproducts/${id}`).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}
