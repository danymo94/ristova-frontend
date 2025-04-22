import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  DailyClosing,
  ClosingExportOptions,
} from '../../../models/daily-closing.model';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Servizio per gestire le chiusure giornaliere
 * Questo servizio utilizza localStorage per memorizzare i dati delle chiusure
 */
@Injectable({
  providedIn: 'root',
})
export class DailyClosingService {
  private localStorageKey = 'daily-closings';

  constructor() {}

  /**
   * Recupera tutte le chiusure giornaliere
   * @param projectId ID del progetto (opzionale)
   * @returns Array di chiusure giornaliere
   */
  getAll(projectId?: string): Observable<DailyClosing[]> {
    try {
      const closings = this.getClosingsFromStorage();

      if (projectId) {
        return of(
          closings.filter((closing) => closing.projectId === projectId)
        );
      }

      return of(closings);
    } catch (error) {
      console.error('Errore nel recupero delle chiusure:', error);
      return throwError(() => new Error('Errore nel recupero delle chiusure'));
    }
  }

  /**
   * Recupera le chiusure giornaliere per un mese specifico
   * @param month Mese (1-12)
   * @param year Anno
   * @param projectId ID del progetto (opzionale)
   * @returns Array di chiusure giornaliere filtrate per mese
   */
  getByMonth(
    month: number,
    year: number,
    projectId?: string
  ): Observable<DailyClosing[]> {
    try {
      const closings = this.getClosingsFromStorage();

      const filtered = closings.filter((closing) => {
        const closingDate = new Date(closing.date);
        return (
          closingDate.getMonth() + 1 === month &&
          closingDate.getFullYear() === year &&
          (projectId ? closing.projectId === projectId : true)
        );
      });

      return of(filtered);
    } catch (error) {
      console.error('Errore nel recupero delle chiusure:', error);
      return throwError(() => new Error('Errore nel recupero delle chiusure'));
    }
  }

  /**
   * Crea una nuova chiusura giornaliera
   * @param closing Dati della chiusura da creare
   * @returns Chiusura creata
   */
  create(closing: DailyClosing): Observable<DailyClosing> {
    try {
      const closings = this.getClosingsFromStorage();

      // Genera un ID univoco
      const newClosing: DailyClosing = {
        ...closing,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      closings.push(newClosing);
      this.saveClosingsToStorage(closings);

      return of(newClosing);
    } catch (error) {
      console.error('Errore nella creazione della chiusura:', error);
      return throwError(
        () => new Error('Errore nella creazione della chiusura')
      );
    }
  }

  /**
   * Aggiorna una chiusura giornaliera esistente
   * @param id ID della chiusura da aggiornare
   * @param closing Dati aggiornati della chiusura
   * @returns Chiusura aggiornata
   */
  update(id: string, closing: Partial<DailyClosing>): Observable<DailyClosing> {
    try {
      const closings = this.getClosingsFromStorage();
      const index = closings.findIndex((c) => c.id === id);

      if (index === -1) {
        return throwError(() => new Error('Chiusura non trovata'));
      }

      const updatedClosing: DailyClosing = {
        ...closings[index],
        ...closing,
        updatedAt: new Date(),
      };

      closings[index] = updatedClosing;
      this.saveClosingsToStorage(closings);

      return of(updatedClosing);
    } catch (error) {
      console.error("Errore nell'aggiornamento della chiusura:", error);
      return throwError(
        () => new Error("Errore nell'aggiornamento della chiusura")
      );
    }
  }

  /**
   * Elimina una chiusura giornaliera
   * @param id ID della chiusura da eliminare
   * @returns Observable vuoto
   */
  delete(id: string): Observable<void> {
    try {
      const closings = this.getClosingsFromStorage();
      const filtered = closings.filter((c) => c.id !== id);

      if (filtered.length === closings.length) {
        return throwError(() => new Error('Chiusura non trovata'));
      }

      this.saveClosingsToStorage(filtered);
      return of(void 0);
    } catch (error) {
      console.error("Errore nell'eliminazione della chiusura:", error);
      return throwError(
        () => new Error("Errore nell'eliminazione della chiusura")
      );
    }
  }

  /**
   * Esporta le chiusure giornaliere in Excel
   * @param options Opzioni per l'esportazione
   * @returns Observable che completa quando l'esportazione è terminata
   */
  exportToExcel(options: ClosingExportOptions): Observable<Blob> {
    return this.getByMonth(options.month, options.year, options.projectId).pipe(
      map((closings) => {
        if (closings.length === 0) {
          throw new Error(
            'Nessun dato da esportare per il periodo selezionato'
          );
        }

        return this.generateExcelFile(closings, options);
      }),
      catchError((error) => {
        console.error("Errore nell'esportazione Excel:", error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Genera un file Excel con i dati delle chiusure
   * @param closings Array di chiusure da esportare
   * @param options Opzioni per l'esportazione
   * @returns Blob del file Excel
   */
  private generateExcelFile(
    closings: DailyClosing[],
    options: ClosingExportOptions
  ): Blob {
    // Prepara i dati per l'export
    const exportData = closings.map((closing) => ({
      Data: new Date(closing.date).toLocaleDateString('it-IT'),
      'E-Ticket': closing.eTickets.toFixed(2) + ' €',
      'Ticket Cartacei': closing.paperTickets.toFixed(2) + ' €',
      Addebiti: closing.charges.toFixed(2) + ' €',
      Contanti: closing.cash.toFixed(2) + ' €',
      'Carta di Credito': closing.creditCard.toFixed(2) + ' €',
      Bancomat: closing.debitCard.toFixed(2) + ' €',
      Fatture: closing.invoices.toFixed(2) + ' €',
      'Fatture differite': closing.deferredInvoices.toFixed(2) + ' €',
      Altro: closing.other.toFixed(2) + ' €',
      Totale: this.calculateTotal(closing).toFixed(2) + ' €',
      Operatore: closing.operatorName,
      Note: closing.notes || '',
    }));

    // Crea un nuovo foglio di lavoro
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Crea un nuovo libro di lavoro e aggiungi il foglio
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chiusure');

    // Imposta la larghezza delle colonne
    const columnWidths = [
      { wch: 12 }, // Data
      { wch: 12 }, // E-Ticket
      { wch: 12 }, // Ticket Cartacei
      { wch: 12 }, // Addebiti
      { wch: 12 }, // Contanti
      { wch: 12 }, // Carta di Credito
      { wch: 12 }, // Bancomat
      { wch: 12 }, // Fatture
      { wch: 12 }, // Fatture differite
      { wch: 12 }, // Altro
      { wch: 12 }, // Totale
      { wch: 20 }, // Operatore
      { wch: 30 }, // Note
    ];
    worksheet['!cols'] = columnWidths;

    // Genera il file Excel
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  /**
   * Calcola il totale per una chiusura
   */
  private calculateTotal(closing: DailyClosing): number {
    return (
      closing.eTickets +
      closing.paperTickets +
      closing.charges +
      closing.cash +
      closing.creditCard +
      closing.debitCard +
      closing.invoices +
      closing.deferredInvoices +
      closing.other
    );
  }

  /**
   * Recupera le chiusure dal localStorage
   */
  private getClosingsFromStorage(): DailyClosing[] {
    const data = localStorage.getItem(this.localStorageKey);
    if (!data) return [];

    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Errore nel parsing dei dati dal localStorage:', error);
      return [];
    }
  }

  /**
   * Salva le chiusure nel localStorage
   */
  private saveClosingsToStorage(closings: DailyClosing[]): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(closings));
  }

  /**
   * Genera un ID univoco
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
