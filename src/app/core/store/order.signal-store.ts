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
  Order,
  OrderSearchFilters,
  CreateTableOrderDto,
  CreatePreOrderDto,
} from '../models/order.model';
import { OrderService } from '../services/api/local/order.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

/**
 * Stato per gli ordini
 */
export interface OrderState {
  // Collezioni di ordini
  partnerOrders: Order[] | null;
  customerOrders: Order[] | null;

  // Ordine selezionato
  selectedOrder: Order | null;

  // Flag di caricamento e errori
  loading: boolean;
  error: string | null;
}

/**
 * Stato iniziale
 */
const initialState: OrderState = {
  partnerOrders: null,
  customerOrders: null,
  selectedOrder: null,
  loading: false,
  error: null,
};

/**
 * Signal Store per gli ordini
 */
export const OrderStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ partnerOrders }) => {
    // Definiamo prima gli ordini pendenti
    const pendingOrdersSignal = computed(() => {
      if (!partnerOrders()) return null;
      return partnerOrders()?.filter(
        (order) => order.status === 'pending' || order.status === 'confirmed'
      );
    });

    // Poi possiamo utilizzarlo in modo sicuro per il conteggio
    return {
      // Ordini pendenti che richiedono attenzione
      pendingOrders: pendingOrdersSignal,

      // Conta degli ordini pendenti
      pendingOrdersCount: computed(() => {
        const orders = pendingOrdersSignal();
        return orders ? orders.length : 0;
      }),

      // Ordini raggruppati per tipo
      tableOrders: computed(() => {
        if (!partnerOrders()) return null;
        return partnerOrders()?.filter((order) => order.type === 'table');
      }),

      preOrders: computed(() => {
        if (!partnerOrders()) return null;
        return partnerOrders()?.filter((order) => order.type === 'preorder');
      }),
    };
  }),

  withMethods(
    (
      store,
      orderService = inject(OrderService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      /**
       * Recupera gli ordini del partner per un progetto specifico
       */
      fetchPartnerOrders: rxMethod<{
        projectId?: string;
        filters?: OrderSearchFilters;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, filters }) => {
            let targetProjectId = projectId;

            if (!targetProjectId) {
              const selectedProject = projectStore.selectedProject();
              if (!selectedProject) {
                toastService.showError('Nessun progetto selezionato');
                patchState(store, { loading: false });
                return EMPTY;
              }
              targetProjectId = selectedProject.id;
            }

            return orderService.getPartnerOrders(targetProjectId, filters).pipe(
              tapResponse({
                next: (response) => {
                  patchState(store, {
                    partnerOrders: response.orders,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero degli ordini',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero degli ordini'
                  );
                },
              })
            );
          })
        )
      ),

      /**
       * Recupera gli ordini del cliente autenticato
       */
      fetchCustomerOrders: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            if (!authService.isAuthenticated()) {
              toastService.showError('Utente non autenticato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return orderService.getCustomerOrders().pipe(
              tapResponse({
                next: (response) => {
                  patchState(store, {
                    customerOrders: response.orders,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero degli ordini cliente',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero degli ordini cliente'
                  );
                },
              })
            );
          })
        )
      ),

      /**
       * Recupera i dettagli di un ordine specifico
       */
      getOrderDetails: rxMethod<{ orderId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ orderId }) => {
            return orderService.getOrderDetails(orderId).pipe(
              tapResponse({
                next: (order) => {
                  patchState(store, {
                    selectedOrder: order,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei dettagli ordine',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei dettagli ordine'
                  );
                },
              })
            );
          })
        )
      ),

      /**
       * Aggiorna lo stato di un ordine
       */
      updateOrderStatus: rxMethod<{ orderId: string; status: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ orderId, status }) => {
            return orderService.updateOrderStatus(orderId, status).pipe(
              tapResponse({
                next: (updatedOrder) => {
                  // Aggiorna l'ordine selezionato se è quello che è stato modificato
                  if (store.selectedOrder()?.id === orderId) {
                    patchState(store, { selectedOrder: updatedOrder });
                  }

                  // Aggiorna anche l'ordine nella lista degli ordini del partner
                  const partnerOrders = store.partnerOrders();
                  if (partnerOrders) {
                    const updatedOrders = partnerOrders.map((order) =>
                      order.id === orderId ? updatedOrder : order
                    );
                    patchState(store, { partnerOrders: updatedOrders });
                  }

                  patchState(store, { loading: false, error: null });
                  toastService.showSuccess(
                    "Stato dell'ordine aggiornato con successo"
                  );
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'aggiornamento dello stato ordine",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'aggiornamento dello stato ordine"
                  );
                },
              })
            );
          })
        )
      ),

      /**
       * Crea un nuovo ordine da tavolo
       */
      createTableOrder: rxMethod<{
        projectId: string;
        tableOrderData: CreateTableOrderDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, tableOrderData }) => {
            return orderService
              .createTableOrder(projectId, tableOrderData)
              .pipe(
                tapResponse({
                  next: (response) => {
                    patchState(store, { loading: false, error: null });
                    toastService.showSuccess('Ordine inviato con successo');

                    return response;
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante la creazione dell'ordine",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante la creazione dell'ordine"
                    );
                  },
                })
              );
          })
        )
      ),

      /**
       * Crea un nuovo preordine (ritiro o consegna)
       */
      createPreOrder: rxMethod<{
        projectId: string;
        preOrderData: CreatePreOrderDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, preOrderData }) => {
            return orderService.createPreOrder(projectId, preOrderData).pipe(
              tapResponse({
                next: (response) => {
                  patchState(store, { loading: false, error: null });
                  toastService.showSuccess('Preordine creato con successo');

                  return response;
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante la creazione del preordine',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante la creazione del preordine'
                  );
                },
              })
            );
          })
        )
      ),

      /**
       * Seleziona un ordine per visualizzarne i dettagli
       */
      selectOrder: (order: Order) => {
        patchState(store, { selectedOrder: order });
      },

      /**
       * Deseleziona l'ordine corrente
       */
      clearSelectedOrder: () => {
        patchState(store, { selectedOrder: null });
      },

      /**
       * Pulisce gli errori
       */
      clearErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    /**
     * Inizializzazione: non carichiamo ordini automaticamente
     * poiché necessitiamo di un progetto selezionato
     */
    onInit(store) {
      // Non effettuiamo alcuna operazione all'inizializzazione
    },
  })
);
