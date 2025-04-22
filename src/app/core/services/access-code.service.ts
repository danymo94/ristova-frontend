import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AccessCodeService {
  private readonly ACCESS_CODE_KEY = 'ristova_access_code';

  /**
   * Verifica se il codice di accesso inserito è corretto
   */
  verifyAccessCode(code: string): boolean {
    return code === environment.accessCode;
  }

  /**
   * Salva il codice di accesso nel localStorage
   */
  saveAccessCode(code: string): void {
    localStorage.setItem(this.ACCESS_CODE_KEY, code);
  }

  /**
   * Recupera il codice di accesso dal localStorage
   */
  getStoredAccessCode(): string | null {
    return localStorage.getItem(this.ACCESS_CODE_KEY);
  }

  /**
   * Verifica se è presente un codice di accesso valido
   */
  hasValidAccessCode(): boolean {
    const storedCode = this.getStoredAccessCode();
    return storedCode === environment.accessCode;
  }

  /**
   * Cancella il codice di accesso salvato
   */
  clearAccessCode(): void {
    localStorage.removeItem(this.ACCESS_CODE_KEY);
  }
}
