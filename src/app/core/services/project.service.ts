import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { Project } from '../models/project.model';

// Se hai bisogno di funzionalità di logging, importa o implementa un logger personalizzato
// Per esempio:
const log = {
  debug: (message: string) => console.debug(message),
  info: (message: string) => console.info(message),
  error: (message: string) => console.error(message),
};

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
    console.log(project);
    return this.http.post<any>(`${this.apiUrl}/admin/projects`, project).pipe(
      map((response) => response.data),
      catchError(this.handleError)
    );
  }

  updateAdminProject(
    id: string,
    project: Partial<Project>
  ): Observable<Project> {
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
