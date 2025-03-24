import { computed, inject } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Supplier, CreateSupplierDto } from '../models/supplier.model';
import { SupplierService } from '../services/api/local/supplier.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

export interface SupplierState {
  suppliers: Supplier[] | null;
  selectedSupplier: Supplier | null;
  loading: boolean;
  error: string | null;
}

const initialState: SupplierState = {
  suppliers: null,
  selectedSupplier: null,
  loading: false,
  error: null,
};

export const SupplierStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      supplierService = inject(SupplierService),
      authService = inject(AuthService),
      router = inject(Router),
      toastService = inject(ToastService)
    ) => ({
      // Utility method to get supplier by ID
      getSupplierById(id: string) {
        const currentSuppliers = store.suppliers();
        return currentSuppliers
          ? currentSuppliers.find((supplier) => supplier.id === id)
          : null;
      },

      // Utility method to get supplier by tax code
      getSupplierByTaxCode(taxCode: string) {
        const currentSuppliers = store.suppliers();
        return currentSuppliers
          ? currentSuppliers.find((supplier) => supplier.taxCode === taxCode)
          : null;
      },

      // Fetch project suppliers (based on role)
      fetchProjectSuppliers: rxMethod<{ projectId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? supplierService.getAdminProjectSuppliers(projectId)
                : supplierService.getPartnerProjectSuppliers(projectId);

            return request.pipe(
              tapResponse({
                next: (suppliers) => {
                  patchState(store, { suppliers, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to fetch suppliers',
                  });
                },
              })
            );
          })
        )
      ),

      // Fetch all partner suppliers
      fetchAllPartnerSuppliers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            return supplierService.getAllPartnerSuppliers().pipe(
              tapResponse({
                next: (suppliers) => {
                  patchState(store, { suppliers, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to fetch suppliers',
                  });
                },
              })
            );
          })
        )
      ),

      // Fetch partner suppliers for admin
      fetchPartnerSuppliers: rxMethod<{ partnerId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ partnerId }) => {
            return supplierService.getAdminPartnerSuppliers(partnerId).pipe(
              tapResponse({
                next: (suppliers) => {
                  patchState(store, { suppliers, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch partner suppliers',
                  });
                },
              })
            );
          })
        )
      ),

      // Create or associate supplier
      createOrAssociateSupplier: rxMethod<{
        projectId: string;
        supplier: CreateSupplierDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, supplier }) =>
            supplierService.createOrAssociateSupplier(projectId, supplier).pipe(
              tapResponse({
                next: (createdSupplier) => {
                  toastService.showSuccess(
                    'Supplier successfully created or associated'
                  );

                  // Update suppliers array with the new supplier
                  const currentSuppliers = store.suppliers() || [];
                  // Verifichiamo se il fornitore esiste già nell'array
                  const existingSupplierIndex = currentSuppliers.findIndex(
                    (s) => s.id === createdSupplier.id
                  );

                  let updatedSuppliers;
                  if (existingSupplierIndex >= 0) {
                    // Aggiorniamo il fornitore esistente
                    updatedSuppliers = currentSuppliers.map((s, index) =>
                      index === existingSupplierIndex ? createdSupplier : s
                    );
                  } else {
                    // Aggiungiamo il nuovo fornitore
                    updatedSuppliers = [...currentSuppliers, createdSupplier];
                  }

                  patchState(store, {
                    suppliers: updatedSuppliers,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError(
                    'Failed to create or associate supplier'
                  );
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to create or associate supplier',
                  });
                },
              })
            )
          )
        )
      ),

      // Disassociate supplier
      disassociateSupplier: rxMethod<{ projectId: string; taxCode: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, taxCode }) =>
            supplierService.disassociateSupplier(projectId, taxCode).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess(
                    'Supplier successfully disassociated'
                  );

                  // Aggiorniamo l'elenco dei fornitori rimuovendo il fornitore disassociato
                  const currentSuppliers = store.suppliers() || [];
                  const supplierToUpdate = currentSuppliers.find(
                    (s) => s.taxCode === taxCode
                  );

                  if (supplierToUpdate) {
                    // Rimuoviamo l'ID del progetto da projectIds
                    const updatedProjectIds =
                      supplierToUpdate.projectIds.filter(
                        (id) => id !== projectId
                      );

                    // Aggiorniamo l'array dei fornitori
                    const updatedSuppliers = currentSuppliers.map((s) =>
                      s.taxCode === taxCode
                        ? { ...s, projectIds: updatedProjectIds }
                        : s
                    );

                    // Se il fornitore non ha più progetti associati, lo rimuoviamo dall'array
                    const finalSuppliers = updatedSuppliers.filter(
                      (s) => s.taxCode !== taxCode || s.projectIds.length > 0
                    );

                    patchState(store, {
                      suppliers: finalSuppliers,
                      selectedSupplier:
                        store.selectedSupplier()?.taxCode === taxCode
                          ? null
                          : store.selectedSupplier(),
                      loading: false,
                      error: null,
                    });
                  } else {
                    patchState(store, { loading: false, error: null });
                  }
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to disassociate supplier');
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to disassociate supplier',
                  });
                },
              })
            )
          )
        )
      ),

      // Select supplier
      selectSupplier: (supplier: Supplier) => {
        patchState(store, { selectedSupplier: supplier });
      },

      // Clear selected supplier
      clearSelectedSupplier: () => {
        patchState(store, { selectedSupplier: null });
      },

      // Clear errors
      clearSupplierErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo i fornitori automaticamente all'inizializzazione
      // perché potrebbero essere richiesti in contesti diversi (per progetto, per partner, ecc.)
    },
  })
);
