import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  StockMovement,
  StockMovementDetail,
  ProductBalance,
  WarehouseBalance,
  CreateMovementFromInvoiceDto,
  InboundMovementDto,
  OutboundMovementDto,
  InventoryCheckDto,
  TransferMovementDto,
  UpdateMovementStatusDto,
} from '../../../models/stock-movement.model';

@Injectable({
  providedIn: 'root',
})
export class StockMovementService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 1. Operazioni con Fatture

  /**
   * Crea un movimento di stock associando una fattura a un magazzino
   */
  createMovementFromInvoice(
    projectId: string,
    invoiceId: string,
    warehouseId: string,
    data: CreateMovementFromInvoiceDto
  ): Observable<StockMovement> {
    return this.http
      .post<any>(
        `${this.apiUrl}/partner/projects/${projectId}/invoices/${invoiceId}/stockmovements/warehouse/${warehouseId}`,
        data
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera tutti i movimenti di stock associati a una specifica fattura
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

  // 2. Operazioni Magazzino (fisica)

  /**
   * Registra l'ingresso di prodotti in un magazzino fisico
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
   * Crea un movimento di rettifica inventario
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

  /**
   * Recupera il saldo attuale di tutti i prodotti in un magazzino fisico
   */
  getWarehouseBalance(
    projectId: string,
    warehouseId: string
  ): Observable<WarehouseBalance> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/balance`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Recupera il saldo attuale di un prodotto specifico in un magazzino fisico
   */
  getProductBalance(
    projectId: string,
    warehouseId: string,
    rawProductId: string
  ): Observable<ProductBalance> {
    return this.http
      .get<any>(
        `${this.apiUrl}/partner/projects/${projectId}/warehouses/${warehouseId}/products/${rawProductId}/balance`
      )
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // 3. Operazioni Generali

  /**
   * Recupera tutti i movimenti di stock associati al progetto
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
   * Recupera i dettagli di un movimento specifico
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
   * Recupera i dettagli di un movimento specifico
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
   * Elimina un movimento di stock e tutti i suoi dettagli
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

  // Admin endpoints

  /**
   * Admin: Recupera tutti i movimenti di stock associati al progetto
   */
  getAdminProjectMovements(projectId: string): Observable<StockMovement[]> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/projects/${projectId}/stockmovements`)
      .pipe(
        map((response) => response.data || []),
        catchError(this.handleError)
      );
  }

  /**
   * Admin: Recupera i dettagli di un movimento specifico
   */
  getAdminMovement(projectId: string, id: string): Observable<StockMovement> {
    return this.http
      .get<any>(
        `${this.apiUrl}/admin/projects/${projectId}/stockmovements/${id}`
      )
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
