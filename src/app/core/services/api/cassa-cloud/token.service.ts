import { Injectable } from '@angular/core';
import { HttpClient, HttpBackend, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, shareReplay, switchMap } from 'rxjs/operators';

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TokenCache {
  [apiKey: string]: {
    token: string;
    expirationTime: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private httpClient: HttpClient;
  private apiUrl = 'https://api.cassanova.com/apikey/token';
  
  // Memorizziamo i token per diverse API key
  private tokenCache: TokenCache = {};
  private currentApiKey: string | null = null;
  private tokenSubject = new BehaviorSubject<string | null>(null);
  
  // Espone un Observable che emette il token corrente
  public token$ = this.tokenSubject.asObservable();

  constructor(private httpBackend: HttpBackend) {
    // Creiamo un'istanza di HttpClient che bypassa gli interceptor
    this.httpClient = new HttpClient(httpBackend);
  }

  /**
   * Ottiene un token di accesso da Cassa in Cloud
   * @param apiKey - L'API key per l'autenticazione
   */
  getToken(apiKey: string): Observable<string> {
    // Se la API key è diversa dall'ultima usata, aggiorniamo il subject
    if (this.currentApiKey !== apiKey) {
      this.currentApiKey = apiKey;
      const cachedEntry = this.tokenCache[apiKey];
      if (cachedEntry && this.isTokenStillValid(cachedEntry.expirationTime)) {
        this.tokenSubject.next(cachedEntry.token);
      } else {
        this.tokenSubject.next(null);
      }
    }

    // Controlla se abbiamo già un token valido per questa API key
    if (this.isTokenValid(apiKey)) {
      return of(this.tokenCache[apiKey].token);
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Requested-With': '*'
    });

    return this.httpClient.post<TokenResponse>(
      this.apiUrl,
      { apiKey },
      { headers }
    ).pipe(
      tap(response => {
        const expirationTime = Date.now() + (response.expires_in - 60) * 1000;
        
        // Memorizziamo il token nella cache
        this.tokenCache[apiKey] = {
          token: response.access_token,
          expirationTime
        };
        
        // Se questa è l'API key attiva, aggiorniamo anche il subject
        if (this.currentApiKey === apiKey) {
          this.tokenSubject.next(response.access_token);
        }
      }),
      map(response => response.access_token),
      shareReplay(1)
    );
  }

  /**
   * Verifica se il token per una determinata API key è ancora valido
   */
  isTokenValid(apiKey: string): boolean {
    const cachedEntry = this.tokenCache[apiKey];
    return !!cachedEntry && this.isTokenStillValid(cachedEntry.expirationTime);
  }

  /**
   * Controlla se un timestamp di scadenza è ancora valido
   */
  private isTokenStillValid(expirationTime: number): boolean {
    return Date.now() < expirationTime;
  }

  /**
   * Restituisce il token corrente per l'API key specificata se valido, altrimenti null
   */
  getCurrentToken(apiKey: string): string | null {
    return this.isTokenValid(apiKey) ? this.tokenCache[apiKey].token : null;
  }

  /**
   * Resetta il token memorizzato per una specifica API key
   */
  clearToken(apiKey: string): void {
    delete this.tokenCache[apiKey];
    
    // Se stiamo cancellando l'API key attualmente in uso, aggiorniamo anche il subject
    if (this.currentApiKey === apiKey) {
      this.tokenSubject.next(null);
    }
  }

  /**
   * Resetta tutti i token memorizzati
   */
  clearAllTokens(): void {
    this.tokenCache = {};
    this.currentApiKey = null;
    this.tokenSubject.next(null);
  }
}