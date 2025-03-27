import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Warehouse,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseType,
  WarehouseBalance,
} from '../../../models/warehouse.model';

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // GET /partner/projects/:projectId/warehouses
  getPartnerProjectWarehouses(
    projectId: string,
    type?: WarehouseType,
    search?: string,
    withStats: boolean = true
  ): Observable<Warehouse[]> {
    let url = `${this.apiUrl}/partner/projects/${projectId}/warehouses`;

    // Aggiungi parametri di query opzionali
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (withStats !== undefined) params['withStats'] = withStats.toString();

    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.http.get<any>(url).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  // GET /partner/projects/:projectId/warehouses/:id
  getPartnerWarehouse(
    projectId: string,
    id: string,
    withStats: boolean = true
  ): Observable<Warehouse> {
    let url = `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}`;
    if (withStats !== undefined) {
      url += `?withStats=${withStats}`;
    }

    return this.http.get<any>(url).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  // POST /partner/projects/:projectId/warehouses
  createWarehouse(
    projectId: string,
    warehouse: CreateWarehouseDto
  ): Observable<Warehouse> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses`,
        warehouse
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // PUT /partner/projects/:projectId/warehouses/:id
  updateWarehouse(
    projectId: string,
    id: string,
    warehouse: UpdateWarehouseDto
  ): Observable<Warehouse> {
    return this.http
      .put<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}`,
        warehouse
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // DELETE /partner/projects/:projectId/warehouses/:id
  deleteWarehouse(projectId: string, id: string): Observable<void> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}`
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  // PATCH /partner/projects/:projectId/warehouses/:id/status
  updateWarehouseStatus(
    projectId: string,
    id: string,
    isActive: boolean
  ): Observable<Warehouse> {
    return this.http
      .patch<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}/status`,
        { isActive }
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // GET /partner/projects/:projectId/warehouses/:id/balance
  getWarehouseBalance(
    projectId: string,
    id: string
  ): Observable<WarehouseBalance> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}/balance`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // Admin endpoints
  getAdminProjectWarehouses(
    projectId: string,
    type?: WarehouseType,
    search?: string
  ): Observable<Warehouse[]> {
    let url = `${this.apiUrl}/admin/projects/${projectId}/warehouses`;

    // Aggiungi parametri di query opzionali
    const params: Record<string, string> = {};
    if (type) params['type'] = type;
    if (search) params['search'] = search;

    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.http.get<any>(url).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  getAdminWarehouse(
    projectId: string,
    id: string,
    withStats: boolean = false
  ): Observable<Warehouse> {
    let url = `${this.apiUrl}/admin/projects/${projectId}/warehouses/${id}`;
    if (withStats) {
      url += '?withStats=true';
    }

    return this.http.get<any>(url).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}
