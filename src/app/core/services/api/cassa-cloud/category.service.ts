import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpBackend,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { TokenService } from './token.service';
import { Observable, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { ICCCategory } from '../../../interfaces/cassaincloud.interfaces';
import {
  CCCategoryCreateParams,
  CCCategoryUpdateParams,
} from '../../../models/category.model';

/**
 * Enum per i canali di visibilità dei prodotti
 */
export enum ProductChannel {
  RISTO = 'RISTO',
  SALE = 'SALE',
  ECOMMERCE = 'ECOMMERCE',
  MOBILECOMMERCE = 'MOBILE_COMMERCE',
  SELFORDER = 'SELF_ORDER',
  KIOSK = 'KIOSK',
}

/**
 * Risposta dell'API per una singola categoria
 */
export interface CategoryResponse {
  category: ICCCategory;
}

/**
 * Risposta dell'API per più categorie
 */
export interface CategoriesResponse {
  categories: ICCCategory[];
  totalCount: number;
}

/**
 * Interfaccia per il parametro di ordinamento
 */
export interface Sort {
  property: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Parametri di ricerca per le categorie
 */
export interface CategorySearchParams {
  start?: number;
  limit?: number;
  sorts?: Sort[];
  ids?: string[];
  idsSalesPoint?: number[];
  description?: string;
  lastUpdateFrom?: string; // timestamp ISO
  lastUpdateTo?: string; // timestamp ISO
  enabledForChannels?: ProductChannel[]; // Filtra per canali abilitati
  itemListVisibility?: boolean; // Applica regole di visibilità per account
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
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
   * Recupera tutte le categorie secondo i parametri di ricerca specificati
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri di ricerca opzionali
   * @returns Observable con la lista delle categorie
   */
  getCategories(
    apiKey: string,
    params: CategorySearchParams = { start: 0, limit: 100 }
  ): Observable<CategoriesResponse> {
    // Costruiamo un oggetto per i parametri base
    const queryParams: Record<string, string> = {
      start: params.start?.toString() || '0',
      limit: params.limit?.toString() || '100',
    };

    // Aggiungi parametri opzionali se presenti
    if (params.description) {
      queryParams['description'] = params.description;
    }

    if (params.lastUpdateFrom) {
      queryParams['lastUpdateFrom'] = params.lastUpdateFrom;
    }

    if (params.lastUpdateTo) {
      queryParams['lastUpdateTo'] = params.lastUpdateTo;
    }

    // Creiamo la stringa di query manualmente per evitare i caratteri di escape
    let queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Gestiamo separatamente gli array per mantenere i caratteri [] non codificati
    if (params.ids && params.ids.length > 0) {
      queryString += `&ids=[${params.ids.join(',')}]`;
    }

    if (params.idsSalesPoint && params.idsSalesPoint.length > 0) {
      queryString += `&idsSalesPoint=[${params.idsSalesPoint.join(',')}]`;
    }



    if (params.itemListVisibility !== undefined) {
      queryString += `&itemListVisibility=${params.itemListVisibility}`;
    }

    // Gestione dell'ordinamento
    if (params.sorts && params.sorts.length > 0) {
      params.sorts.forEach((sort) => {
        queryString += `&sorts=${sort.property}:${sort.direction}`;
      });
    }

    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Utilizziamo l'URL con la stringa di query invece di HttpParams
        return this.httpClient.get<CategoriesResponse>(
          `${this.baseUrl}/categories?${queryString}`,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error fetching categories:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching categories')
        );
      })
    );
  }

  /**
   * Recupera le categorie per un punto vendita specifico
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @returns Observable con la lista delle categorie del punto vendita
   */
  getCategoriesBySalesPoint(
    apiKey: string,
    salesPointId: number,
    enabledForChannels?: ProductChannel[]
  ): Observable<CategoriesResponse> {
    // Costruiamo i parametri di ricerca
    const searchParams: CategorySearchParams = {
      start: 0,
      limit: 100,
      idsSalesPoint: [salesPointId],
    };

    // Aggiungiamo i canali se specificati
    if (enabledForChannels && enabledForChannels.length > 0) {
      searchParams.enabledForChannels = enabledForChannels;
    }

    return this.getCategories(apiKey, searchParams);
  }

  /**
   * Recupera una categoria specifica per ID
   * @param apiKey - La chiave API da utilizzare
   * @param categoryId - ID della categoria da recuperare
   * @returns Observable con la categoria richiesta
   */
  getCategoryById(
    apiKey: string,
    categoryId: string
  ): Observable<CategoryResponse> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<CategoryResponse>(
          `${this.baseUrl}/categories/${categoryId}`,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error fetching category by id:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching category')
        );
      })
    );
  }

  /**
   * Crea una nuova categoria
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri per la creazione della categoria
   * @returns Observable con la categoria creata
   */
  createCategory(
    apiKey: string,
    params: CCCategoryCreateParams
  ): Observable<ICCCategory> {
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

        return this.httpClient.post<ICCCategory>(
          `${this.baseUrl}/categories`,
          body,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error creating category:', error);
        return throwError(
          () => new Error(error.message || 'Error creating category')
        );
      })
    );
  }

  /**
   * Aggiorna una categoria specifica
   * @param apiKey - La chiave API da utilizzare
   * @param categoryId - ID della categoria da aggiornare
   * @param params - Parametri di aggiornamento
   * @returns Observable con la categoria aggiornata o void se risposta 204
   */
  updateCategory(
    apiKey: string,
    categoryId: string,
    params: CCCategoryUpdateParams
  ): Observable<ICCCategory | void> {
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
          .put<ICCCategory>(`${this.baseUrl}/categories/${categoryId}`, body, {
            headers,
            observe: 'response',
            responseType: 'json' as 'json',
          })
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
              return new Observable<ICCCategory>((observer) => {
                observer.next(
                  response.body ||
                    ({ ...params, id: categoryId } as ICCCategory)
                );
                observer.complete();
              });
            })
          );
      }),
      catchError((error) => {
        console.error('Error updating category:', error);
        return throwError(
          () => new Error(error.message || 'Error updating category')
        );
      })
    );
  }

  /**
   * Elimina una categoria specifica
   * @param apiKey - La chiave API da utilizzare
   * @param categoryId - ID della categoria da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteCategory(apiKey: string, categoryId: string): Observable<void> {
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
          .delete<void>(`${this.baseUrl}/categories/${categoryId}`, {
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
      }),
      catchError((error) => {
        console.error('Error deleting category:', error);
        return throwError(
          () => new Error(error.message || 'Error deleting category')
        );
      })
    );
  }
}
