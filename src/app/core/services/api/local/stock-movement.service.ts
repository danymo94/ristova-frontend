import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  StockMovement,
  StockMovementDetail,
  StockMovementType,
  MovementStatus,
  InboundMovementDto,
  OutboundMovementDto,
  InventoryCheckDto,
  TransferMovementDto,
  UpdateMovementStatusDto,
  WarehouseInventorySummary,
} from '../../../../core/models/stock-movement.model';

/**
 * Servizio per la gestione delle operazioni di magazzino (stock movements)
 */
@Injectable({
  providedIn: 'root',
})
export class StockMovementService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ========== OPERAZIONI MAGAZZINO ==========

  /**
   * Registra l'ingresso di prodotti in un magazzino fisico
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del magazzino fisico
   * @param data Dati del movimento in ingresso
   * @returns Movimento di stock creato
   */
  createInboundMovement(
    projectId: string,
    warehouseId: string,
    data: InboundMovementDto
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/inbound`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Registra l'uscita di prodotti da un magazzino fisico
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del magazzino fisico
   * @param data Dati del movimento in uscita
   * @returns Movimento di stock creato
   */
  createOutboundMovement(
    projectId: string,
    warehouseId: string,
    data: OutboundMovementDto
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/outbound`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Crea un movimento di rettifica inventario per allineare le quantità fisiche con quelle nel sistema
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del magazzino fisico
   * @param data Dati della rettifica con quantità attese e quantità effettive
   * @returns Movimento di rettifica inventario creato
   */
  createInventoryCheck(
    projectId: string,
    warehouseId: string,
    data: InventoryCheckDto
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/inventorycheck`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Trasferisce prodotti da un magazzino fisico a un altro
   * 
   * @param projectId ID del progetto
   * @param data Dati del trasferimento con magazzino origine, destinazione e prodotti
   * @returns Movimento di trasferimento creato
   */
  createTransferMovement(
    projectId: string,
    data: TransferMovementDto
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/transfer`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // ========== RECUPERO MOVIMENTI ==========

  /**
   * Recupera tutti i movimenti di stock associati a un progetto
   * 
   * @param projectId ID del progetto
   * @returns Lista di movimenti di stock
   */
  getProjectMovements(projectId: string): Observable<StockMovement[]> {
    return this.http
      .get<any>(`${this.apiUrl}/partner/projects/${projectId}/stockmovements`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera tutti i movimenti di stock associati a un magazzino specifico
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del magazzino
   * @returns Lista di movimenti di stock del magazzino
   */
  getWarehouseMovements(
    projectId: string,
    warehouseId: string
  ): Observable<StockMovement[]> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/stockmovements`
      )
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera tutti i movimenti di stock associati a una specifica fattura
   * 
   * @param projectId ID del progetto
   * @param invoiceId ID della fattura
   * @returns Lista di movimenti associati alla fattura
   */
  getInvoiceMovements(
    projectId: string,
    invoiceId: string
  ): Observable<StockMovement[]> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/invoices/${invoiceId}/stockmovements`
      )
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera un movimento specifico per ID
   * 
   * @param projectId ID del progetto
   * @param id ID del movimento di stock
   * @returns Dettagli del movimento
   */
  getMovement(projectId: string, id: string): Observable<StockMovement> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/stockmovements/${id}`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera i dettagli (righe) di un movimento specifico
   * 
   * @param projectId ID del progetto
   * @param id ID del movimento di stock
   * @returns Lista di dettagli del movimento
   */
  getMovementDetails(
    projectId: string,
    id: string
  ): Observable<StockMovementDetail[]> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/stockmovements/${id}/details`
      )
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera l'inventario completo di un magazzino specifico
   * 
   * @param projectId ID del progetto
   * @param warehouseId ID del magazzino
   * @returns Dati dell'inventario del magazzino
   */
  getWarehouseInventory(
    projectId: string,
    warehouseId: string
  ): Observable<any> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/inventory`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // ========== GESTIONE MOVIMENTI ==========

  /**
   * Elimina un movimento di stock e tutti i suoi dettagli
   * 
   * @param projectId ID del progetto
   * @param id ID del movimento di stock
   * @returns Observable<void>
   */
  deleteMovement(projectId: string, id: string): Observable<void> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/partner/projects/${projectId}/stockmovements/${id}`
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  /**
   * Aggiorna lo stato di un movimento di stock
   * Stati possibili: draft, confirmed, cancelled
   * 
   * @param projectId ID del progetto
   * @param id ID del movimento di stock
   * @param data Dati di aggiornamento stato
   * @returns Movimento con stato aggiornato
   */
  updateMovementStatus(
    projectId: string,
    id: string,
    data: UpdateMovementStatusDto
  ): Observable<StockMovement> {
    return this.http
      .patch<any>(
        `${this.apiUrl}/partner/projects/${projectId}/stockmovements/${id}/status`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // ========== ENDPOINT ADMIN ==========

  /**
   * Recupera tutti i movimenti di stock nel sistema (solo per admin)
   * 
   * @returns Lista di tutti i movimenti
   */
  getAllMovements(): Observable<StockMovement[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/stockmovements`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera un riepilogo dell'inventario di tutti i magazzini (solo per admin)
   * 
   * @returns Riepilogo degli inventari di tutti i magazzini
   */
  getWarehousesInventorySummary(): Observable<WarehouseInventorySummary[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/warehouses/inventory/summary`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Gestisce gli errori delle chiamate API
   * 
   * @param error L'errore generato dalla chiamata HTTP
   * @returns Observable che lancia l'errore
   */
  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}