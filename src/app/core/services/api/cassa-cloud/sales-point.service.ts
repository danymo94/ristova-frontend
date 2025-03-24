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

export interface Currency {
  id: number;
  code: string;
  name: string;
  numberOfDecimals: number;
}

export interface SalesPoint {
  id: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  brand?: string;
  street?: string;
  city?: string;
  zipcode?: string;
  district?: string;
  country?: string; // Country code ISO 3166-1 alpha-2
  vatNumber?: string;
  taxCode?: string;
  phoneNumber?: string;
  email?: string;
  currency?: Currency;
  logoSmall?: string;
  logoBig?: string;
  img?: string;
  active?: boolean;
  apiVersion?: string;
}

export interface SalesPointResponse {
  salesPoint: SalesPoint[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class SalesPointService {
  // Utilizzo di inject() per le dipendenze
  private httpBackend = inject(HttpBackend);
  private tokenService = inject(TokenService);

  // Proprietà del servizio inizializzate nel costruttore
  private httpClient: HttpClient;
  private baseUrl: string;

  constructor() {
    // Creiamo un'istanza di HttpClient che bypassa gli interceptor
    this.httpClient = new HttpClient(this.httpBackend);
    // Base URL dell'API Cassa in Cloud
    this.baseUrl = 'https://api.cassanova.com';
  }

  /**
   * Recupera tutti i punti vendita abilitati nella configurazione API key
   * @param apiKey - La chiave API da utilizzare
   * @param hasActiveLicense - Optional: filtra solo i punti vendita attivi
   * @returns Observable con la lista dei punti vendita
   */
  getSalesPoints(
    apiKey: string,
    hasActiveLicense?: boolean
  ): Observable<SalesPointResponse> {
    // Costruisci i parametri di query
    let params = new HttpParams();
    if (hasActiveLicense !== undefined) {
      params = params.set('hasActiveLicense', hasActiveLicense.toString());
    }

    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<SalesPointResponse>(
          `${this.baseUrl}/salespoint`,
          { headers, params }
        );
      })
    );
  }

  /**
   * Recupera un punto vendita specifico per ID
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - L'ID del punto vendita da recuperare
   * @returns Observable con i dettagli del punto vendita
   */
  getSalesPointById(
    apiKey: string,
    salesPointId: number
  ): Observable<SalesPoint> {
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<SalesPoint>(
          `${this.baseUrl}/salespoint/${salesPointId}`,
          { headers }
        );
      })
    );
  }

  /**
   * Recupera il punto vendita predefinito per la chiave API corrente
   * @param apiKey - La chiave API da utilizzare
   * @returns Observable con i dettagli del punto vendita predefinito
   */
  getDefaultSalesPoint(apiKey: string): Observable<SalesPoint> {
    return this.getSalesPoints(apiKey, true).pipe(
      switchMap((response) => {
        if (response.salesPoint && response.salesPoint.length > 0) {
          // Ritorna il primo punto vendita come default
          // Si potrebbe implementare una logica più sofisticata se necessario
          return new Observable<SalesPoint>((observer) => {
            observer.next(response.salesPoint[0]);
            observer.complete();
          });
        } else {
          throw new Error('Nessun punto vendita attivo trovato');
        }
      })
    );
  }
}
