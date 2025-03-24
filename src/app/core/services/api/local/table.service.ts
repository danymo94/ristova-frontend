import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Table,
  CreateTableDto,
  UpdateTableDto,
} from '../../../models/table.model';
import { AuthStore } from '../../../store/auth.signal-store';

/**
 * Interfaccia per le risposte API standard
 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class TableService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  constructor() {}

  /**
   * Ottiene i tavoli pubblici per un progetto specifico
   * @param projectId ID del progetto
   * @returns Observable con l'array di tavoli
   */
  getPublicTables(projectId: string): Observable<Table[]> {
    return this.http
      .get<ApiResponse<Table[]>>(
        `${this.apiUrl}/public/projects/${projectId}/tables`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching public tables:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching public tables')
          );
        })
      );
  }

  /**
   * Ottiene un tavolo pubblico specifico
   * @param projectId ID del progetto
   * @param tableId ID del tavolo
   * @returns Observable con il tavolo richiesto
   */
  getPublicTable(projectId: string, tableId: string): Observable<Table> {
    return this.http
      .get<ApiResponse<Table>>(
        `${this.apiUrl}/public/projects/${projectId}/tables/${tableId}`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching public table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching public table')
          );
        })
      );
  }

  /**
   * Ottiene tutti i tavoli per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @returns Observable con l'array di tavoli
   */
  getPartnerTables(projectId: string): Observable<Table[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Table[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching partner tables:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching partner tables')
          );
        })
      );
  }

  /**
   * Ottiene un tavolo specifico per un partner autenticato
   * @param projectId ID del progetto
   * @param tableId ID del tavolo
   * @returns Observable con il tavolo richiesto
   */
  getPartnerTable(projectId: string, tableId: string): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Table>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables/${tableId}`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching partner table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching partner table')
          );
        })
      );
  }

  /**
   * Crea un nuovo tavolo per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @param tableData Dati del tavolo da creare
   * @returns Observable con il tavolo creato
   */
  createPartnerTable(
    projectId: string,
    tableData: CreateTableDto
  ): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Table>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables`,
        tableData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating partner table:', error);
          return throwError(
            () => new Error(error.message || 'Error creating partner table')
          );
        })
      );
  }

  /**
   * Aggiorna un tavolo esistente del partner autenticato
   * @param projectId ID del progetto
   * @param tableId ID del tavolo
   * @param tableData Dati aggiornati del tavolo
   * @returns Observable con il tavolo aggiornato
   */
  updatePartnerTable(
    projectId: string,
    tableId: string,
    tableData: UpdateTableDto
  ): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Table>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables/${tableId}`,
        tableData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating partner table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating partner table')
          );
        })
      );
  }

  /**
   * Elimina un tavolo esistente del partner autenticato
   * @param projectId ID del progetto
   * @param tableId ID del tavolo da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deletePartnerTable(projectId: string, tableId: string): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables/${tableId}`,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting partner table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting partner table')
          );
        })
      );
  }

  /**
   * Ottiene tutti i tavoli per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @returns Observable con l'array di tavoli
   */
  getAdminTables(projectId: string): Observable<Table[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Table[]>>(
        `${this.apiUrl}/admin/projects/${projectId}/tables`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching admin tables:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin tables')
          );
        })
      );
  }

  /**
   * Ottiene un tavolo specifico (accesso admin)
   * @param tableId ID del tavolo
   * @returns Observable con il tavolo richiesto
   */
  getAdminTable(tableId: string): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Table>>(`${this.apiUrl}/admin/tables/${tableId}`, {
        headers,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching admin table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin table')
          );
        })
      );
  }

  /**
   * Crea un nuovo tavolo per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @param tableData Dati del tavolo da creare
   * @returns Observable con il tavolo creato
   */
  createAdminTable(
    projectId: string,
    tableData: CreateTableDto
  ): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Table>>(
        `${this.apiUrl}/admin/projects/${projectId}/tables`,
        tableData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating admin table:', error);
          return throwError(
            () => new Error(error.message || 'Error creating admin table')
          );
        })
      );
  }

  /**
   * Aggiorna un tavolo esistente (accesso admin)
   * @param tableId ID del tavolo
   * @param tableData Dati aggiornati del tavolo
   * @returns Observable con il tavolo aggiornato
   */
  updateAdminTable(
    tableId: string,
    tableData: UpdateTableDto
  ): Observable<Table> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Table>>(
        `${this.apiUrl}/admin/tables/${tableId}`,
        tableData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating admin table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating admin table')
          );
        })
      );
  }

  /**
   * Elimina un tavolo esistente (accesso admin)
   * @param tableId ID del tavolo da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteAdminTable(tableId: string): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(`${this.apiUrl}/admin/tables/${tableId}`, {
        headers,
      })
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting admin table ${tableId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting admin table')
          );
        })
      );
  }

  /**
   * Importa tavoli da Cassa in Cloud a tavoli locali
   * @param projectId ID del progetto
   * @param ccTables Array di tavoli CC da importare
   * @returns Observable con i tavoli importati
   */
  importCCTables(projectId: string, ccTables: any[]): Observable<Table[]> {
    const headers = this.getAuthHeaders();

    // Costruisco l'oggetto da inviare all'API
    const importData = {
      projectId,
      tables: ccTables,
    };

    return this.http
      .post<ApiResponse<Table[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/tables/import-cc`,
        importData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error importing CC tables:', error);
          return throwError(
            () => new Error(error.message || 'Error importing CC tables')
          );
        })
      );
  }

  /**
   * Recupera gli header di autenticazione dall'AuthStore
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }
}
