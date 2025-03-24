import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Project } from '../../../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Admin endpoints
  getAdminProjects(): Observable<Project[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/projects`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  getAdminProject(id: string): Observable<Project> {
    return this.http.get<any>(`${this.apiUrl}/admin/projects/${id}`).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  createProject(project: Partial<Project>): Observable<Project> {
    // Assicuriamoci che additionalData sia presente e contenga i valori corretti
    if (!project.additionalData) {
      project.additionalData = {
        orderApp: true,
        kambusaApp: true,
        workersApp: true,
        enoApp: true,
        bookingApp: true,
        productionApp: true,
      };
    }

    return this.http.post<any>(`${this.apiUrl}/admin/projects`, project).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  updateAdminProject(
    id: string,
    project: Partial<Project>
  ): Observable<Project> {
    // Assicuriamoci che additionalData sia gestito correttamente
    if (project.additionalData) {
      project.additionalData = {
        ...project.additionalData,
        // Assicuriamo che ogni app abbia un valore booleano
        orderApp: !!project.additionalData.orderApp,
        kambusaApp: !!project.additionalData.kambusaApp,
        workersApp: !!project.additionalData.workersApp,
        enoApp: !!project.additionalData.enoApp,
        bookingApp: !!project.additionalData.bookingApp,
        productionApp: !!project.additionalData.productionApp,
      };
    }

    return this.http
      .put<any>(`${this.apiUrl}/admin/projects/${id}`, project)
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/admin/projects/${id}`).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // Partner endpoints
  getPartnerProjects(): Observable<Project[]> {
    return this.http.get<any>(`${this.apiUrl}/partner/projects`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  getPartnerProject(id: string): Observable<Project> {
    return this.http.get<any>(`${this.apiUrl}/partner/projects/${id}`).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  updatePartnerProject(
    id: string,
    project: Partial<Project>
  ): Observable<Project> {
    // Stessa logica di updateAdminProject per assicurare la presenza di additionalData
    if (project.additionalData) {
      project.additionalData = {
        ...project.additionalData,
        orderApp: !!project.additionalData.orderApp,
        kambusaApp: !!project.additionalData.kambusaApp,
        workersApp: !!project.additionalData.workersApp,
        enoApp: !!project.additionalData.enoApp,
        bookingApp: !!project.additionalData.bookingApp,
        productionApp: !!project.additionalData.productionApp,
      };
    }

    return this.http
      .put<any>(`${this.apiUrl}/partner/projects/${id}`, project)
      .pipe(
        map((response) => response.data),
        catchError(this.handleError)
      );
  }

  // Public endpoints
  getPublicProjects(): Observable<Project[]> {
    return this.http.get<any>(`${this.apiUrl}/public/projects`).pipe(
      map((response) => response.data || []),
      catchError(this.handleError)
    );
  }

  getPublicProject(id: string): Observable<Project> {
    return this.http.get<any>(`${this.apiUrl}/public/projects/${id}`).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('API error', error);
    throw error.error?.message || error.message || 'API request failed';
  }
}
