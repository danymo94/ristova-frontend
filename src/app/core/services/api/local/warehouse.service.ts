import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Warehouse,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseType,
  WarehouseStats,
  WarehouseInventory,
  WarehouseProductInventory,
  WarehouseMovementSummary
} from '../../../models/warehouse.model';

/**
 * Servizio per la gestione dei magazzini (warehouse)
 * Implementa le API per CRUD dei magazzini e operazioni specifiche
 */
@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ===== PARTNER ENDPOINTS =====

  /**
   * Crea un nuovo warehouse associato a un progetto specifico
   * 
   * @param projectId ID del progetto
   * @param warehouse Dati del warehouse da creare (name e type sono obbligatori)
   * @returns Il warehouse creato
   */
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

  /**
   * Recupera tutti i warehouse associati a un progetto, con possibilità di filtri
   * 
   * @param projectId ID del progetto
   * @param options Opzioni di filtro (type, search, withStats)
   * @returns Lista dei warehouse
   */
  getPartnerProjectWarehouses(
    projectId: string,
    options?: {
      type?: WarehouseType;
      search?: string;
      withStats?: boolean;
    }
  ): Observable<Warehouse[]> {
    const { type, search, withStats = true } = options || {};
    const params: Record<string, string> = {};
    
    if (type) params['type'] = type;
    if (search) params['search'] = search;
    if (withStats !== undefined) params['withStats'] = withStats.toString();

    const queryString = new URLSearchParams(params).toString();
    const url = `${this.apiUrl}/partner/projects/${projectId}/warehouses${
      queryString ? `?${queryString}` : ''
    }`;

    return this.http.get<any>(url).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  /**
   * Recupera i dettagli di un singolo warehouse
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @param withStats Include statistiche di base
   * @returns Il warehouse richiesto
   */
  getPartnerWarehouse(
    projectId: string,
    warehouseId: string,
    withStats: boolean = true
  ): Observable<Warehouse> {
    const url = `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}`;

    return this.http.get<any>(url).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Aggiorna un warehouse esistente
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @param warehouse Dati per l'aggiornamento
   * @returns Il warehouse aggiornato
   */
  updateWarehouse(
    projectId: string,
    warehouseId: string,
    warehouse: UpdateWarehouseDto
  ): Observable<Warehouse> {
    return this.http
      .put<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}`,
        warehouse
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Elimina un warehouse esistente
   * L'operazione non è consentita se il warehouse ha movimenti associati
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   */
  deleteWarehouse(projectId: string, warehouseId: string): Observable<void> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}`
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  /**
   * Attiva o disattiva un warehouse senza eliminarlo
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @param isActive Stato di attivazione del warehouse
   * @returns Il warehouse aggiornato
   */
  updateWarehouseStatus(
    projectId: string,
    warehouseId: string,
    isActive: boolean
  ): Observable<Warehouse> {
    return this.http
      .patch<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/status`,
        { isActive }
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera statistiche dettagliate di un warehouse specifico
   * Include dati sui movimenti e sull'inventario
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @returns Statistiche dettagliate
   */
  getWarehouseStats(
    projectId: string,
    warehouseId: string
  ): Observable<WarehouseStats> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/stats`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera l'inventario dettagliato di un warehouse fisico
   * Disponibile solo per warehouse di tipo PHYSICAL
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @returns Inventario del magazzino
   */
  getWarehouseInventory(
    projectId: string,
    warehouseId: string
  ): Observable<WarehouseInventory> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/inventory`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera i dati di inventario di un singolo prodotto in un warehouse fisico
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @param rawProductId ID del prodotto grezzo
   * @returns Dati di inventario del prodotto
   */
  getWarehouseProductInventory(
    projectId: string,
    warehouseId: string,
    rawProductId: string
  ): Observable<WarehouseProductInventory> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/products/${rawProductId}`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera un riepilogo aggregato dei movimenti di stock per un warehouse
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @returns Riepilogo dei movimenti
   */
  getWarehouseMovementSummary(
    projectId: string,
    warehouseId: string
  ): Observable<WarehouseMovementSummary> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/summary`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // ===== ADMIN ENDPOINTS =====

  /**
   * Recupera tutti i warehouse di un progetto (admin)
   * 
   * @param projectId ID del progetto
   * @param options Opzioni di filtro (type, search, withStats)
   * @returns Lista dei warehouse
   */
  getAdminProjectWarehouses(
    projectId: string,
    options?: {
      type?: WarehouseType;
      search?: string;
      withStats?: boolean;
    }
  ): Observable<Warehouse[]> {
    const { type, search, withStats = false } = options || {};
    const params: Record<string, string> = {};
    
    if (type) params['type'] = type;
    if (search) params['search'] = search;
    if (withStats !== undefined) params['withStats'] = withStats.toString();

    const queryString = new URLSearchParams(params).toString();
    const url = `${this.apiUrl}/admin/projects/${projectId}/warehouses${
      queryString ? `?${queryString}` : ''
    }`;

    return this.http.get<any>(url).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  /**
   * Recupera un singolo warehouse (admin)
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del warehouse
   * @param withStats Include statistiche di base
   * @returns Il warehouse richiesto
   */
  getAdminWarehouse(
    projectId: string,
    warehouseId: string,
    withStats: boolean = false
  ): Observable<Warehouse> {
    const url = `${this.apiUrl}/admin/projects/${projectId}/warehouses/${warehouseId}${
      withStats ? '?withStats=true' : ''
    }`;

    return this.http.get<any>(url).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Gestisce gli errori delle richieste API
   * 
   * @param error Errore ricevuto
   */
  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}