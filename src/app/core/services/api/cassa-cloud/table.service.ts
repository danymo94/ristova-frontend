import { ICCRestaurantTable } from './../../../interfaces/cassaincloud.interfaces';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';
import { TokenService } from './token.service';

export interface TableSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface TableParams {
  start: number;
  limit: number;
  idsSalesPoint: number[];
  sorts?: TableSort[];
  ids?: string[];
  name?: string;
  idsRoom?: string[];
  externalId?: string[];
  lastUpdateFrom?: string; // timestamp
  lastUpdateTo?: string; // timestamp
}

export interface Table {
  id: string;
  name: string;
  idRoom?: string;
  externalId?: string;
  lastUpdate?: string;
  // Altri campi che potrebbero essere presenti nella risposta
}

export interface TablesResponse {
  tables: ICCRestaurantTable[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class CCTableService {
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
   * Recupera le tabelle del ristorante secondo i parametri specificati
   * @param apiKey La chiave API di Cassa in Cloud
   * @param params Parametri di ricerca per le tabelle
   * @returns Observable con la risposta contenente tabelle e conteggio totale
   */
  getTables(apiKey: string, params: TableParams): Observable<TablesResponse> {
    if (!params.idsSalesPoint || params.idsSalesPoint.length === 0) {
      return throwError(() => new Error('Il parametro idsSalesPoint è obbligatorio'));
    }

    // Costruiamo l'URL con i parametri obbligatori
    let queryString = `start=${params.start}&limit=${params.limit}`;
    
    // Aggiungiamo idsSalesPoint
    queryString += `&idsSalesPoint=[${params.idsSalesPoint.join(',')}]`;
    
    // Aggiungiamo i parametri opzionali se presenti
    if (params.sorts && params.sorts.length > 0) {
      params.sorts.forEach(sort => {
        queryString += `&sorts=${sort.field}:${sort.direction}`;
      });
    }
    
    if (params.ids && params.ids.length > 0) {
      queryString += `&ids=[${params.ids.join(',')}]`;
    }
    
    if (params.name) {
      queryString += `&name=${encodeURIComponent(params.name)}`;
    }
    
    if (params.idsRoom && params.idsRoom.length > 0) {
      queryString += `&idsRoom=[${params.idsRoom.join(',')}]`;
    }
    
    if (params.externalId && params.externalId.length > 0) {
      queryString += `&externalId=[${params.externalId.join(',')}]`;
    }
    
    if (params.lastUpdateFrom) {
      queryString += `&lastUpdateFrom=${params.lastUpdateFrom}`;
    }
    
    if (params.lastUpdateTo) {
      queryString += `&lastUpdateTo=${params.lastUpdateTo}`;
    }

    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<TablesResponse>(
          `${this.baseUrl}/risto/tables?${queryString}`,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error fetching tables:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching tables')
        );
      })
    );
  }

  /**
   * Recupera tutte le tabelle del ristorante iterando fino a prendere tutti i record disponibili
   * @param apiKey La chiave API di Cassa in Cloud
   * @param idsSalesPoint Lista di ID dei punti vendita
   * @param additionalParams Parametri opzionali aggiuntivi per la ricerca
   * @returns Observable con l'array completo di tutte le tabelle
   */
  getAllTables(
    apiKey: string,
    idsSalesPoint: number[],
    additionalParams: Omit<
      Partial<TableParams>,
      'start' | 'limit' | 'idsSalesPoint'
    > = {}
  ): Observable<ICCRestaurantTable[]> {
    const batchSize = 100; // Dimensione di ogni batch di dati

    // Prima chiamata per ottenere il conteggio totale
    const initialParams: TableParams = {
      start: 0,
      limit: batchSize,
      idsSalesPoint,
      ...additionalParams,
    };

    return this.getTables(apiKey, initialParams).pipe(
      mergeMap((initialResponse: TablesResponse) => {
        const { totalCount, tables: initialTables } = initialResponse;

        // Se abbiamo già tutti i dati o non ci sono dati, restituisci subito
        if (totalCount <= batchSize || totalCount === 0) {
          return of(initialTables);
        }

        // Calcola quante altre chiamate sono necessarie
        const remainingBatches = Math.ceil(
          (totalCount - batchSize) / batchSize
        );
        const additionalRequests: Observable<TablesResponse>[] = [];

        for (let i = 1; i <= remainingBatches; i++) {
          const batchParams: TableParams = {
            ...initialParams,
            start: i * batchSize,
          };
          additionalRequests.push(this.getTables(apiKey, batchParams));
        }

        // Combina i risultati di tutte le chiamate
        return forkJoin(additionalRequests).pipe(
          map((responses) => {
            const allTables = [...initialTables];
            responses.forEach((response) => {
              allTables.push(...response.tables);
            });
            return allTables;
          })
        );
      }),
      catchError((error) => {
        console.error('Error fetching all tables:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching all tables')
        );
      })
    );
  }
}