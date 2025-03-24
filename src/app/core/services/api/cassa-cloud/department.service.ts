import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpBackend,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { TokenService } from './token.service';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Tax } from './tax.service';

/**
 * Enum per i tipi di vendita dei dipartimenti
 */
export enum SalesType {
  GOODS = 'GOODS',
  SERVICES = 'SERVICES',
}

/**
 * Interfaccia che rappresenta un dipartimento in Cassa in Cloud
 */
export interface Department {
  id: string;
  description: string;
  descriptionLabel: string;
  descriptionReceipt: string;
  idTax: string;
  tax?: Tax; // Tax applied on department
  color: string;
  amountLimit?: number;
  externalId?: string;
  idSalesPoint: number;
  lastUpdate?: string; // timestamp ISO
  salesType: SalesType;
}

/**
 * Risposta dell'API per un singolo dipartimento
 */
export interface DepartmentResponse {
  department: Department;
}

/**
 * Risposta dell'API per più dipartimenti
 */
export interface DepartmentsResponse {
  departments: Department[];
  totalCount: number;
}

/**
 * Parametri di ricerca per i dipartimenti
 */
export interface DepartmentSearchParams {
  start?: number;
  limit?: number;
  ids?: string[];
  idsSalesPoint?: number[];
  idsTax?: string[];
  description?: string;
  lastUpdateFrom?: string; // timestamp ISO
  lastUpdateTo?: string; // timestamp ISO
}

/**
 * Parametri per la creazione di un nuovo dipartimento
 */
export interface DepartmentCreateParams {
  description: string;
  descriptionLabel: string;
  descriptionReceipt: string;
  idTax: string;
  color: string;
  amountLimit?: number;
  externalId?: string;
  idSalesPoint: number;
  salesType: SalesType;
}

/**
 * Parametri per l'aggiornamento di un dipartimento
 */
export interface DepartmentUpdateParams {
  description?: string;
  descriptionLabel?: string;
  descriptionReceipt?: string;
  idTax?: string;
  color?: string;
  amountLimit?: number;
  externalId?: string;
  salesType?: SalesType;
}

@Injectable({
  providedIn: 'root',
})
export class DepartmentService {
  // Utilizzo di inject() per le dipendenze
  private httpBackend = inject(HttpBackend);
  private tokenService = inject(TokenService);

  // Proprietà del servizio
  private httpClient: HttpClient;
  private baseUrl: string;

  constructor() {
    // Creiamo un'istanza di HttpClient che bypassa gli interceptor
    this.httpClient = new HttpClient(this.httpBackend);
    // Base URL dell'API Cassa in Cloud
    this.baseUrl = 'https://api.cassanova.com';
  }

  /**
   * Recupera tutti i dipartimenti secondo i parametri di ricerca specificati
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri di ricerca opzionali
   * @returns Observable con la lista dei dipartimenti
   */
  getDepartments(
    apiKey: string,
    params: DepartmentSearchParams = { start: 0, limit: 100 }
  ): Observable<DepartmentsResponse> {
    // Costruisce i parametri di query
    let httpParams = new HttpParams()
      .set('start', params.start?.toString() || '0')
      .set('limit', params.limit?.toString() || '100');

    // Aggiungi parametri opzionali se presenti
    if (params.ids && params.ids.length > 0) {
      // Passiamo gli IDs come array nel formato [id1,id2,...]
      httpParams = httpParams.set('ids', `[${params.ids.join(',')}]`);
    }

    if (params.idsSalesPoint && params.idsSalesPoint.length > 0) {
      // Passiamo gli IDs dei punti vendita come array nel formato [id1,id2,...]
      httpParams = httpParams.set(
        'idsSalesPoint',
        `[${params.idsSalesPoint.join(',')}]`
      );
    }

    if (params.idsTax && params.idsTax.length > 0) {
      // Passiamo gli IDs delle tasse come array nel formato [id1,id2,...]
      httpParams = httpParams.set('idsTax', `[${params.idsTax.join(',')}]`);
    }

    if (params.description) {
      httpParams = httpParams.set('description', params.description);
    }

    if (params.lastUpdateFrom) {
      httpParams = httpParams.set('lastUpdateFrom', params.lastUpdateFrom);
    }

    if (params.lastUpdateTo) {
      httpParams = httpParams.set('lastUpdateTo', params.lastUpdateTo);
    }

    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<DepartmentsResponse>(
          `${this.baseUrl}/departments`,
          {
            headers,
            params: httpParams,
          }
        );
      })
    );
  }

  /**
   * Recupera i dipartimenti per un punto vendita specifico
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @returns Observable con la lista dei dipartimenti del punto vendita
   */
  getDepartmentsBySalesPoint(
    apiKey: string,
    salesPointId: number
  ): Observable<DepartmentsResponse> {
    return this.getDepartments(apiKey, {
      start: 0,
      limit: 100,
      idsSalesPoint: [salesPointId],
    });
  }

  /**
   * Recupera un dipartimento specifico per ID
   * @param apiKey - La chiave API da utilizzare
   * @param departmentId - ID del dipartimento da recuperare
   * @returns Observable con il dipartimento richiesto
   */
  getDepartmentById(
    apiKey: string,
    departmentId: string
  ): Observable<DepartmentResponse> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<DepartmentResponse>(
          `${this.baseUrl}/departments/${departmentId}`,
          { headers }
        );
      })
    );
  }

  /**
   * Crea un nuovo dipartimento
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri per la creazione del dipartimento
   * @returns Observable con il dipartimento creato
   */
  createDepartment(
    apiKey: string,
    params: DepartmentCreateParams
  ): Observable<Department> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Rimuovi i campi null o undefined dalla richiesta
        const cleanParams: Record<string, any> = {};
        Object.entries(params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });

        // Converti i parametri in formato JSON
        const body = JSON.stringify(cleanParams);

        return this.httpClient.post<Department>(
          `${this.baseUrl}/departments`,
          body,
          { headers }
        );
      })
    );
  }

  /**
   * Aggiorna un dipartimento specifico
   * @param apiKey - La chiave API da utilizzare
   * @param departmentId - ID del dipartimento da aggiornare
   * @param params - Parametri di aggiornamento
   * @returns Observable con il dipartimento aggiornato o void se risposta 204
   */
  updateDepartment(
    apiKey: string,
    departmentId: string,
    params: DepartmentUpdateParams
  ): Observable<Department | void> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Rimuovi i campi null o undefined dalla richiesta
        const cleanParams: Record<string, any> = {};
        Object.entries(params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });

        // Converti i parametri in formato JSON
        const body = JSON.stringify(cleanParams);

        // Configura per gestire sia risposte json che risposte vuote (204)
        return this.httpClient
          .put<Department>(
            `${this.baseUrl}/departments/${departmentId}`,
            body,
            {
              headers,
              observe: 'response',
              responseType: 'json' as 'json',
            }
          )
          .pipe(
            switchMap((response) => {
              // Se la risposta è 204 (No Content), creiamo un Observable di void
              if (response.status === 204) {
                return new Observable<void>((observer) => {
                  observer.next();
                  observer.complete();
                });
              }

              // Altrimenti restituiamo il corpo della risposta
              return new Observable<Department>((observer) => {
                observer.next(
                  response.body ||
                    ({ ...params, id: departmentId } as Department)
                );
                observer.complete();
              });
            })
          );
      })
    );
  }

  /**
   * Elimina un dipartimento specifico
   * @param apiKey - La chiave API da utilizzare
   * @param departmentId - ID del dipartimento da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteDepartment(apiKey: string, departmentId: string): Observable<void> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Configuriamo la risposta per accettare testo semplice invece di JSON
        // in modo da gestire correttamente le risposte vuote
        // Aggiungiamo anche un body vuoto come richiesto dall'API
        return this.httpClient
          .delete<void>(`${this.baseUrl}/departments/${departmentId}`, {
            headers,
            responseType: 'text' as 'json',
            body: {}, // Aggiungiamo un body vuoto
          })
          .pipe(
            // Trasformiamo la risposta (anche se vuota) in un Observable<void>
            switchMap(() => {
              return new Observable<void>((observer) => {
                observer.next();
                observer.complete();
              });
            })
          );
      })
    );
  }
}
