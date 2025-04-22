import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  DailyClosing,
  ClosingExportOptions,
} from '../../../../core/models/daily-closing.model';

/**
 * Servizio API per gestire le operazioni CRUD sulle chiusure giornaliere
 * Questo servizio utilizza chiamate REST API dirette alle Firebase Functions
 */
@Injectable({
  providedIn: 'root',
})
export class DailyClosingApiService {
  private http: HttpClient;

  // Endpoint API Firebase Functions
  private endpoints = {
    createDailyClosing:
      'https://us-central1-bistro-net-tower.cloudfunctions.net/createDailyClosing',
    getDailyClosingById:
      'https://us-central1-bistro-net-tower.cloudfunctions.net/getDailyClosingById',
    getDailyClosings:
      'https://us-central1-bistro-net-tower.cloudfunctions.net/getDailyClosings',
    markDailyClosingAsSent:
      'https://us-central1-bistro-net-tower.cloudfunctions.net/markDailyClosingAsSent',
  };

  // Headers per le richieste REST API
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(handler: HttpBackend) {
    // Usiamo HttpBackend per creare un client HTTP che aggira gli interceptor
    this.http = new HttpClient(handler);
  }

  /**
   * Crea una nuova chiusura giornaliera
   * @param closing Dati della chiusura da creare
   * @returns Observable con la chiusura creata
   */
  createDailyClosing(closing: DailyClosing): Observable<DailyClosing> {
    // Creazione di una copia pulita dell'oggetto con solo i campi richiesti
    const cleanClosing = {
      date:
        closing.date instanceof Date
          ? closing.date.toISOString()
          : closing.date,
      eTickets: closing.eTickets || 0,
      paperTickets: closing.paperTickets || 0,
      charges: closing.charges || 0,
      cash: closing.cash || 0,
      creditCard: closing.creditCard || 0,
      debitCard: closing.debitCard || 0,
      invoices: closing.invoices || 0,
      deferredInvoices: closing.deferredInvoices || 0,
      other: closing.other || 0,
      operatorName: closing.operatorName || '',
      projectId: closing.projectId || '',
      notes: closing.notes || '',
    };

    // Log separati per chiarezza
    console.log(
      'Request payload (RAW):',
      JSON.stringify(cleanClosing, null, 2)
    );

    // Payload effettivo con wrapper
    const wrappedPayload = { data: cleanClosing };
    console.log(
      'Request payload WITH WRAPPER:',
      JSON.stringify(wrappedPayload, null, 2)
    );
    console.log('URL:', this.endpoints.createDailyClosing);

    return this.http
      .post(
        this.endpoints.createDailyClosing,
        wrappedPayload, // Usando la variabile per assicurarci che sia corretto
        { headers: this.headers }
      )
      .pipe(
        map((response: any) => {
          console.log('Response from createDailyClosing:', response);

          // Gestione della risposta
          if (response && response.error) {
            throw new Error(response.error);
          }

          // Convertire le date
          const result = response;
          return {
            ...result,
            date: result.date ? new Date(result.date) : new Date(),
            createdAt: result.createdAt
              ? new Date(result.createdAt)
              : undefined,
            updatedAt: result.updatedAt
              ? new Date(result.updatedAt)
              : undefined,
            sentAt: result.sentAt ? new Date(result.sentAt) : undefined,
          } as DailyClosing;
        }),
        catchError((error) => {
          console.error('Errore durante la creazione della chiusura:', error);
          // Estrai il messaggio di errore in modo più completo
          let errorMessage = 'Errore sconosciuto';

          if (error.error && typeof error.error === 'object') {
            // Se l'errore è un oggetto, potrebbe contenere un messaggio
            errorMessage =
              error.error.message ||
              error.error.error ||
              JSON.stringify(error.error);
          } else if (error.error && typeof error.error === 'string') {
            // Se l'errore è una stringa
            errorMessage = error.error;
          } else if (error.message) {
            // Altrimenti usa il messaggio standard
            errorMessage = error.message;
          }

          return throwError(
            () =>
              new Error(
                'Errore durante la creazione della chiusura giornaliera: ' +
                  errorMessage
              )
          );
        })
      );
  }

  /**
   * Recupera una chiusura giornaliera per ID
   * @param id ID della chiusura
   * @param projectId ID del progetto (opzionale)
   * @returns Observable con la chiusura
   */
  getDailyClosingById(
    id: string,
    projectId?: string
  ): Observable<DailyClosing> {
    // Formato di richiesta per le Firebase Functions
    const request = {
      data: { id, projectId },
    };

    return this.http
      .post<DailyClosing>(this.endpoints.getDailyClosingById, request, {
        headers: this.headers,
      })
      .pipe(
        map((response) => {
          // La risposta da Firebase Functions è direttamente l'oggetto, non wrapped in "result"
          const result = response as any;
          return {
            ...result,
            date: result.date ? new Date(result.date) : new Date(),
            createdAt: result.createdAt
              ? new Date(result.createdAt)
              : undefined,
            updatedAt: result.updatedAt
              ? new Date(result.updatedAt)
              : undefined,
            sentAt: result.sentAt ? new Date(result.sentAt) : undefined,
          };
        }),
        catchError((error) => {
          console.error('Errore durante il recupero della chiusura:', error);
          const errorMessage =
            error.error?.message || error.message || 'Errore sconosciuto';
          return throwError(
            () =>
              new Error(
                'Errore durante il recupero della chiusura: ' + errorMessage
              )
          );
        })
      );
  }

  /**
   * Recupera tutte le chiusure giornaliere
   * @param projectId ID del progetto (opzionale)
   * @param month Mese (1-12) (opzionale)
   * @param year Anno (opzionale)
   * @returns Observable con array di chiusure
   */
  getDailyClosings(
    projectId?: string,
    month?: number,
    year?: number
  ): Observable<DailyClosing[]> {
    // Preparazione delle date per il filtro
    // Anche se mese e anno non sono specificati, impostiamo comunque delle date di default
    // per evitare di inviare null o undefined
    let startDate: string;
    let endDate: string;

    if (month && year) {
      // Se sono specificati mese e anno, filtriamo per il mese specifico
      const start = new Date(year, month - 1, 1); // Il mese in JavaScript è 0-based
      start.setHours(0, 0, 0, 0); // Imposta l'ora all'inizio della giornata

      const end = new Date(year, month, 0); // L'ultimo giorno del mese
      end.setHours(23, 59, 59, 999); // Imposta l'ora alla fine della giornata

      startDate = start.toISOString();
      endDate = end.toISOString();
    } else {
      // Se non sono specificati, impostiamo un intervallo di date predefinito
      // Ad esempio, dall'inizio dell'anno corrente fino ad oggi
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();

      const start = new Date(currentYear, 0, 1); // 1 gennaio dell'anno corrente
      start.setHours(0, 0, 0, 0);

      // Fine = data corrente alla fine della giornata
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    // Formato di richiesta per le Firebase Functions
    const request = {
      data: {
        projectId,
        startDate,
        endDate,
      },
    };

    console.log(
      'Invio richiesta getDailyClosings:',
      JSON.stringify(request, null, 2)
    );

    return this.http
      .post<{
        dailyClosings: DailyClosing[];
        result?: { dailyClosings: DailyClosing[] };
      }>(this.endpoints.getDailyClosings, request, { headers: this.headers })
      .pipe(
        map((response) => {
          console.log('Risposta ricevuta da getDailyClosings:', response);

          // Verifica se la risposta è nel formato { result: { dailyClosings: [...] } }
          // o nel formato { dailyClosings: [...] }
          let closings: any[] = [];

          if (response.result && response.result.dailyClosings) {
            closings = response.result.dailyClosings;
          } else if (response.dailyClosings) {
            closings = response.dailyClosings;
          } else {
            console.warn('Formato di risposta non riconosciuto:', response);
            // Tentiamo di estrarre i dati se possibile
            if (Array.isArray(response)) {
              closings = response;
            } else if (typeof response === 'object' && response !== null) {
              // Cerchiamo qualsiasi campo che potrebbe contenere un array
              const possibleArrays = Object.values(response).filter(
                Array.isArray
              );
              if (possibleArrays.length > 0) {
                closings = possibleArrays[0];
              }
            }
          }

          // Convertiamo le date in oggetti Date per ogni chiusura e gestiamo i casi di oggetti vuoti {}
          return closings.map((closing) => {
            const processedClosing = { ...closing };

            // Gestione date - assicurandoci di controllare sia stringhe che oggetti vuoti
            // Se date è un oggetto vuoto o una stringa invalida, usa la data corrente con ora specifica
            if (
              !closing.date ||
              (typeof closing.date === 'object' &&
                Object.keys(closing.date).length === 0)
            ) {
              const now = new Date();
              // Manteniamo l'ora attuale per avere un timestamp completo
              processedClosing.date = now;
            } else if (typeof closing.date === 'string') {
              // Convertiamo la stringa in oggetto Date, mantenendo l'ora se presente
              processedClosing.date = new Date(closing.date);
            }

            // Gestione createdAt - manteniamo l'ora
            if (
              !closing.createdAt ||
              (typeof closing.createdAt === 'object' &&
                Object.keys(closing.createdAt).length === 0)
            ) {
              processedClosing.createdAt = undefined;
            } else if (typeof closing.createdAt === 'string') {
              processedClosing.createdAt = new Date(closing.createdAt);
            }

            // Gestione updatedAt - manteniamo l'ora
            if (
              !closing.updatedAt ||
              (typeof closing.updatedAt === 'object' &&
                Object.keys(closing.updatedAt).length === 0)
            ) {
              processedClosing.updatedAt = undefined;
            } else if (typeof closing.updatedAt === 'string') {
              processedClosing.updatedAt = new Date(closing.updatedAt);
            }

            // Gestione sentAt - manteniamo l'ora
            if (
              !closing.sentAt ||
              (typeof closing.sentAt === 'object' &&
                Object.keys(closing.sentAt).length === 0)
            ) {
              processedClosing.sentAt = undefined;
            } else if (typeof closing.sentAt === 'string') {
              processedClosing.sentAt = new Date(closing.sentAt);
            }

            return processedClosing;
          });
        }),
        catchError((error) => {
          console.error('Errore durante il recupero delle chiusure:', error);
          console.error('Dettagli errore:', error.error);
          const errorMessage =
            error.error?.message || error.message || 'Errore sconosciuto';
          return throwError(
            () =>
              new Error(
                'Errore durante il recupero delle chiusure: ' + errorMessage
              )
          );
        })
      );
  }

  /**
   * Segna una chiusura giornaliera come inviata
   * @param id ID della chiusura
   * @returns Observable con la risposta
   */
  markDailyClosingAsSent(id: string): Observable<{ success: boolean }> {
    // Formato di richiesta per le Firebase Functions
    const request = {
      data: { id },
    };

    return this.http
      .post<{ success: boolean }>(
        this.endpoints.markDailyClosingAsSent,
        request,
        { headers: this.headers }
      )
      .pipe(
        map((response) => response), // La risposta è già nel formato corretto
        catchError((error) => {
          console.error(
            "Errore durante l'aggiornamento della chiusura:",
            error
          );
          const errorMessage =
            error.error?.message || error.message || 'Errore sconosciuto';
          return throwError(
            () =>
              new Error(
                "Errore durante l'aggiornamento della chiusura: " + errorMessage
              )
          );
        })
      );
  }
}
