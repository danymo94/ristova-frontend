import { Injectable, computed, inject, signal } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { finalize, switchMap, take, tap } from 'rxjs/operators';
import {
  DailyClosing,
  ClosingExportOptions,
} from '../models/daily-closing.model';
import { ToastService } from '../services/toast.service';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { DailyClosingApiService } from '../services/api/remote/daily-closing-api.service';

/**
 * Interfaccia per lo stato delle chiusure giornaliere
 */
export interface DailyClosingState {
  closings: DailyClosing[] | null;
  filteredClosings: DailyClosing[] | null;
  selectedClosing: DailyClosing | null;
  loading: boolean;
  error: string | null;
  editDialogVisible: boolean;
  createDialogVisible: boolean;
  exportDialogVisible: boolean;
  currentMonth: number;
  currentYear: number;
  searchQuery: string;
}

/**
 * Store per gestire lo stato delle chiusure giornaliere
 */
export const DailyClosingStore = signalStore(
  { providedIn: 'root' },

  // Stato iniziale
  withState<DailyClosingState>({
    closings: null,
    filteredClosings: null,
    selectedClosing: null,
    loading: false,
    error: null,
    editDialogVisible: false,
    createDialogVisible: false,
    exportDialogVisible: false,
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    searchQuery: '',
  }),

  // Proprietà calcolate
  withComputed((store) => {
    return {
      // Totali per la chiusura selezionata
      selectedClosingTotal: computed(() => {
        const selected = store.selectedClosing();
        if (!selected) return 0;

        return (
          selected.eTickets +
          selected.paperTickets +
          selected.charges +
          selected.cash +
          selected.creditCard +
          selected.debitCard +
          selected.invoices +
          selected.deferredInvoices +
          selected.other
        );
      }),

      // Flag per indicare se ci sono chiusure nel mese corrente
      hasClosingsInCurrentMonth: computed(() => {
        const closings = store.filteredClosings();
        return !!closings && closings.length > 0;
      }),

      // Conteggio totale delle chiusure
      closingsCount: computed(() => {
        const closings = store.closings();
        return closings ? closings.length : 0;
      }),

      // Conteggio delle chiusure filtrate
      filteredClosingsCount: computed(() => {
        const closings = store.filteredClosings();
        return closings ? closings.length : 0;
      }),
    };
  }),

  // Metodi
  withMethods(
    (
      store,
      dailyClosingApiService = inject(DailyClosingApiService),
      toastService = inject(ToastService)
    ) => ({
      /**
       * Carica tutte le chiusure giornaliere
       */
      loadClosings(projectId?: string) {
        patchState(store, { loading: true, error: null });

        // Utilizziamo solo mese e anno come filtri, ignorando il projectId
        const currentMonth = store.currentMonth();
        const currentYear = store.currentYear();

        dailyClosingApiService
          .getDailyClosings(undefined, currentMonth, currentYear)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (closings) => {
              patchState(store, {
                closings,
                filteredClosings: closings,
              });
            },
            error: (error) => {
              patchState(store, {
                error: error.message || 'Errore nel caricamento delle chiusure',
              });
              toastService.showError('Errore nel caricamento delle chiusure');
            },
          });
      },

      /**
       * Filtra le chiusure per mese e anno
       */
      filterByMonth(month: number, year: number) {
        patchState(store, {
          currentMonth: month,
          currentYear: year,
          loading: true,
          error: null,
        });

        // Otteniamo direttamente le chiusure filtrate per mese/anno dall'API
        dailyClosingApiService
          .getDailyClosings(undefined, month, year)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (closings) => {
              patchState(store, {
                filteredClosings: closings,
              });
            },
            error: (error) => {
              patchState(store, {
                error: error.message || 'Errore nel caricamento delle chiusure',
              });
              toastService.showError('Errore nel filtraggio delle chiusure');
            },
          });
      },

      /**
       * Filtra le chiusure per testo di ricerca
       */
      filterBySearchText(query: string) {
        patchState(store, { searchQuery: query });

        // Qui applichiamo il filtro testo lato client
        // sulle chiusure già caricate
        const allClosings = store.filteredClosings();
        if (!allClosings || allClosings.length === 0 || !query.trim()) return;

        const searchText = query.toLowerCase().trim();
        const filtered = allClosings.filter(
          (closing) =>
            closing.operatorName?.toLowerCase().includes(searchText) ||
            closing.notes?.toLowerCase().includes(searchText)
        );

        patchState(store, { filteredClosings: filtered });
      },

      /**
       * Resetta i filtri di ricerca
       */
      resetFilters() {
        patchState(store, { searchQuery: '' });
        this.filterByMonth(store.currentMonth(), store.currentYear());
      },

      /**
       * Seleziona una chiusura specifica
       */
      selectClosing(closingId: string) {
        patchState(store, { loading: true, error: null });

        dailyClosingApiService
          .getDailyClosingById(closingId)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (closing) => {
              patchState(store, { selectedClosing: closing });
            },
            error: (error) => {
              patchState(store, {
                error: error.message || 'Errore nel caricamento della chiusura',
              });
              toastService.showError(
                'Errore nel caricamento dei dettagli della chiusura'
              );
            },
          });
      },

      /**
       * Crea una nuova chiusura
       */
      createClosing(closing: DailyClosing) {
        patchState(store, { loading: true, error: null });

        dailyClosingApiService
          .createDailyClosing(closing)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (newClosing) => {
              const currentClosings = store.closings() || [];
              patchState(store, {
                closings: [...currentClosings, newClosing],
                createDialogVisible: false,
              });

              // Aggiorniamo i filtri per assicurarci che la nuova chiusura sia visibile se appartiene al mese corrente
              this.filterByMonth(store.currentMonth(), store.currentYear());

              toastService.showSuccess('Chiusura creata con successo');
            },
            error: (error) => {
              patchState(store, {
                error: error.message || 'Errore nella creazione della chiusura',
              });
              toastService.showError('Errore nella creazione della chiusura');
            },
          });
      },

      /**
       * Segna una chiusura come inviata
       */
      markAsSent(closingId: string) {
        patchState(store, { loading: true, error: null });

        dailyClosingApiService
          .markDailyClosingAsSent(closingId)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (response) => {
              if (response.success) {
                // Aggiorna i dati dopo il successo dell'operazione
                this.refreshAfterUpdate(closingId);
                toastService.showSuccess(
                  'Chiusura segnata come inviata con successo'
                );
              } else {
                toastService.showError(
                  'Non è stato possibile segnare la chiusura come inviata'
                );
              }
            },
            error: (error) => {
              patchState(store, {
                error:
                  error.message || "Errore nell'aggiornamento della chiusura",
              });
              toastService.showError("Errore nell'invio della chiusura");
            },
          });
      },

      /**
       * Aggiorna i dati dopo la modifica di una chiusura
       */
      refreshAfterUpdate(closingId: string) {
        // Ricarica la chiusura aggiornata dal server
        dailyClosingApiService
          .getDailyClosingById(closingId)
          .pipe(take(1))
          .subscribe({
            next: (updatedClosing) => {
              // Aggiorna la lista completa
              const currentClosings = store.closings() || [];
              const updatedClosings = currentClosings.map((c) =>
                c.id === closingId ? updatedClosing : c
              );

              // Aggiorna la lista filtrata
              const filteredClosings = store.filteredClosings() || [];
              const updatedFilteredClosings = filteredClosings.map((c) =>
                c.id === closingId ? updatedClosing : c
              );

              patchState(store, {
                closings: updatedClosings,
                filteredClosings: updatedFilteredClosings,
                selectedClosing:
                  store.selectedClosing()?.id === closingId
                    ? updatedClosing
                    : store.selectedClosing(),
              });
            },
            error: (error) => {
              console.error(
                'Errore nel recupero della chiusura aggiornata:',
                error
              );
              // In caso di errore, ricarica tutte le chiusure
              this.filterByMonth(store.currentMonth(), store.currentYear());
            },
          });
      },

      /**
       * Esporta le chiusure in Excel
       */
      exportToExcel(options: ClosingExportOptions) {
        patchState(store, { loading: true, error: null });

        // Otteniamo i dati delle chiusure dal server
        dailyClosingApiService
          .getDailyClosings(options.projectId, options.month, options.year)
          .pipe(
            take(1),
            finalize(() => patchState(store, { loading: false }))
          )
          .subscribe({
            next: (closings) => {
              if (closings.length === 0) {
                toastService.showWarn(
                  'Nessun dato da esportare per il periodo selezionato'
                );
                return;
              }

              // Prepariamo il file Excel
              // Prepara i dati per l'export
              const exportData = closings.map((closing) => ({
                Data:
                  closing.date instanceof Date
                    ? closing.date.toLocaleDateString('it-IT')
                    : new Date(closing.date).toLocaleDateString('it-IT'),
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
                Stato: closing.isSent ? 'Inviato' : 'In attesa',
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
                { wch: 10 }, // Stato
                { wch: 30 }, // Note
              ];
              worksheet['!cols'] = columnWidths;

              // Genera il file Excel
              const excelBuffer = XLSX.write(workbook, {
                bookType: 'xlsx',
                type: 'array',
              });
              const blob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });

              // Nome del file
              const monthNames = [
                'Gennaio',
                'Febbraio',
                'Marzo',
                'Aprile',
                'Maggio',
                'Giugno',
                'Luglio',
                'Agosto',
                'Settembre',
                'Ottobre',
                'Novembre',
                'Dicembre',
              ];

              const fileName = `Chiusure_${monthNames[options.month - 1]}_${
                options.year
              }.xlsx`;
              saveAs(blob, fileName);

              patchState(store, { exportDialogVisible: false });
              toastService.showSuccess('Esportazione completata con successo');
            },
            error: (error) => {
              patchState(store, {
                error: error.message || "Errore nell'esportazione dei dati",
              });
              toastService.showError(
                error.message || "Errore nell'esportazione dei dati"
              );
            },
          });
      },

      /**
       * Calcola il totale per una chiusura
       */
      calculateTotal(closing: DailyClosing): number {
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
      },

      /**
       * Apre il dialog di creazione
       */
      openCreateDialog() {
        patchState(store, { createDialogVisible: true });
      },

      /**
       * Chiude il dialog di creazione
       */
      closeCreateDialog() {
        patchState(store, { createDialogVisible: false });
      },

      /**
       * Apre il dialog di modifica
       */
      openEditDialog(closingId: string) {
        this.selectClosing(closingId);
        patchState(store, { editDialogVisible: true });
      },

      /**
       * Chiude il dialog di modifica
       */
      closeEditDialog() {
        patchState(store, { editDialogVisible: false });
      },

      /**
       * Apre il dialog di esportazione
       */
      openExportDialog() {
        patchState(store, { exportDialogVisible: true });
      },

      /**
       * Chiude il dialog di esportazione
       */
      closeExportDialog() {
        patchState(store, { exportDialogVisible: false });
      },

      /**
       * Resetta lo stato dello store
       */
      reset() {
        patchState(store, {
          closings: null,
          filteredClosings: null,
          selectedClosing: null,
          loading: false,
          error: null,
          editDialogVisible: false,
          createDialogVisible: false,
          exportDialogVisible: false,
          currentMonth: new Date().getMonth() + 1,
          currentYear: new Date().getFullYear(),
          searchQuery: '',
        });
      },
    })
  )
);
