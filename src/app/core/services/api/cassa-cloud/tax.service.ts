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

/**
 * Rappresentazione dell'enum NaturaIvaEsente per i tipi di esenzione IVA
 */
export enum NaturaIvaEsente {
  N1 = 'N1', // Escluso Art. 15
  N2 = 'N2', // Non soggetto
  N3 = 'N3', // Non imponibile
  N4 = 'N4', // Esente
  N5 = 'N5', // Regime del margine
  N6 = 'N6', // Inversione contabile
}

/**
 * Interfaccia che rappresenta una tassa in Cassa in Cloud
 */
export interface Tax {
  id: string;
  description: string;
  rate: number; // Valore in percentuale (es. 22.00 per IVA al 22%)
  externalId?: string;
  nature?: NaturaIvaEsente; // Tipo di esenzione, valido solo se rate è zero
  noFiscalPrint?: boolean; // Se true, la riga dello scontrino non verrà stampata (solo se rate è zero)
  noFiscalPrintOnMixedReceipt?: boolean; // Non stampata anche su scontrini misti (solo se rate è zero)
  ventilazione?: boolean; // Se true, la tassa è configurata con "ventilazione" per contabilità separata
  atecoCode?: string; // Se ventilazione = true, questo codice è obbligatorio e identifica un'attività economica
  idSalesPoint: number;
  dateLastUpdate?: string; // timestamp ISO
  lastUpdate?: string; // timestamp ISO (alias di dateLastUpdate)
  dateInsert?: string; // timestamp ISO
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * Interfaccia per il parametro di ordinamento
 */
export interface Sort {
  property: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Risposta dell'API per le tasse
 */
export interface TaxesResponse {
  taxes: Tax[];
  totalCount: number;
}

/**
 * Parametri di ricerca per le tasse
 */
export interface TaxSearchParams {
  start?: number;
  limit?: number;
  sorts?: Sort[];
  ids?: string[];
  idsSalesPoint?: number[];
  description?: string;
  lastUpdateFrom?: string; // timestamp ISO
  lastUpdateTo?: string; // timestamp ISO
}

/**
 * Parametri per l'aggiornamento di una tassa
 */
export interface TaxUpdateParams {
  description?: string;
  externalId?: string;
  rate?: number; // Aggiungiamo l'aliquota
  nature?: NaturaIvaEsente;
  noFiscalPrint?: boolean;
  noFiscalPrintOnMixedReceipt?: boolean;
  ventilazione?: boolean;
  atecoCode?: string;
}

/**
 * Parametri per la creazione di una nuova tassa
 */
export interface TaxCreateParams {
  description: string;
  rate: number;
  externalId?: string;
  nature?: NaturaIvaEsente;
  noFiscalPrint?: boolean;
  noFiscalPrintOnMixedReceipt?: boolean;
  ventilazione?: boolean;
  atecoCode?: string;
  idSalesPoint: number;
}

@Injectable({
  providedIn: 'root',
})
export class TaxService {
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
   * Recupera tutte le tasse secondo i parametri di ricerca specificati
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri di ricerca opzionali
   * @returns Observable con la lista delle tasse
   */
  getTaxes(
    apiKey: string,
    params: TaxSearchParams = { start: 0, limit: 100 }
  ): Observable<TaxesResponse> {
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

    if (params.description) {
      httpParams = httpParams.set('description', params.description);
    }

    if (params.lastUpdateFrom) {
      httpParams = httpParams.set('lastUpdateFrom', params.lastUpdateFrom);
    }

    if (params.lastUpdateTo) {
      httpParams = httpParams.set('lastUpdateTo', params.lastUpdateTo);
    }

    // Gestione dell'ordinamento
    if (params.sorts && params.sorts.length > 0) {
      // Converti gli oggetti Sort in stringhe nel formato richiesto dall'API
      // Esempio: "property:ASC"
      params.sorts.forEach((sort) => {
        httpParams = httpParams.append(
          'sorts',
          `${sort.property}:${sort.direction}`
        );
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

        return this.httpClient.get<TaxesResponse>(`${this.baseUrl}/taxes`, {
          headers,
          params: httpParams,
        });
      })
    );
  }

  /**
   * Recupera le tasse per un punto vendita specifico
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @returns Observable con la lista delle tasse del punto vendita
   */
  getTaxesBySalesPoint(
    apiKey: string,
    salesPointId: number
  ): Observable<TaxesResponse> {
    return this.getTaxes(apiKey, {
      start: 0,
      limit: 100,
      idsSalesPoint: [salesPointId],
    });
  }

  /**
   * Recupera una tassa specifica per ID
   * @param apiKey - La chiave API da utilizzare
   * @param taxId - ID della tassa da recuperare
   * @returns Observable con la tassa richiesta (se trovata)
   */
  getTaxById(apiKey: string, taxId: string): Observable<Tax | null> {
    return this.getTaxes(apiKey, {
      ids: [taxId],
    }).pipe(
      switchMap((response) => {
        if (response.taxes && response.taxes.length > 0) {
          return new Observable<Tax>((observer) => {
            observer.next(response.taxes[0]);
            observer.complete();
          });
        } else {
          return new Observable<null>((observer) => {
            observer.next(null);
            observer.complete();
          });
        }
      })
    );
  }

  /**
   * Recupera la tassa predefinita per un punto vendita
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @returns Observable con la tassa predefinita (se trovata)
   */
  getDefaultTaxForSalesPoint(
    apiKey: string,
    salesPointId: number
  ): Observable<Tax | null> {
    return this.getTaxesBySalesPoint(apiKey, salesPointId).pipe(
      switchMap((response) => {
        if (response.taxes && response.taxes.length > 0) {
          // Cerca una tassa predefinita
          const defaultTax = response.taxes.find((tax) => tax.isDefault);

          if (defaultTax) {
            return new Observable<Tax>((observer) => {
              observer.next(defaultTax);
              observer.complete();
            });
          } else {
            // Se non c'è una tassa predefinita, ritorna la prima attiva
            const activeTax = response.taxes.find((tax) => tax.isActive);

            if (activeTax) {
              return new Observable<Tax>((observer) => {
                observer.next(activeTax);
                observer.complete();
              });
            }
          }
        }

        return new Observable<null>((observer) => {
          observer.next(null);
          observer.complete();
        });
      })
    );
  }

  /**
   * Aggiorna una tassa specifica
   * @param apiKey - La chiave API da utilizzare
   * @param taxId - ID della tassa da aggiornare
   * @param params - Parametri di aggiornamento
   * @returns Observable con la tassa aggiornata o void se risposta 204
   */
  updateTax(
    apiKey: string,
    taxId: string,
    params: TaxUpdateParams
  ): Observable<Tax | void> {
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
          .put<Tax>(`${this.baseUrl}/taxes/${taxId}`, body, {
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
              return new Observable<Tax>((observer) => {
                observer.next(
                  response.body || ({ ...params, id: taxId } as Tax)
                );
                observer.complete();
              });
            })
          );
      })
    );
  }

  /**
   * Crea una nuova tassa
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri per la creazione della tassa
   * @returns Observable con la tassa creata
   */
  createTax(apiKey: string, params: TaxCreateParams): Observable<Tax> {
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

        return this.httpClient.post<Tax>(`${this.baseUrl}/taxes`, body, {
          headers,
        });
      })
    );
  }

  /**
   * Elimina una tassa specifica
   * @param apiKey - La chiave API da utilizzare
   * @param taxId - ID della tassa da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteTax(apiKey: string, taxId: string): Observable<void> {
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
          .delete<void>(`${this.baseUrl}/taxes/${taxId}`, {
            headers,
            responseType: 'text' as 'json', // Trick per forzare il tipo di risposta come testo
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
