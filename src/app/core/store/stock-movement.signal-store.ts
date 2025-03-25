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
  StockMovement,
  StockMovementDetail,
  ProductBalance,
  WarehouseBalance,
  CreateMovementFromInvoiceDto,
  InboundMovementDto,
  OutboundMovementDto,
  InventoryCheckDto,
  TransferMovementDto,
  UpdateMovementStatusDto,
} from '../models/stock-movement.model';
import { StockMovementService } from '../services/api/local/stock-movement.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, tap, Observable, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface StockMovementState {
  movements: StockMovement[] | null;
  selectedMovement: StockMovement | null;
  movementDetails: StockMovementDetail[] | null;
  warehouseBalance: WarehouseBalance | null;
  productBalances: ProductBalance[] | null;
  loading: boolean;
  error: string | null;
}

const initialState: StockMovementState = {
  movements: null,
  selectedMovement: null,
  movementDetails: null,
  warehouseBalance: null,
  productBalances: null,
  loading: false,
  error: null,
};

export const StockMovementStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ movements, selectedMovement }) => ({
    // Computed property per filtrare i movimenti per tipo
    movementsByType: computed(() => {
      const allMovements = movements();
      if (!allMovements) return {};

      // Raggruppa i movimenti per tipo
      return allMovements.reduce((acc, movement) => {
        const type = movement.movementType;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(movement);
        return acc;
      }, {} as Record<string, StockMovement[]>);
    }),

    // Computed property che indica se il movimento selezionato può essere modificato
    canEditSelected: computed(() => {
      const movement = selectedMovement();
      return movement ? movement.status === 'draft' : false;
    }),

    // Computed property che indica se il movimento selezionato può essere cancellato
    canDeleteSelected: computed(() => {
      const movement = selectedMovement();
      return movement ? movement.status !== 'confirmed' : false;
    }),
  })),

  withMethods(
    (
      store,
      stockMovementService = inject(StockMovementService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => {
      // Create a variable to store the instance reference for use inside rxMethods
      const instance = {
        // Utility method for finding a movement by ID
        getMovementById(id: string) {
          const movements = store.movements();
          return movements ? movements.find((m) => m.id === id) : null;
        },

        // Fetch warehouse balance method (referenced from other methods)
        fetchWarehouseBalance: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) =>
              stockMovementService
                .getWarehouseBalance(projectId, warehouseId)
                .pipe(
                  tapResponse({
                    next: (balance: WarehouseBalance) => {
                      patchState(store, {
                        warehouseBalance: balance,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nel recupero del saldo magazzino'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nel recupero del saldo magazzino',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Create movement from invoice with correct reference to fetchWarehouseBalance
        createMovementFromInvoice: rxMethod<{
          projectId: string;
          invoiceId: string;
          warehouseId: string;
          data: CreateMovementFromInvoiceDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoiceId, warehouseId, data }) =>
              stockMovementService
                .createMovementFromInvoice(
                  projectId,
                  invoiceId,
                  warehouseId,
                  data
                )
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      const currentMovements = store.movements() || [];

                      patchState(store, {
                        movements: [...currentMovements, movement],
                        selectedMovement: movement,
                        loading: false,
                        error: null,
                      });

                      toastService.showSuccess('Movimento creato con successo');

                      // Aggiorna automaticamente il saldo del magazzino
                      instance.fetchWarehouseBalance({
                        projectId,
                        warehouseId,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella creazione del movimento'
                      );
                      patchState(store, {
                        loading: false,
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

        // Recupera movimenti per fattura
        fetchInvoiceMovements: rxMethod<{
          projectId: string;
          invoiceId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, invoiceId }) =>
              stockMovementService
                .getInvoiceMovements(projectId, invoiceId)
                .pipe(
                  tapResponse({
                    next: (movements: StockMovement[]) => {
                      patchState(store, {
                        movements: movements,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nel recupero dei movimenti della fattura'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nel recupero dei movimenti',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Registra l'ingresso di prodotti in magazzino
        createInboundMovement: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: InboundMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, data }) =>
              stockMovementService
                .createInboundMovement(projectId, warehouseId, data)
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      const currentMovements = store.movements() || [];

                      patchState(store, {
                        movements: [...currentMovements, movement],
                        selectedMovement: movement,
                        loading: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Carico prodotti registrato con successo'
                      );

                      // Aggiorna automaticamente il saldo del magazzino
                      instance.fetchWarehouseBalance({
                        projectId,
                        warehouseId,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella creazione del movimento di carico'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nella creazione del movimento di carico',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Registra l'uscita di prodotti dal magazzino
        createOutboundMovement: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: OutboundMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, data }) =>
              stockMovementService
                .createOutboundMovement(projectId, warehouseId, data)
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      const currentMovements = store.movements() || [];

                      patchState(store, {
                        movements: [...currentMovements, movement],
                        selectedMovement: movement,
                        loading: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Scarico prodotti registrato con successo'
                      );

                      // Aggiorna automaticamente il saldo del magazzino
                      instance.fetchWarehouseBalance({
                        projectId,
                        warehouseId,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella creazione del movimento di scarico'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nella creazione del movimento di scarico',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Crea un movimento di rettifica inventario
        createInventoryCheck: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: InventoryCheckDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, data }) =>
              stockMovementService
                .createInventoryCheck(projectId, warehouseId, data)
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      const currentMovements = store.movements() || [];

                      patchState(store, {
                        movements: [...currentMovements, movement],
                        selectedMovement: movement,
                        loading: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Rettifica inventario registrata con successo'
                      );

                      // Aggiorna automaticamente il saldo del magazzino
                      instance.fetchWarehouseBalance({
                        projectId,
                        warehouseId,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella registrazione della rettifica inventario'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nella registrazione della rettifica inventario',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Trasferisce prodotti da un magazzino a un altro
        createTransferMovement: rxMethod<{
          projectId: string;
          data: TransferMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, data }) =>
              stockMovementService.createTransferMovement(projectId, data).pipe(
                tapResponse({
                  next: (movement: StockMovement) => {
                    const currentMovements = store.movements() || [];

                    patchState(store, {
                      movements: [...currentMovements, movement],
                      selectedMovement: movement,
                      loading: false,
                      error: null,
                    });

                    toastService.showSuccess(
                      'Trasferimento prodotti registrato con successo'
                    );

                    // Aggiorna automaticamente i saldi di entrambi i magazzini
                    instance.fetchWarehouseBalance({
                      projectId,
                      warehouseId: data.sourceWarehouseId,
                    });
                    instance.fetchWarehouseBalance({
                      projectId,
                      warehouseId: data.targetWarehouseId,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      'Errore nella registrazione del trasferimento'
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore nella registrazione del trasferimento',
                    });
                  },
                })
              )
            )
          )
        ),



        // Recupera il saldo di un prodotto specifico
        fetchProductBalance: rxMethod<{
          projectId: string;
          warehouseId: string;
          rawProductId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, rawProductId }) =>
              stockMovementService
                .getProductBalance(projectId, warehouseId, rawProductId)
                .pipe(
                  tapResponse({
                    next: (balance: ProductBalance) => {
                      // Aggiungi il nuovo saldo prodotto alla lista esistente
                      const currentBalances = store.productBalances() || [];
                      const balanceIndex = currentBalances.findIndex(
                        (b) =>
                          b.warehouseId === warehouseId &&
                          b.rawProductId === rawProductId
                      );

                      let updatedBalances = [...currentBalances];

                      if (balanceIndex >= 0) {
                        updatedBalances[balanceIndex] = balance;
                      } else {
                        updatedBalances.push(balance);
                      }

                      patchState(store, {
                        productBalances: updatedBalances,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nel recupero del saldo prodotto'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nel recupero del saldo prodotto',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Recupera tutti i movimenti del progetto
        fetchProjectMovements: rxMethod<{
          projectId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId }) => {
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? stockMovementService.getAdminProjectMovements(projectId)
                  : stockMovementService.getProjectMovements(projectId);

              return request.pipe(
                tapResponse({
                  next: (movements: StockMovement[]) => {
                    patchState(store, {
                      movements: movements,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError('Errore nel recupero dei movimenti');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore nel recupero dei movimenti',
                    });
                  },
                })
              );
            })
          )
        ),

        // Recupera i movimenti di un magazzino specifico
        fetchWarehouseMovements: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) =>
              stockMovementService
                .getWarehouseMovements(projectId, warehouseId)
                .pipe(
                  tapResponse({
                    next: (movements: StockMovement[]) => {
                      patchState(store, {
                        movements: movements,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nel recupero dei movimenti del magazzino'
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Errore nel recupero dei movimenti del magazzino',
                      });
                    },
                  })
                )
            )
          )
        ),

        // Recupera un movimento specifico
        fetchMovement: rxMethod<{
          projectId: string;
          id: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, id }) => {
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? stockMovementService.getAdminMovement(projectId, id)
                  : stockMovementService.getMovement(projectId, id);

              return request.pipe(
                tapResponse({
                  next: (movement: StockMovement) => {
                    patchState(store, {
                      selectedMovement: movement,
                      loading: false,
                      error: null,
                    });

                    // Aggiorna anche la lista dei movimenti se presente
                    const currentMovements = store.movements();
                    if (currentMovements) {
                      const index = currentMovements.findIndex(
                        (m) => m.id === id
                      );
                      if (index >= 0) {
                        const updatedMovements = [...currentMovements];
                        updatedMovements[index] = movement;
                        patchState(store, { movements: updatedMovements });
                      }
                    }
                  },
                  error: (error: unknown) => {
                    toastService.showError('Errore nel recupero del movimento');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore nel recupero del movimento',
                    });
                  },
                })
              );
            })
          )
        ),

        // Recupera i dettagli di un movimento
        fetchMovementDetails: rxMethod<{
          projectId: string;
          id: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, id }) =>
              stockMovementService.getMovementDetails(projectId, id).pipe(
                tapResponse({
                  next: (details: StockMovementDetail[]) => {
                    patchState(store, {
                      movementDetails: details,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      'Errore nel recupero dei dettagli del movimento'
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore nel recupero dei dettagli del movimento',
                    });
                  },
                })
              )
            )
          )
        ),

        // Elimina un movimento
        deleteMovement: rxMethod<{
          projectId: string;
          id: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, id }) =>
              stockMovementService.deleteMovement(projectId, id).pipe(
                tapResponse({
                  next: () => {
                    toastService.showSuccess(
                      'Movimento eliminato con successo'
                    );

                    // Rimuovi il movimento dalla lista
                    const currentMovements = store.movements();
                    if (currentMovements) {
                      const updatedMovements = currentMovements.filter(
                        (m) => m.id !== id
                      );
                      patchState(store, { movements: updatedMovements });
                    }

                    // Se era selezionato, resetta la selezione
                    if (store.selectedMovement()?.id === id) {
                      patchState(store, {
                        selectedMovement: null,
                        movementDetails: null,
                      });
                    }

                    patchState(store, {
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      "Errore nell'eliminazione del movimento"
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore nell'eliminazione del movimento",
                    });
                  },
                })
              )
            )
          )
        ),

        // Aggiorna lo stato di un movimento
        updateMovementStatus: rxMethod<{
          projectId: string;
          id: string;
          status: 'draft' | 'confirmed' | 'cancelled';
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, id, status }) =>
              stockMovementService
                .updateMovementStatus(projectId, id, { status })
                .pipe(
                  tapResponse({
                    next: (movement: StockMovement) => {
                      toastService.showSuccess(
                        `Stato del movimento aggiornato a ${status}`
                      );

                      // Aggiorna il movimento nella lista se presente
                      const currentMovements = store.movements();
                      if (currentMovements) {
                        const index = currentMovements.findIndex(
                          (m) => m.id === id
                        );
                        if (index >= 0) {
                          const updatedMovements = [...currentMovements];
                          updatedMovements[index] = movement;
                          patchState(store, { movements: updatedMovements });
                        }
                      }

                      // Se era selezionato, aggiorna anche quello
                      if (store.selectedMovement()?.id === id) {
                        patchState(store, { selectedMovement: movement });
                      }

                      patchState(store, {
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        "Errore nell'aggiornamento dello stato del movimento"
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          "Errore nell'aggiornamento dello stato del movimento",
                      });
                    },
                  })
                )
            )
          )
        ),

        // Seleziona un movimento specifico
        selectMovement(movement: StockMovement | null) {
          patchState(store, { selectedMovement: movement });

          // Se è stato selezionato un movimento, carica anche i suoi dettagli
          if (movement) {
            const projectId = movement.projectId;
            instance.fetchMovementDetails({ projectId, id: movement.id });
          } else {
            patchState(store, { movementDetails: null });
          }
        },

        // Pulisci gli errori
        clearErrors() {
          patchState(store, { error: null });
        },

        // Reset completo dello stato
        resetState() {
          patchState(store, {
            movements: null,
            selectedMovement: null,
            movementDetails: null,
            warehouseBalance: null,
            productBalances: null,
            loading: false,
            error: null,
          });
        },
      };

      // Return the instance containing all methods
      return instance;
    }
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo automaticamente i dati all'inizializzazione
      // perché saranno richiesti in contesti diversi (per progetto, per magazzino, ecc.)
    },
  })
);
