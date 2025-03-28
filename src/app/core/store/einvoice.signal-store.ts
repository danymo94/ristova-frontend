import { computed, inject, Signal } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  EInvoice,
  CreateEInvoiceDto,
  UpdateEInvoiceDto,
  UpdatePaymentStatusDto,
  InvoiceStatus,
} from '../models/einvoice.model';
import { EinvoiceService } from '../services/api/local/einvoice.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { StockMovement } from '../models/stock-movement.model';

export interface EInvoiceFilters {
  // Filtri per stati di pagamento
  paymentStatus?: ('pending' | 'scheduled' | 'paid' | 'canceled')[];

  // Filtri per centro di costo
  costCenterStatus?: ('not_assigned' | 'assigned')[];
  costCenterId?: string;

  // Filtri per magazzino
  inventoryStatus?: ('not_processed' | 'processed' | 'partially_processed')[];
  warehouseId?: string;

  // Filtri aggiuntivi
  invoiceNumber?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SelectedInvoiceAdditionalData {
  relatedMovements?: StockMovement[];
  supplierDetails?: any;
  documents?: any[];
  // Altri dati aggiuntivi che potrebbero essere caricati separatamente
}

export interface EInvoiceState {
  invoices: EInvoice[] | null;
  filteredInvoices: EInvoice[] | null;
  selectedInvoice: EInvoice | null;
  selectedInvoiceAdditionalData: SelectedInvoiceAdditionalData | null;
  filters: EInvoiceFilters;
  loading: boolean;
  error: string | null;
}

const initialState: EInvoiceState = {
  invoices: null,
  filteredInvoices: null,
  selectedInvoice: null,
  selectedInvoiceAdditionalData: null,
  filters: {},
  loading: false,
  error: null,
};

export const EInvoiceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(
    ({
      invoices,
      filteredInvoices,
      filters,
      selectedInvoice,
      selectedInvoiceAdditionalData,
    }) => ({
      // Conteggio totale delle fatture
      totalCount: computed(() => {
        const invs = invoices();
        return invs ? invs.length : 0;
      }),

      // Conteggio delle fatture filtrate
      filteredCount: computed(() => {
        const filtered = filteredInvoices();
        return filtered ? filtered.length : 0;
      }),

      // Somma degli importi totali delle fatture filtrate
      filteredTotalAmount: computed(() => {
        const filtered = filteredInvoices();
        if (!filtered || filtered.length === 0) return 0;
        return filtered.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      }),

      // Fatture raggruppate per stato di pagamento
      invoicesByPaymentStatus: computed(() => {
        const result = {
          pending: 0,
          scheduled: 0,
          paid: 0,
          canceled: 0,
        };

        const allInvoices = invoices();
        if (!allInvoices) return result;

        allInvoices.forEach((inv) => {
          const status = inv.status.paymentStatus;
          if (status && result[status] !== undefined) {
            result[status]++;
          }
        });

        return result;
      }),

      // Verifica se esiste un filtro attivo
      hasActiveFilters: computed(() => {
        const currentFilters = filters();
        return (
          Object.keys(currentFilters).length > 0 &&
          Object.values(currentFilters).some(
            (val) =>
              val !== undefined && (Array.isArray(val) ? val.length > 0 : true)
          )
        );
      }),

      // Informazioni sulla fattura selezionata
      isSelectedInvoicePaid: computed(() => {
        const inv = selectedInvoice();
        return inv ? inv.status.paymentStatus === 'paid' : false;
      }),

      isSelectedInvoiceAssigned: computed(() => {
        const inv = selectedInvoice();
        return inv ? inv.status.costCenterStatus === 'assigned' : false;
      }),

      isSelectedInvoiceProcessed: computed(() => {
        const inv = selectedInvoice();
        return inv ? inv.status.inventoryStatus === 'processed' : false;
      }),

      selectedInvoiceSupplier: computed(() => {
        const additionalData = selectedInvoiceAdditionalData();
        return additionalData?.supplierDetails || null;
      }),
    })
  ),

  withMethods(
    (
      store,
      einvoiceService = inject(EinvoiceService),
      authService = inject(AuthService),
      toastService = inject(ToastService)
    ) => {
      // Definisco le funzioni di utilità all'interno della closure
      // così posso richiamarle tramite this nei metodi senza incorrere in errori

      /**
       * Applica i filtri alla lista delle fatture
       */
      function applyFilters(filters: EInvoiceFilters) {
        const currentInvoices = store.invoices();
        if (!currentInvoices) {
          patchState(store, { filteredInvoices: null });
          return;
        }

        let filteredInvoices = [...currentInvoices];

        // Filtro per stato di pagamento
        if (filters.paymentStatus && filters.paymentStatus.length > 0) {
          filteredInvoices = filteredInvoices.filter((inv) =>
            filters.paymentStatus!.includes(inv.status.paymentStatus)
          );
        }

        // Filtro per stato centro di costo
        if (filters.costCenterStatus && filters.costCenterStatus.length > 0) {
          filteredInvoices = filteredInvoices.filter((inv) =>
            filters.costCenterStatus!.includes(inv.status.costCenterStatus)
          );
        }

        // Filtro per ID centro di costo
        if (filters.costCenterId) {
          filteredInvoices = filteredInvoices.filter(
            (inv) => inv.status.costCenterId === filters.costCenterId
          );
        }

        // Filtro per stato inventario
        if (filters.inventoryStatus && filters.inventoryStatus.length > 0) {
          filteredInvoices = filteredInvoices.filter((inv) =>
            filters.inventoryStatus!.includes(inv.status.inventoryStatus)
          );
        }

        // Filtro per ID magazzino
        if (filters.warehouseId) {
          filteredInvoices = filteredInvoices.filter((inv) =>
            inv.status.inventoryIds?.includes(filters.warehouseId!)
          );
        }

        // Filtro per numero fattura
        if (filters.invoiceNumber && filters.invoiceNumber.trim() !== '') {
          const searchTerm = filters.invoiceNumber.toLowerCase().trim();
          filteredInvoices = filteredInvoices.filter((inv) =>
            inv.invoiceNumber.toLowerCase().includes(searchTerm)
          );
        }

        // Filtro per ID fornitore
        if (filters.supplierId) {
          filteredInvoices = filteredInvoices.filter(
            (inv) => inv.supplierId === filters.supplierId
          );
        }

        // Filtro per data (da)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          filteredInvoices = filteredInvoices.filter(
            (inv) => new Date(inv.invoiceDate) >= fromDate
          );
        }

        // Filtro per data (a)
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          filteredInvoices = filteredInvoices.filter(
            (inv) => new Date(inv.invoiceDate) <= toDate
          );
        }

        patchState(store, { filteredInvoices });
      }

      /**
       * Carica i dati aggiuntivi per la fattura selezionata
       */
      function loadSelectedInvoiceAdditionalData() {
        const currentInvoice = store.selectedInvoice();
        if (!currentInvoice) return;

        // Inizializza l'oggetto dei dati aggiuntivi se non esiste
        if (!store.selectedInvoiceAdditionalData()) {
          patchState(store, {
            selectedInvoiceAdditionalData: {
              relatedMovements: [],
              supplierDetails: null,
              documents: [],
            },
          });
        }

        // Qui in futuro potrebbero essere aggiunte chiamate per caricare
        // dati relativi alla fattura selezionata da altri servizi
      }

      /**
       * Aggiunge un movimento correlato alla fattura selezionata
       */
      function addRelatedMovement(movement: StockMovement) {
        const currentData = store.selectedInvoiceAdditionalData() || {
          relatedMovements: [],
        };
        const updatedMovements = [
          ...(currentData.relatedMovements || []),
          movement,
        ];

        patchState(store, {
          selectedInvoiceAdditionalData: {
            ...currentData,
            relatedMovements: updatedMovements,
          },
        });
      }

      /**
       * Utility per aggiornare una fattura nella lista
       */
      function updateInvoiceInList(
        invoiceId: string,
        updateFn: (invoice: EInvoice) => EInvoice | null
      ) {
        const currentInvoices = store.invoices();
        if (!currentInvoices) return;

        // Trova la fattura nella lista
        const invoiceToUpdate = currentInvoices.find(
          (inv) => inv.id === invoiceId
        );
        if (!invoiceToUpdate) return;

        // Applica la funzione di aggiornamento
        const updatedInvoice = updateFn(invoiceToUpdate);
        if (!updatedInvoice) return;

        // Aggiorna la lista
        const updatedInvoices = currentInvoices.map((inv) =>
          inv.id === invoiceId ? updatedInvoice : inv
        );

        patchState(store, { invoices: updatedInvoices });

        // Riapplica i filtri alla lista aggiornata
        applyFilters(store.filters());
      }

      /**
       * Imposta o rimuove il flag di elaborazione su una fattura
       */
      function setProcessingFlag(invoiceId: string, isProcessing: boolean) {
        // Aggiorna la fattura selezionata se necessario
        const currentInvoice = store.selectedInvoice();
        if (currentInvoice && currentInvoice.id === invoiceId) {
          patchState(store, {
            selectedInvoice: { ...currentInvoice, processing: isProcessing },
          });
        }

        // Aggiorna la lista delle fatture
        updateInvoiceInList(invoiceId, (invoice) => ({
          ...invoice,
          processing: isProcessing,
        }));
      }

      /**
       * Rimuove il flag di elaborazione da una fattura
       */
      function clearProcessingFlag(invoiceId: string) {
        setProcessingFlag(invoiceId, false);
      }

      // Ritorno i metodi dello store
      return {
        // ==== METODI BASE PER IL CARICAMENTO DELLE FATTURE ====

        /**
         * Recupera fatture di un progetto e applica i filtri attivi
         */
        // Correggiamo i metodi problematici

        /**
         * Recupera fatture di un progetto e applica i filtri attivi
         */
        fetchProjectInvoices: rxMethod<{
          projectId: string;
          shouldApplyFilters?: boolean;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, shouldApplyFilters = true }) => {
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? einvoiceService.getAdminProjectInvoices(projectId)
                  : einvoiceService.getPartnerProjectInvoices(projectId);

              return request.pipe(
                tapResponse({
                  next: (invoices) => {
                    patchState(store, {
                      invoices,
                      loading: false,
                      error: null,
                    });

                    // Applica i filtri dopo il caricamento se richiesto
                    if (shouldApplyFilters) {
                      applyFilters(store.filters());
                    } else {
                      patchState(store, { filteredInvoices: invoices });
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to fetch invoices',
                    });
                  },
                })
              );
            })
          )
        ),

        /**
         * Recupera tutte le fatture del partner corrente e applica i filtri attivi
         */
        fetchAllPartnerInvoices: rxMethod<{ shouldApplyFilters?: boolean }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ shouldApplyFilters = true }) => {
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? einvoiceService.getAllAdminInvoices()
                  : einvoiceService.getAllPartnerInvoices();

              return request.pipe(
                tapResponse({
                  next: (invoices) => {
                    patchState(store, {
                      invoices,
                      loading: false,
                      error: null,
                    });

                    // Applica i filtri dopo il caricamento se richiesto
                    if (shouldApplyFilters) {
                      applyFilters(store.filters());
                    } else {
                      patchState(store, { filteredInvoices: invoices });
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to fetch invoices',
                    });
                  },
                })
              );
            })
          )
        ),
        /**
         * Recupera una fattura specifica e imposta come selezionata
         */
        getInvoice: rxMethod<{
          projectId: string;
          invoiceId: string;
          loadAdditionalData?: boolean;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(
              ({ projectId, invoiceId, loadAdditionalData = false }) => {
                return einvoiceService
                  .getPartnerInvoice(projectId, invoiceId)
                  .pipe(
                    tapResponse({
                      next: (invoice) => {
                        patchState(store, {
                          selectedInvoice: invoice,
                          loading: false,
                          error: null,
                        });

                        // Carica i dati aggiuntivi se richiesto
                        if (loadAdditionalData) {
                          loadSelectedInvoiceAdditionalData();
                        }
                      },
                      error: (error: unknown) => {
                        patchState(store, {
                          loading: false,
                          error:
                            (error as Error)?.message ||
                            'Failed to load invoice',
                        });
                      },
                    })
                  );
              }
            )
          )
        ),

        // ==== METODI PER CREARE, AGGIORNARE, ELIMINARE FATTURE ====

        /**
         * Crea una nuova fattura
         */
        createInvoice: rxMethod<{
          projectId: string;
          invoice: CreateEInvoiceDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoice }) =>
              einvoiceService.createInvoice(projectId, invoice).pipe(
                tapResponse({
                  next: (createdInvoice) => {
                    toastService.showSuccess('Fattura creata con successo');

                    // Aggiorna la lista delle fatture con la nuova fattura
                    const currentInvoices = store.invoices() || [];
                    const updatedInvoices = [
                      ...currentInvoices,
                      createdInvoice,
                    ];
                    patchState(store, {
                      invoices: updatedInvoices,
                      loading: false,
                      error: null,
                    });

                    // Riapplica i filtri alla lista aggiornata
                    applyFilters(store.filters());
                  },
                  error: (error: unknown) => {
                    toastService.showError('Impossibile creare la fattura');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to create invoice',
                    });
                  },
                })
              )
            )
          )
        ),

        /**
         * Aggiorna una fattura esistente
         */
        updateInvoice: rxMethod<{
          projectId: string;
          invoiceId: string;
          invoice: UpdateEInvoiceDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoiceId, invoice }) => {
              return einvoiceService
                .updateInvoice(projectId, invoiceId, invoice)
                .pipe(
                  tapResponse({
                    next: (updatedInvoice) => {
                      toastService.showSuccess(
                        'Fattura aggiornata con successo'
                      );

                      // Aggiorna la lista delle fatture con la fattura aggiornata
                      const currentInvoices = store.invoices() || [];
                      const updatedInvoices = currentInvoices.map((inv) =>
                        inv.id === updatedInvoice.id ? updatedInvoice : inv
                      );

                      patchState(store, {
                        invoices: updatedInvoices,
                        selectedInvoice:
                          store.selectedInvoice()?.id === updatedInvoice.id
                            ? updatedInvoice
                            : store.selectedInvoice(),
                        loading: false,
                        error: null,
                      });

                      // Riapplica i filtri alla lista aggiornata
                      applyFilters(store.filters());
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Impossibile aggiornare la fattura'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to update invoice',
                      });
                    },
                  })
                );
            })
          )
        ),

        /**
         * Elimina una fattura
         */
        deleteInvoice: rxMethod<{ projectId: string; invoiceId: string }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoiceId }) => {
              return einvoiceService.deleteInvoice(projectId, invoiceId).pipe(
                tapResponse({
                  next: () => {
                    toastService.showSuccess('Fattura eliminata con successo');

                    // Rimuovi la fattura eliminata dalla lista
                    const currentInvoices = store.invoices() || [];
                    const filteredInvoices = currentInvoices.filter(
                      (inv) => inv.id !== invoiceId
                    );

                    patchState(store, {
                      invoices: filteredInvoices,
                      selectedInvoice:
                        store.selectedInvoice()?.id === invoiceId
                          ? null
                          : store.selectedInvoice(),
                      loading: false,
                      error: null,
                    });

                    // Riapplica i filtri alla lista aggiornata
                    applyFilters(store.filters());
                  },
                  error: (error: unknown) => {
                    toastService.showError('Impossibile eliminare la fattura');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to delete invoice',
                    });
                  },
                })
              );
            })
          )
        ),

        /**
         * Aggiorna lo stato di pagamento di una fattura
         */
        updatePaymentStatus: rxMethod<{
          projectId: string;
          invoiceId: string;
          paymentData: UpdatePaymentStatusDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoiceId, paymentData }) => {
              return einvoiceService
                .updatePaymentStatus(projectId, invoiceId, paymentData)
                .pipe(
                  tapResponse({
                    next: (updatedInvoice) => {
                      toastService.showSuccess(
                        'Stato di pagamento aggiornato con successo'
                      );

                      // Aggiorna la lista delle fatture con la fattura aggiornata
                      const currentInvoices = store.invoices() || [];
                      const updatedInvoices = currentInvoices.map((inv) =>
                        inv.id === updatedInvoice.id ? updatedInvoice : inv
                      );

                      patchState(store, {
                        invoices: updatedInvoices,
                        selectedInvoice:
                          store.selectedInvoice()?.id === updatedInvoice.id
                            ? updatedInvoice
                            : store.selectedInvoice(),
                        loading: false,
                        error: null,
                      });

                      // Riapplica i filtri alla lista aggiornata
                      applyFilters(store.filters());
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Impossibile aggiornare lo stato di pagamento'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to update payment status',
                      });
                    },
                  })
                );
            })
          )
        ),

        // ==== METODI PER L'INTEGRAZIONE CON ALTRE FUNZIONALITÀ ====

        /**
         * Assegna una fattura a un centro di costo
         */
        assignInvoiceToCostCenter: rxMethod<{
          projectId: string;
          invoiceId: string;
          costCenterId: string;
        }>(
          pipe(
            tap(({ invoiceId }) => {
              patchState(store, { loading: true, error: null });

              // Imposta il flag processing sulla fattura selezionata e nella lista
              setProcessingFlag(invoiceId, true);

              // Rilascia immediatamente il loading globale
              patchState(store, { loading: false });
            }),
            switchMap(({ projectId, invoiceId, costCenterId }) =>
              einvoiceService
                .assignInvoiceToCostCenter(projectId, invoiceId, costCenterId)
                .pipe(
                  tapResponse({
                    next: (response: StockMovement) => {
                      // Aggiorna la fattura corrente se necessario
                      const currentInvoice = store.selectedInvoice();
                      if (currentInvoice && currentInvoice.id === invoiceId) {
                        // Creiamo un nuovo oggetto status per evitare problemi di tipizzazione
                        const updatedStatus: InvoiceStatus = {
                          ...currentInvoice.status,
                          costCenterStatus: 'assigned',
                          costCenterId: costCenterId,
                          costCenterAssignDate: new Date().toISOString(),
                        };

                        const updatedInvoice: EInvoice = {
                          ...currentInvoice,
                          status: updatedStatus,
                          processing: false, // Rimuovi il flag processing
                        };

                        patchState(store, {
                          selectedInvoice: updatedInvoice,
                        });

                        // Aggiorna anche i dati aggiuntivi con il nuovo movimento
                        addRelatedMovement(response);
                      }

                      // Aggiorna anche la lista delle fatture se presente
                      const currentInvoices = store.invoices();
                      if (currentInvoices) {
                        const updatedInvoices = currentInvoices.map((inv) => {
                          if (inv.id === invoiceId) {
                            const updatedStatus: InvoiceStatus = {
                              ...inv.status,
                              costCenterStatus: 'assigned',
                              costCenterId: costCenterId,
                              costCenterAssignDate: new Date().toISOString(),
                            };
                            return {
                              ...inv,
                              status: updatedStatus,
                              processing: false, // Rimuovi il flag processing
                            };
                          }
                          return inv;
                        });

                        patchState(store, { invoices: updatedInvoices });

                        // Riapplica i filtri alla lista aggiornata
                        applyFilters(store.filters());
                      }

                      patchState(store, { error: null });
                      toastService.showSuccess(
                        'Fattura assegnata al centro di costo con successo'
                      );
                    },
                    error: (error: unknown) => {
                      // In caso di errore, rimuovi comunque il flag processing
                      clearProcessingFlag(invoiceId);

                      toastService.showError(
                        "Errore nell'assegnazione della fattura al centro di costo"
                      );
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          "Errore nell'assegnazione della fattura al centro di costo",
                      });
                    },
                  })
                )
            )
          )
        ),

        /**
         * Elabora una fattura creando un movimento di magazzino
         */
        processInvoiceToWarehouse: rxMethod<{
          projectId: string;
          invoiceId: string;
          warehouseId: string;
          lineIndices?: number[];
        }>(
          pipe(
            tap(({ invoiceId }) => {
              patchState(store, { loading: true, error: null });

              // Imposta il flag processing sulla fattura selezionata e nella lista
              setProcessingFlag(invoiceId, true);

              // Rilascia immediatamente il loading globale
              patchState(store, { loading: false });
            }),
            switchMap(({ projectId, invoiceId, warehouseId, lineIndices }) => {
              const options = lineIndices ? { lineIndices } : undefined;

              return einvoiceService
                .processInvoiceToWarehouse(
                  projectId,
                  invoiceId,
                  warehouseId,
                  options
                )
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      // Aggiorna la fattura corrente se necessario
                      const currentInvoice = store.selectedInvoice();
                      if (currentInvoice && currentInvoice.id === invoiceId) {
                        // Determina il nuovo stato dell'inventario in modo tipizzato
                        const newInventoryStatus:
                          | 'not_processed'
                          | 'processed'
                          | 'partially_processed' =
                          !lineIndices ||
                          lineIndices.length ===
                            currentInvoice.invoiceLines.length
                            ? 'processed'
                            : 'partially_processed';

                        // Creiamo un nuovo oggetto status per evitare problemi di tipizzazione
                        const updatedStatus: InvoiceStatus = {
                          ...currentInvoice.status,
                          inventoryStatus: newInventoryStatus,
                          inventoryIds: [
                            ...(currentInvoice.status.inventoryIds || []),
                            warehouseId,
                          ],
                          inventoryProcessDate: new Date().toISOString(),
                        };

                        // Aggiorna anche le righe che sono state elaborate
                        const updatedLines = [...currentInvoice.invoiceLines];
                        if (lineIndices) {
                          lineIndices.forEach((index) => {
                            if (index >= 0 && index < updatedLines.length) {
                              updatedLines[index] = {
                                ...updatedLines[index],
                                processed: true,
                                processedWarehouseId: warehouseId,
                                processedDate: new Date().toISOString(),
                              };
                            }
                          });
                        } else {
                          // Se non ci sono lineIndices, elabora tutte le righe
                          updatedLines.forEach((line, index) => {
                            updatedLines[index] = {
                              ...line,
                              processed: true,
                              processedWarehouseId: warehouseId,
                              processedDate: new Date().toISOString(),
                            };
                          });
                        }

                        const updatedInvoice: EInvoice = {
                          ...currentInvoice,
                          invoiceLines: updatedLines,
                          status: updatedStatus,
                          processing: false, // Rimuovi il flag processing
                        };

                        patchState(store, {
                          selectedInvoice: updatedInvoice,
                        });

                        // Aggiorna anche i dati aggiuntivi con il nuovo movimento
                        addRelatedMovement(movement);
                      }

                      // Aggiorna anche la lista delle fatture
                      updateInvoiceInList(invoiceId, (invoice) => {
                        const newInventoryStatus =
                          !lineIndices ||
                          lineIndices.length === invoice.invoiceLines.length
                            ? 'processed'
                            : 'partially_processed';

                        // Aggiorna le righe elaborate
                        const updatedLines = [...invoice.invoiceLines];
                        if (lineIndices) {
                          lineIndices.forEach((index) => {
                            if (index >= 0 && index < updatedLines.length) {
                              updatedLines[index] = {
                                ...updatedLines[index],
                                processed: true,
                                processedWarehouseId: warehouseId,
                                processedDate: new Date().toISOString(),
                              };
                            }
                          });
                        } else {
                          // Se non ci sono lineIndices, elabora tutte le righe
                          updatedLines.forEach((line, index) => {
                            updatedLines[index] = {
                              ...line,
                              processed: true,
                              processedWarehouseId: warehouseId,
                              processedDate: new Date().toISOString(),
                            };
                          });
                        }

                        const updatedStatus: InvoiceStatus = {
                          ...invoice.status,
                          inventoryStatus: newInventoryStatus,
                          inventoryIds: [
                            ...(invoice.status.inventoryIds || []),
                            warehouseId,
                          ],
                          inventoryProcessDate: new Date().toISOString(),
                        };

                        return {
                          ...invoice,
                          invoiceLines: updatedLines,
                          status: updatedStatus,
                          processing: false,
                        };
                      });

                      patchState(store, { error: null });
                      toastService.showSuccess('Movimento creato con successo');
                    },
                    error: (error: unknown) => {
                      // In caso di errore, rimuovi comunque il flag processing
                      clearProcessingFlag(invoiceId);

                      toastService.showError(
                        'Errore nella creazione del movimento'
                      );
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          'Errore nella creazione del movimento',
                      });
                    },
                  })
                );
            })
          )
        ),

        // ==== METODI PER LA GESTIONE DEI FILTRI ====

        /**
         * Imposta i filtri per le fatture
         */
        setFilters(filters: EInvoiceFilters) {
          patchState(store, { filters });
          applyFilters(filters);
        },

        /**
         * Aggiorna un singolo filtro
         */
        updateFilter(filterKey: keyof EInvoiceFilters, value: any) {
          const currentFilters = { ...store.filters() };
          currentFilters[filterKey] = value;
          this.setFilters(currentFilters);
        },

        /**
         * Rimuove tutti i filtri
         */
        clearFilters() {
          patchState(store, { filters: {} });
          applyFilters({});
        },

        /**
         * Applica i filtri alla lista delle fatture
         */
        applyFilters,

        // ==== METODI PER GESTIRE I DATI AGGIUNTIVI ====

        /**
         * Carica i dati aggiuntivi per la fattura selezionata
         * Questo è un placeholder per futuri metodi che caricano informazioni correlate
         */
        loadSelectedInvoiceAdditionalData: rxMethod<void>(
          pipe(
            tap(() => {
              loadSelectedInvoiceAdditionalData();
            })
          )
        ),

        /**
         * Aggiunge un movimento correlato alla fattura selezionata
         */
        addRelatedMovement,

        /**
         * Reset dei dati aggiuntivi
         */
        clearAdditionalData() {
          patchState(store, { selectedInvoiceAdditionalData: null });
        },

        // ==== UTILITY INTERNE ====
        setProcessingFlag,
        clearProcessingFlag,
        updateInvoiceInList,

        // ==== UTILITY ESTERNE ====

        /**
         * Seleziona una fattura come corrente
         */
        selectInvoice(invoice: EInvoice) {
          patchState(store, { selectedInvoice: invoice });
          loadSelectedInvoiceAdditionalData();
        },

        /**
         * Deseleziona la fattura corrente
         */
        clearSelectedInvoice() {
          patchState(store, {
            selectedInvoice: null,
            selectedInvoiceAdditionalData: null,
          });
        },

        /**
         * Pulisce gli errori
         */
        clearInvoiceErrors() {
          patchState(store, { error: null });
        },
      };
    }
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo le fatture automaticamente all'inizializzazione
      // perché potrebbero essere richieste in contesti diversi (per progetto, per partner, ecc.)
    },
  })
);
