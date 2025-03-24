import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Partner } from '../../../models/user.model'; // Percorso corretto

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'auth_token';
  private userKey = 'user';
  private roleKey = 'role';
  private expiresAtKey = 'expires_at';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/public/login`, { email, password })
      .pipe(
        tap((response) => {
          // Gestione della risposta con formato standard
          if (response.data) {
            this.setSession(response.data);
          } else {
            this.setSession(response);
          }
        }),
        catchError((error) => {
          console.error('Login error', error);
          throw error.error || error;
        })
      );
  }

  registerAdmin(userData: any): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/public/register`, userData, {
        headers: {
          'x-secret-key': userData.secretKey || '',
        },
      })
      .pipe(
        tap((response) => {
          // Gestione della risposta con formato standard
          if (response.data) {
            this.setSession(response.data);
          } else {
            this.setSession(response);
          }
        }),
        catchError((error) => {
          console.error('Register error', error);
          throw error.error || error;
        })
      );
  }

  registerPartner(userData: any): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/admin/partners/register`, userData)
      .pipe(
        map((response) => {
          // Estrarre i dati del partner dalla risposta API formattata
          const partnerData = response.data || response;
          console.log('Partner registered successfully:', partnerData);
          return {
            partner: partnerData.user || partnerData,
          };
        }),
        catchError((error) => {
          console.error('Register partner error', error);
          throw error.error || error;
        })
      );
  }

  logout(): Observable<any> {
    // Non c'è un endpoint di logout, facciamo solo cleanup locale
    this.clearSession();
    return of({ code: 200, message: 'Logout successful' });
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(this.tokenKey);
    const expiresAt = localStorage.getItem(this.expiresAtKey);

    if (!token || !expiresAt) {
      return false;
    }

    const expirationDate = new Date(parseInt(expiresAt, 10));
    return new Date() < expirationDate;
  }

  getAuthToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): any {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  userRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  private setSession(response: any): void {
    // Gestire sia il formato standard che quello diretto
    const token = response.token;
    const user = response.user;
    const role = response.role;
    const expiresAt = response.expiresAt
      ? response.expiresAt * 1000 // Se è un timestamp in secondi
      : new Date().getTime() + 24 * 60 * 60 * 1000; // Default 24 ore

    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    localStorage.setItem(this.roleKey, role);
    localStorage.setItem(this.expiresAtKey, expiresAt.toString());
  }

  private clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.expiresAtKey);
  }

  resetPasswordRequest(email: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/public/password/reset-request`, { email })
      .pipe(
        catchError((error) => {
          console.error('Reset password request error', error);
          throw error.error || error;
        })
      );
  }

  resetPasswordConfirm(token: string, password: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/public/password/reset`, { token, password })
      .pipe(
        catchError((error) => {
          console.error('Reset password confirm error', error);
          throw error.error || error;
        })
      );
  }

  // Metodi aggiuntivi per i profili

  getAdminProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/me`).pipe(
      catchError((error) => {
        console.error('Get admin profile error', error);
        throw error.error || error;
      })
    );
  }

  updateAdminProfile(profileData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/me`, profileData).pipe(
      catchError((error) => {
        console.error('Update admin profile error', error);
        throw error.error || error;
      })
    );
  }

  getPartnerProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/partner/me`).pipe(
      catchError((error) => {
        console.error('Get partner profile error', error);
        throw error.error || error;
      })
    );
  }

  updatePartnerProfile(profileData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/partner/me`, profileData).pipe(
      catchError((error) => {
        console.error('Update partner profile error', error);
        throw error.error || error;
      })
    );
  }

  // Metodi per la gestione dei partner (per admin)

  getPartners(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/partners`).pipe(
      catchError((error) => {
        console.error('Get partners error', error);
        throw error.error || error;
      })
    );
  }

  getPartnerById(partnerId: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/partners/${partnerId}`)
      .pipe(
        map((response) => response.data || response),
        catchError((error) => {
          console.error('Get partner by ID error', error);
          throw error.error || error;
        })
      );
  }

  updatePartner(partnerId: string, partnerData: any): Observable<any> {
    return this.http
      .put<any>(`${this.apiUrl}/admin/partners/${partnerId}`, partnerData)
      .pipe(
        catchError((error) => {
          console.error('Update partner error', error);
          throw error.error || error;
        })
      );
  }

  deletePartner(partnerId: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/admin/partners/${partnerId}`)
      .pipe(
        catchError((error) => {
          console.error('Delete partner error', error);
          throw error.error || error;
        })
      );
  }

  fetchPartners(): Observable<Partner[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/partners`).pipe(
      map((response) => {
        // Estrarre l'array di partner dalla risposta API formattata
        return response.data || [];
      }),
      tap((partners) => console.log('Partners fetched:', partners)),
      catchError((error) => {
        console.error('Error fetching partners:', error);
        return this.handleError(error, 'Error fetching partners');
      })
    );
  }

  updateUserByAdmin(partnerData: any): Observable<any> {
    const partnerId = partnerData.id;
    if (!partnerId) {
      return of({ error: 'Partner ID is required' }).pipe(
        tap((error) => console.error(error)),
        map(() => {
          throw new Error('Partner ID is required');
        })
      );
    }

    return this.http
      .put<any>(`${this.apiUrl}/admin/partners/${partnerId}`, partnerData)
      .pipe(
        map((response) => {
          // Estrarre i dati del partner dalla risposta API formattata
          const updatedPartner = response.data || response;
          console.log('Partner updated successfully:', updatedPartner);
          return {
            partner: updatedPartner,
          };
        }),
        catchError((error) => {
          console.error('Update partner error', error);
          throw error.error || error;
        })
      );
  }

  deleteUserByAdmin(partnerId: string): Observable<any> {
    if (!partnerId) {
      return of({ error: 'Partner ID is required' }).pipe(
        tap((error) => console.error(error)),
        map(() => {
          throw new Error('Partner ID is required');
        })
      );
    }

    return this.http
      .delete<any>(`${this.apiUrl}/admin/partners/${partnerId}`)
      .pipe(
        map((response) => {
          // Estrarre i dati del partner dalla risposta API formattata
          const deletedPartner = response.data || response;
          console.log('Partner deleted successfully:', deletedPartner);
          return {
            id: partnerId,
          };
        }),
        catchError((error) => {
          console.error('Delete partner error', error);
          throw error.error || error;
        })
      );
  }

  private handleError(error: any, message: string): Observable<never> {
    const errorMsg = error.error?.message || error.message || message;
    console.error(errorMsg, error);
    throw new Error(errorMsg);
  }
}
