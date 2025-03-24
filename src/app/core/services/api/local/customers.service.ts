import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateCustomerCreditDto,
} from '../../../models/customer.model';
import { AuthStore } from '../../../store/auth.signal-store';

interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  constructor() {}

  // PARTNER ENDPOINTS

  /**
   * Recupera tutti i clienti di un progetto
   */
  getPartnerCustomers(projectId: string): Observable<Customer[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Customer[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching customers:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching customers')
          );
        })
      );
  }

  /**
   * Recupera un cliente specifico
   */
  getPartnerCustomer(
    projectId: string,
    customerId: string
  ): Observable<Customer> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Customer>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers/${customerId}`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching customer ${customerId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching customer')
          );
        })
      );
  }

  /**
   * Crea un nuovo cliente
   */
  createPartnerCustomer(
    projectId: string,
    customerData: CreateCustomerDto
  ): Observable<Customer> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Customer>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers`,
        customerData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating customer:', error);
          return throwError(
            () => new Error(error.message || 'Error creating customer')
          );
        })
      );
  }

  /**
   * Aggiorna un cliente esistente
   */
  updatePartnerCustomer(
    projectId: string,
    customerId: string,
    customerData: UpdateCustomerDto
  ): Observable<Customer> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Customer>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers/${customerId}`,
        customerData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating customer ${customerId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating customer')
          );
        })
      );
  }

  /**
   * Aggiorna il credito di un cliente
   */
  updatePartnerCustomerCredit(
    projectId: string,
    customerId: string,
    creditData: UpdateCustomerCreditDto
  ): Observable<Customer> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Customer>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers/${customerId}/credit`,
        creditData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating customer credit:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating customer credit')
          );
        })
      );
  }

  /**
   * Disattiva (soft delete) un cliente
   */
  deletePartnerCustomer(
    projectId: string,
    customerId: string
  ): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(
        `${this.apiUrl}/partner/projects/${projectId}/customers/${customerId}`,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting customer ${customerId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting customer')
          );
        })
      );
  }

  // METODI DI UTILITÀ

  /**
   * Recupera gli header di autenticazione
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }
}
