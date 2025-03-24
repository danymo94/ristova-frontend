import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../../models/category.model';
import { AuthStore } from '../../../store/auth.signal-store';

/**
 * Interfaccia per le risposte API standard
 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * Interfaccia per gli aggiornamenti dell'ordinamento delle categorie
 */
export interface SortOrderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Parametri per l'aggiornamento dell'ordinamento di più categorie
 */
export interface UpdateSortOrderParams {
  projectId: string;
  sortOrderUpdates: SortOrderUpdate[];
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  constructor() {}

  /**
   * Ottiene le categorie pubbliche per un progetto specifico
   * @param projectId ID del progetto
   * @returns Observable con l'array di categorie
   */
  getPublicCategories(projectId: string): Observable<Category[]> {
    return this.http
      .get<ApiResponse<Category[]>>(
        `${this.apiUrl}/public/projects/${projectId}/categories`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching public categories:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching public categories')
          );
        })
      );
  }

  /**
   * Ottiene una categoria pubblica specifica
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @returns Observable con la categoria richiesta
   */
  getPublicCategory(
    projectId: string,
    categoryId: string
  ): Observable<Category> {
    return this.http
      .get<ApiResponse<Category>>(
        `${this.apiUrl}/public/projects/${projectId}/categories/${categoryId}`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching public category ${categoryId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching public category')
          );
        })
      );
  }

  /**
   * Ottiene tutte le categorie per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @returns Observable con l'array di categorie
   */
  getPartnerCategories(projectId: string): Observable<Category[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Category[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching partner categories:', error);
          return throwError(
            () =>
              new Error(error.message || 'Error fetching partner categories')
          );
        })
      );
  }

  /**
   * Ottiene una categoria specifica per un partner autenticato
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @returns Observable con la categoria richiesta
   */
  getPartnerCategory(
    projectId: string,
    categoryId: string
  ): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Category>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories/${categoryId}`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(
            `Error fetching partner category ${categoryId}:`,
            error
          );
          return throwError(
            () => new Error(error.message || 'Error fetching partner category')
          );
        })
      );
  }

  /**
   * Crea una nuova categoria per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @param categoryData Dati della categoria da creare
   * @returns Observable con la categoria creata
   */
  createPartnerCategory(
    projectId: string,
    categoryData: CreateCategoryDto
  ): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Category>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories`,
        categoryData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating partner category:', error);
          return throwError(
            () => new Error(error.message || 'Error creating partner category')
          );
        })
      );
  }

  /**
   * Aggiorna una categoria esistente del partner autenticato
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @param categoryData Dati aggiornati della categoria
   * @returns Observable con la categoria aggiornata
   */
  updatePartnerCategory(
    projectId: string,
    categoryId: string,
    categoryData: UpdateCategoryDto
  ): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Category>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories/${categoryId}`,
        categoryData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(
            `Error updating partner category ${categoryId}:`,
            error
          );
          return throwError(
            () => new Error(error.message || 'Error updating partner category')
          );
        })
      );
  }

  /**
   * Elimina una categoria esistente del partner autenticato
   * @param projectId ID del progetto
   * @param categoryId ID della categoria da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deletePartnerCategory(
    projectId: string,
    categoryId: string
  ): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories/${categoryId}`,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(
            `Error deleting partner category ${categoryId}:`,
            error
          );
          return throwError(
            () => new Error(error.message || 'Error deleting partner category')
          );
        })
      );
  }

  /**
   * Aggiorna l'ordinamento di più categorie contemporaneamente
   * @param params Parametri per l'aggiornamento dell'ordinamento
   * @returns Observable che completa dopo l'aggiornamento
   */
  updateCategoriesSortOrder(params: UpdateSortOrderParams): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<any>>(
        `${this.apiUrl}/partner/categories/sort-order`,
        params,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error('Error updating categories sort order:', error);
          return throwError(
            () =>
              new Error(error.message || 'Error updating categories sort order')
          );
        })
      );
  }

  /**
   * Ottiene tutte le categorie per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @returns Observable con l'array di categorie
   */
  getAdminCategories(projectId: string): Observable<Category[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Category[]>>(
        `${this.apiUrl}/admin/projects/${projectId}/categories`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching admin categories:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin categories')
          );
        })
      );
  }

  /**
   * Ottiene una categoria specifica (accesso admin)
   * @param categoryId ID della categoria
   * @returns Observable con la categoria richiesta
   */
  getAdminCategory(categoryId: string): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Category>>(
        `${this.apiUrl}/admin/categories/${categoryId}`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching admin category ${categoryId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin category')
          );
        })
      );
  }

  /**
   * Crea una nuova categoria per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @param categoryData Dati della categoria da creare
   * @returns Observable con la categoria creata
   */
  createAdminCategory(
    projectId: string,
    categoryData: CreateCategoryDto
  ): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Category>>(
        `${this.apiUrl}/admin/projects/${projectId}/categories`,
        categoryData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating admin category:', error);
          return throwError(
            () => new Error(error.message || 'Error creating admin category')
          );
        })
      );
  }

  /**
   * Aggiorna una categoria esistente (accesso admin)
   * @param categoryId ID della categoria
   * @param categoryData Dati aggiornati della categoria
   * @returns Observable con la categoria aggiornata
   */
  updateAdminCategory(
    categoryId: string,
    categoryData: UpdateCategoryDto
  ): Observable<Category> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Category>>(
        `${this.apiUrl}/admin/categories/${categoryId}`,
        categoryData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating admin category ${categoryId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating admin category')
          );
        })
      );
  }

  /**
   * Elimina una categoria esistente (accesso admin)
   * @param categoryId ID della categoria da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteAdminCategory(categoryId: string): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(
        `${this.apiUrl}/admin/categories/${categoryId}`,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting admin category ${categoryId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting admin category')
          );
        })
      );
  }

  /**
   * Importa categorie da Cassa in Cloud a categorie locali
   * @param projectId ID del progetto
   * @param categories Array di categorie CC da importare
   * @returns Observable con le categorie importate
   */
  importCCCategories(
    projectId: string,
    CCcategories: any[]
  ): Observable<Category[]> {
    const headers = this.getAuthHeaders();

    // Costruisco l'oggetto da inviare all'API
    const importData = {
      projectId,
      categories: CCcategories,
    };

    return this.http
      .post<ApiResponse<Category[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories/import-cc`,
        importData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error importing CC categories:', error);
          return throwError(
            () => new Error(error.message || 'Error importing CC categories')
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
