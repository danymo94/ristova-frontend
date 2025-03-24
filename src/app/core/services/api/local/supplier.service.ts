import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Supplier, CreateSupplierDto } from '../../../models/supplier.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Partner endpoints
  getPartnerProjectSuppliers(projectId: string): Observable<Supplier[]> {
    return this.http
      .get<any>(`${this.apiUrl}/partner/projects/${projectId}/suppliers`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAllPartnerSuppliers(): Observable<Supplier[]> {
    return this.http.get<any>(`${this.apiUrl}/partner/suppliers`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  createOrAssociateSupplier(
    projectId: string,
    supplier: CreateSupplierDto
  ): Observable<Supplier> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/suppliers`,
        supplier
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  disassociateSupplier(projectId: string, taxCode: string): Observable<void> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/suppliers/${taxCode}`
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  // Admin endpoints
  getAdminProjectSuppliers(projectId: string): Observable<Supplier[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/suppliers`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  getAdminPartnerSuppliers(partnerId: string): Observable<Supplier[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/partners/${partnerId}/suppliers`)
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
