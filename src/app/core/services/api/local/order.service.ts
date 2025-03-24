import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Order,
  OrderSearchFilters,
  CreateTableOrderDto,
  CreatePreOrderDto,
  OrderCreationResponse,
  CustomerOrdersResponse,
  PartnerOrdersResponse,
} from '../../../models/order.model';
import { AuthStore } from '../../../store/auth.signal-store';

/**
 * Servizio per la gestione degli ordini con le API locali
 */
@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  /**
   * Crea un ordine da un tavolo
   * @param projectId ID del progetto
   * @param tableOrderData Dati per la creazione dell'ordine da tavolo
   * @returns Observable con la risposta dell'API
   */
  createTableOrder(
    projectId: string,
    tableOrderData: CreateTableOrderDto
  ): Observable<OrderCreationResponse> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<OrderCreationResponse>(
        `${this.apiUrl}/public/projects/${projectId}/orders/table`,
        tableOrderData,
        { headers }
      )
      .pipe(
        map((response) => response),
        catchError((error) => {
          console.error('Error creating table order:', error);
          return throwError(
            () => new Error(error.message || 'Error creating table order')
          );
        })
      );
  }

  /**
   * Crea un preordine (ritiro o consegna)
   * @param projectId ID del progetto
   * @param preOrderData Dati per la creazione del preordine
   * @returns Observable con la risposta dell'API
   */
  createPreOrder(
    projectId: string,
    preOrderData: CreatePreOrderDto
  ): Observable<OrderCreationResponse> {
    const headers = this.getAuthHeaders(false); // Autenticazione obbligatoria per i preordini

    return this.http
      .post<OrderCreationResponse>(
        `${this.apiUrl}/public/projects/${projectId}/orders/preorder`,
        preOrderData,
        { headers }
      )
      .pipe(
        map((response) => response),
        catchError((error) => {
          console.error('Error creating pre-order:', error);
          return throwError(
            () => new Error(error.message || 'Error creating pre-order')
          );
        })
      );
  }

  /**
   * Recupera gli ordini del cliente autenticato
   * @returns Observable con la lista degli ordini del cliente
   */
  getCustomerOrders(): Observable<CustomerOrdersResponse> {
    const headers = this.getAuthHeaders(false); // Autenticazione obbligatoria

    return this.http
      .get<CustomerOrdersResponse>(`${this.apiUrl}/public/customer/orders`, {
        headers,
      })
      .pipe(
        map((response) => response),
        catchError((error) => {
          console.error('Error fetching customer orders:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching customer orders')
          );
        })
      );
  }

  /**
   * Recupera gli ordini di un progetto del partner
   * @param projectId ID del progetto
   * @param filters Filtri opzionali per la ricerca
   * @returns Observable con la lista degli ordini
   */
  getPartnerOrders(
    projectId: string,
    filters?: OrderSearchFilters
  ): Observable<PartnerOrdersResponse> {
    const headers = this.getAuthHeaders(false); // Autenticazione obbligatoria
    let params = new HttpParams().set('projectId', projectId);

    // Aggiungi filtri di ricerca se presenti
    if (filters) {
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach((status) => {
            params = params.append('status', status);
          });
        } else {
          params = params.set('status', filters.status);
        }
      }

      if (filters.type) {
        params = params.set('type', filters.type);
      }

      if (filters.customerId) {
        params = params.set('customerId', filters.customerId);
      }

      if (filters.tableId) {
        params = params.set('tableId', filters.tableId);
      }

      if (filters.fromDate) {
        params = params.set('fromDate', filters.fromDate);
      }

      if (filters.toDate) {
        params = params.set('toDate', filters.toDate);
      }
    }

    return this.http
      .get<PartnerOrdersResponse>(`${this.apiUrl}/partner/orders`, {
        headers,
        params,
      })
      .pipe(
        map((response) => response),
        catchError((error) => {
          console.error('Error fetching partner orders:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching partner orders')
          );
        })
      );
  }

  /**
   * Recupera un ordine specifico
   * @param orderId ID dell'ordine
   * @returns Observable con i dettagli dell'ordine
   */
  getOrderDetails(orderId: string): Observable<Order> {
    const headers = this.getAuthHeaders(false); // Autenticazione obbligatoria

    return this.http
      .get<{ order: Order }>(`${this.apiUrl}/partner/orders/${orderId}`, {
        headers,
      })
      .pipe(
        map((response) => response.order),
        catchError((error) => {
          console.error(`Error fetching order ${orderId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching order details')
          );
        })
      );
  }

  /**
   * Aggiorna lo stato di un ordine
   * @param orderId ID dell'ordine
   * @param status Nuovo stato dell'ordine
   * @returns Observable con l'ordine aggiornato
   */
  updateOrderStatus(orderId: string, status: string): Observable<Order> {
    const headers = this.getAuthHeaders(false); // Autenticazione obbligatoria

    return this.http
      .patch<{ order: Order }>(
        `${this.apiUrl}/partner/orders/${orderId}/status`,
        { status },
        { headers }
      )
      .pipe(
        map((response) => response.order),
        catchError((error) => {
          console.error(`Error updating order ${orderId} status:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating order status')
          );
        })
      );
  }

  /**
   * Recupera headers di autorizzazione
   * @param required Se l'autorizzazione è obbligatoria
   * @returns HttpHeaders con token di autorizzazione (se presente)
   */
  private getAuthHeaders(required: boolean = false): HttpHeaders {
    const token = this.authStore.token();

    if (required && !token) {
      throw new Error('Authorization token is required');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }
}
