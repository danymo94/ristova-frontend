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
} from '../models/einvoice.model';
import { EinvoiceService } from '../services/api/local/einvoice.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

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
      router = inject(Router),
      toastService = inject(ToastService)
    ) => ({
      // Utility method to get invoice by ID
      getInvoiceById(id: string) {
        const currentInvoices = store.invoices();
        return currentInvoices
          ? currentInvoices.find((invoice) => invoice.id === id)
          : null;
      },

      // Fetch project invoices (based on role)
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

      // Fetch all partner invoices
      fetchAllPartnerInvoices: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            return einvoiceService.getAllPartnerInvoices().pipe(
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

      // Fetch partner invoices for admin
      fetchPartnerInvoices: rxMethod<{ partnerId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ partnerId }) => {
            return einvoiceService.getAdminPartnerInvoices(partnerId).pipe(
              tapResponse({
                next: (invoices) => {
                  patchState(store, { invoices, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch partner invoices',
                  });
                },
              })
            );
          })
        )
      ),

      // Get invoice details
      getInvoice: rxMethod<{ projectId: string; invoiceId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, invoiceId }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? einvoiceService.getAdminInvoice(invoiceId)
                : einvoiceService.getPartnerInvoice(projectId, invoiceId);

            return request.pipe(
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

      // Create invoice
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
                  toastService.showSuccess('Invoice created successfully');

                  // Update invoices array with the new invoice
                  const currentInvoices = store.invoices() || [];
                  patchState(store, {
                    invoices: [...currentInvoices, createdInvoice],
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to create invoice');
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

      // Update invoice
      updateInvoice: rxMethod<{
        projectId: string;
        invoiceId: string;
        invoice: UpdateEInvoiceDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, invoiceId, invoice }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? einvoiceService.updateAdminInvoice(invoiceId, invoice)
                : einvoiceService.updateInvoice(projectId, invoiceId, invoice);

            return request.pipe(
              tapResponse({
                next: (updatedInvoice) => {
                  toastService.showSuccess('Invoice updated successfully');

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
                  toastService.showError('Failed to update invoice');
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

      // Select invoice
      selectInvoice: (invoice: EInvoice) => {
        patchState(store, { selectedInvoice: invoice });
      },

      // Clear selected invoice
      clearSelectedInvoice: () => {
        patchState(store, { selectedInvoice: null });
      },

      // Clear errors
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
