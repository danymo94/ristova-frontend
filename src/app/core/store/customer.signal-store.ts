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
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateCustomerCreditDto,
} from '../models/customer.model';
import { CustomersService } from '../services/api/local/customers.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface CustomerState {
  customers: Customer[] | null;
  selectedCustomer: Customer | null;
  loading: boolean;
  error: string | null;
}

const initialState: CustomerState = {
  customers: null,
  selectedCustomer: null,
  loading: false,
  error: null,
};

export const CustomerStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      customersService = inject(CustomersService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService)
    ) => ({
      // Ottieni tutti i clienti di un progetto
      fetchPartnerCustomers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .getPartnerCustomers(selectedProject.id)
              .pipe(
                tapResponse({
                  next: (customers) => {
                    patchState(store, {
                      customers,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero dei clienti',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero dei clienti'
                    );
                  },
                })
              );
          })
        )
      ),

      // Ottieni un cliente specifico
      getCustomer: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .getPartnerCustomer(selectedProject.id, id)
              .pipe(
                tapResponse({
                  next: (customer) => {
                    patchState(store, {
                      selectedCustomer: customer,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero del cliente',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero del cliente'
                    );
                  },
                })
              );
          })
        )
      ),

      // Crea un nuovo cliente
      createCustomer: rxMethod<{ customer: CreateCustomerDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ customer }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .createPartnerCustomer(selectedProject.id, customer)
              .pipe(
                tapResponse({
                  next: (createdCustomer) => {
                    toastService.showSuccess('Cliente creato con successo');

                    // Aggiungi il cliente creato all'array dei clienti
                    if (store.customers()) {
                      const customers = store.customers() || [];
                      patchState(store, {
                        customers: [...customers, createdCustomer],
                        loading: false,
                        error: null,
                      });
                    } else {
                      patchState(store, {
                        customers: [createdCustomer],
                        loading: false,
                        error: null,
                      });
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante la creazione del cliente',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante la creazione del cliente'
                    );
                  },
                })
              );
          })
        )
      ),

      // Aggiorna un cliente esistente
      updateCustomer: rxMethod<{ id: string; customer: UpdateCustomerDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, customer }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .updatePartnerCustomer(selectedProject.id, id, customer)
              .pipe(
                tapResponse({
                  next: (updatedCustomer) => {
                    toastService.showSuccess('Cliente aggiornato con successo');

                    // Aggiorna l'array dei clienti
                    const currentCustomers = store.customers() || [];
                    const updatedCustomers = currentCustomers.map((c) =>
                      c.id === updatedCustomer.id ? updatedCustomer : c
                    );

                    patchState(store, {
                      customers: updatedCustomers,
                      // Aggiorna anche il cliente selezionato se è quello che stiamo modificando
                      selectedCustomer:
                        store.selectedCustomer()?.id === updatedCustomer.id
                          ? updatedCustomer
                          : store.selectedCustomer(),
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante l'aggiornamento del cliente",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante l'aggiornamento del cliente"
                    );
                  },
                })
              );
          })
        )
      ),

      // Aggiorna il credito del cliente
      updateCustomerCredit: rxMethod<{
        id: string;
        creditData: UpdateCustomerCreditDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, creditData }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .updatePartnerCustomerCredit(selectedProject.id, id, creditData)
              .pipe(
                tapResponse({
                  next: (updatedCustomer) => {
                    toastService.showSuccess(
                      'Credito cliente aggiornato con successo'
                    );

                    // Aggiorna l'array dei clienti
                    const currentCustomers = store.customers() || [];
                    const updatedCustomers = currentCustomers.map((c) =>
                      c.id === updatedCustomer.id ? updatedCustomer : c
                    );

                    patchState(store, {
                      customers: updatedCustomers,
                      // Aggiorna anche il cliente selezionato se è quello che stiamo modificando
                      selectedCustomer:
                        store.selectedCustomer()?.id === updatedCustomer.id
                          ? updatedCustomer
                          : store.selectedCustomer(),
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante l'aggiornamento del credito",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante l'aggiornamento del credito"
                    );
                  },
                })
              );
          })
        )
      ),

      // Disattiva (soft delete) un cliente
      deleteCustomer: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return customersService
              .deletePartnerCustomer(selectedProject.id, id)
              .pipe(
                tapResponse({
                  next: () => {
                    toastService.showSuccess(
                      'Cliente disattivato con successo'
                    );

                    // Rimuovi il cliente dall'array
                    const currentCustomers = store.customers() || [];
                    const filteredCustomers = currentCustomers.filter(
                      (customer) => customer.id !== id
                    );

                    patchState(store, {
                      customers: filteredCustomers,
                      selectedCustomer:
                        store.selectedCustomer()?.id === id
                          ? null
                          : store.selectedCustomer(),
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante la disattivazione del cliente',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante la disattivazione del cliente'
                    );
                  },
                })
              );
          })
        )
      ),

      // Metodo per selezionare un cliente
      selectCustomer: (customer: Customer) => {
        patchState(store, { selectedCustomer: customer });
      },

      // Metodo per deselezionare un cliente
      clearSelectedCustomer: () => {
        patchState(store, { selectedCustomer: null });
      },

      // Metodo per eliminare gli errori
      clearErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    // Non carichiamo automaticamente all'inizializzazione perché richiede un progetto selezionato
    onInit(store) {},
  })
);
