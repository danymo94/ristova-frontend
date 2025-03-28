import { computed, inject } from '@angular/core';
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
  AssignCostCenterDto,
  ProcessInventoryDto,
  InvoiceStatus,
} from '../models/einvoice.model';
import { EinvoiceService } from '../services/api/local/einvoice.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import {
  AssignInvoiceToCostCenterResponse,
  StockMovement,
} from '../models/stock-movement.model';

export interface EInvoiceState {
  invoices: EInvoice[] | null;
  selectedInvoice: EInvoice | null;
  loading: boolean;
  error: string | null;
}

const initialState: EInvoiceState = {
  invoices: null,
  selectedInvoice: null,
  loading: false,
  error: null,
};

export const EInvoiceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      einvoiceService = inject(EinvoiceService),
      authService = inject(AuthService),
      toastService = inject(ToastService)
    ) => ({
      // Metodi di base

      // Recupera fatture di un progetto
      fetchProjectInvoices: rxMethod<{ projectId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? einvoiceService.getAdminProjectInvoices(projectId)
                : einvoiceService.getPartnerProjectInvoices(projectId);

            return request.pipe(
              tapResponse({
                next: (invoices) => {
                  patchState(store, { invoices, loading: false, error: null });
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

      // Recupera una fattura specifica
      getInvoice: rxMethod<{ projectId: string; invoiceId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, invoiceId }) => {
            return einvoiceService.getPartnerInvoice(projectId, invoiceId).pipe(
              tapResponse({
                next: (invoice) => {
                  patchState(store, {
                    selectedInvoice: invoice,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to load invoice',
                  });
                },
              })
            );
          })
        )
      ),

      // Crea una nuova fattura
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

                  // Update invoices array with the new invoice
                  const currentInvoices = store.invoices() || [];
                  patchState(store, {
                    invoices: [...currentInvoices, createdInvoice],
                    loading: false,
                    error: null,
                  });
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

      // Aggiorna una fattura esistente
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
                    toastService.showSuccess('Fattura aggiornata con successo');

                    // Update invoices array with the updated invoice
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
                  },
                  error: (error: unknown) => {
                    toastService.showError('Impossibile aggiornare la fattura');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to update invoice',
                    });
                  },
                })
              );
          })
        )
      ),

      // Elimina una fattura
      deleteInvoice: rxMethod<{ projectId: string; invoiceId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, invoiceId }) => {
            return einvoiceService.deleteInvoice(projectId, invoiceId).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Fattura eliminata con successo');

                  // Remove deleted invoice from the array
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

      // Aggiorna lo stato di pagamento
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

                    // Update invoices array with the updated invoice
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

      // Nuovi metodi per l'assegnazione e l'elaborazione delle fatture

      // Assign invoice to cost center
      assignInvoiceToCostCenter: rxMethod<{
        projectId: string;
        invoiceId: string;
        costCenterId: string;
      }>(
        pipe(
          tap(({ invoiceId }) => {
            patchState(store, { loading: true, error: null });

            // Imposta il flag processing sulla fattura selezionata e nella lista
            const currentInvoice = store.selectedInvoice();
            const currentInvoices = store.invoices();

            if (currentInvoice && currentInvoice.id === invoiceId) {
              patchState(store, {
                selectedInvoice: { ...currentInvoice, processing: true },
              });
            }

            if (currentInvoices) {
              const updatedInvoices = currentInvoices.map((inv) =>
                inv.id === invoiceId ? { ...inv, processing: true } : inv
              );
              patchState(store, { invoices: updatedInvoices });
            }

            // Rilascia immediatamente il loading globale
            patchState(store, { loading: false });
          }),
          switchMap(({ projectId, invoiceId, costCenterId }) =>
            einvoiceService
              .assignInvoiceToCostCenter(projectId, invoiceId, costCenterId)
              .pipe(
                tapResponse({
                  next: (response: AssignInvoiceToCostCenterResponse) => {
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
                    }

                    patchState(store, { error: null });
                    toastService.showSuccess(
                      'Fattura assegnata al centro di costo con successo'
                    );
                  },
                  error: (error: unknown) => {
                    // In caso di errore, rimuovi comunque il flag processing
                    const currentInvoices = store.invoices();
                    if (currentInvoices) {
                      const updatedInvoices = currentInvoices.map((inv) =>
                        inv.id === invoiceId
                          ? { ...inv, processing: false }
                          : inv
                      );
                      patchState(store, { invoices: updatedInvoices });
                    }

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

      // Process invoice to warehouse
      processInvoiceToWarehouse: rxMethod<{
        projectId: string;
        invoiceId: string;
        warehouseId: string;
        data: any;
      }>(
        pipe(
          tap(({ projectId, invoiceId, warehouseId, data }) => {
            patchState(store, { loading: true, error: null });

            // Imposta il flag processing sulla fattura selezionata e nella lista
            const currentInvoice = store.selectedInvoice();
            const currentInvoices = store.invoices();

            if (currentInvoice && currentInvoice.id === invoiceId) {
              patchState(store, {
                selectedInvoice: { ...currentInvoice, processing: true },
              });
            }

            if (currentInvoices) {
              const updatedInvoices = currentInvoices.map((inv) =>
                inv.id === invoiceId ? { ...inv, processing: true } : inv
              );
              patchState(store, { invoices: updatedInvoices });
            }

            // Rilascia immediatamente il loading globale
            patchState(store, { loading: false });
          }),
          switchMap(({ projectId, invoiceId, warehouseId, data }) =>
            einvoiceService
              .processInvoiceToWarehouse(
                projectId,
                invoiceId,
                warehouseId,
                data
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
                        currentInvoice.status.inventoryStatus ===
                        'not_processed'
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

                      const updatedInvoice: EInvoice = {
                        ...currentInvoice,
                        status: updatedStatus,
                        processing: false, // Rimuovi il flag processing
                      };

                      patchState(store, {
                        selectedInvoice: updatedInvoice,
                      });
                    }

                    // Aggiorna anche la lista delle fatture se presente
                    const currentInvoices = store.invoices();
                    if (currentInvoices) {
                      const updatedInvoices = currentInvoices.map((inv) => {
                        if (inv.id === invoiceId) {
                          const newInventoryStatus =
                            inv.status.inventoryStatus === 'not_processed'
                              ? ('processed' as const)
                              : ('partially_processed' as const);

                          const updatedStatus: InvoiceStatus = {
                            ...inv.status,
                            inventoryStatus: newInventoryStatus,
                            inventoryIds: [
                              ...(inv.status.inventoryIds || []),
                              warehouseId,
                            ],
                            inventoryProcessDate: new Date().toISOString(),
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
                    }

                    patchState(store, { error: null });
                    toastService.showSuccess('Movimento creato con successo');
                  },
                  error: (error: unknown) => {
                    // In caso di errore, rimuovi comunque il flag processing
                    const currentInvoices = store.invoices();
                    if (currentInvoices) {
                      const updatedInvoices = currentInvoices.map((inv) =>
                        inv.id === invoiceId
                          ? { ...inv, processing: false }
                          : inv
                      );
                      patchState(store, { invoices: updatedInvoices });
                    }

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
              )
          )
        )
      ),

      // Altre utility
      selectInvoice: (invoice: EInvoice) => {
        patchState(store, { selectedInvoice: invoice });
      },

      clearSelectedInvoice: () => {
        patchState(store, { selectedInvoice: null });
      },

      clearInvoiceErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo le fatture automaticamente all'inizializzazione
      // perché potrebbero essere richieste in contesti diversi (per progetto, per partner, ecc.)
    },
  })
);
