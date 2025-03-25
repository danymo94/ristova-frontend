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
} from '../../../models/warehouse.model';

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Partner endpoints
  getPartnerProjectWarehouses(
    projectId: string,
    type?: WarehouseType,
    search?: string
  ): Observable<Warehouse[]> {
    let url = `${this.apiUrl}/partner/projects/${projectId}/warehouses`;

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

  getPartnerWarehouse(
    projectId: string,
    id: string,
    withStats: boolean = false
  ): Observable<Warehouse> {
    let url = `${this.apiUrl}/partner/projects/${projectId}/warehouses/${id}`;
    if (withStats) {
      url += '?withStats=true';
    }

    return this.http.get<any>(url).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

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
