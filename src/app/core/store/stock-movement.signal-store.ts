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
  WarehouseBalance,
  InboundMovementDto,
  OutboundMovementDto,
  InventoryCheckDto,
  TransferMovementDto,
  UpdateMovementStatusDto,
  StockMovementType,
  MovementStatus,
  AssignInvoiceToCostCenterResponse,
} from '../models/stock-movement.model';
import { StockMovementService } from '../services/api/local/stock-movement.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface StockMovementState {
  movements: StockMovement[] | null;
  selectedMovement: StockMovement | null;
  movementDetails: StockMovementDetail[] | null;
  loading: boolean;
  processing: boolean;
  error: string | null;
}

const initialState: StockMovementState = {
  movements: null,
  selectedMovement: null,
  movementDetails: null,
  loading: false,
  processing: false,
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

    // Computed property per filtrare i movimenti per stato
    movementsByStatus: computed(() => {
      const allMovements = movements();
      if (!allMovements) return {};

      // Raggruppa i movimenti per stato
      return allMovements.reduce((acc, movement) => {
        const status = movement.status || 'draft';
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(movement);
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
      authService = inject(AuthService),
      toastService = inject(ToastService)
    ) => {
      // Create a variable to store the instance reference for use inside rxMethods
      const instance = {
        // Utility method for finding a movement by ID
        getMovementById(id: string): StockMovement | null {
          const movements = store.movements();
          return movements ? movements.find((m) => m.id === id) || null : null;
        },

        // 1. Operazioni con Fatture - RIMOSSE E SPOSTATE IN EINVOICE STORE

        // 2. Operazioni Magazzino

        // Create inbound movement
        createInboundMovement: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: InboundMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
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
                        processing: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Carico prodotti registrato con successo'
                      );
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella creazione del movimento di carico'
                      );
                      patchState(store, {
                        processing: false,
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

        // Create outbound movement
        createOutboundMovement: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: OutboundMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
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
                        processing: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Scarico prodotti registrato con successo'
                      );
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella creazione del movimento di scarico'
                      );
                      patchState(store, {
                        processing: false,
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

        // Create inventory check
        createInventoryCheck: rxMethod<{
          projectId: string;
          warehouseId: string;
          data: InventoryCheckDto;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
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
                        processing: false,
                        error: null,
                      });

                      toastService.showSuccess(
                        'Rettifica inventario registrata con successo'
                      );
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        'Errore nella registrazione della rettifica inventario'
                      );
                      patchState(store, {
                        processing: false,
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

        // Create transfer movement
        createTransferMovement: rxMethod<{
          projectId: string;
          data: TransferMovementDto;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
            switchMap(({ projectId, data }) =>
              stockMovementService.createTransferMovement(projectId, data).pipe(
                tapResponse({
                  next: (movement: StockMovement) => {
                    const currentMovements = store.movements() || [];

                    patchState(store, {
                      movements: [...currentMovements, movement],
                      selectedMovement: movement,
                      processing: false,
                      error: null,
                    });

                    toastService.showSuccess(
                      'Trasferimento prodotti registrato con successo'
                    );
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      'Errore nella registrazione del trasferimento'
                    );
                    patchState(store, {
                      processing: false,
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

        // 3. Recupero Movimenti

        // Fetch project movements
        fetchProjectMovements: rxMethod<{
          projectId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId }) => {
              return stockMovementService.getProjectMovements(projectId).pipe(
                tapResponse({
                  next: (movements: StockMovement[]) => {
                    patchState(store, {
                      movements,
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

        // Fetch warehouse movements
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
                        movements,
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

        // Fetch movement
        fetchMovement: rxMethod<{
          projectId: string;
          id: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, id }) => {
              return stockMovementService.getMovement(projectId, id).pipe(
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

        // Fetch movement details
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

        // 4. Gestione Movimenti

        // Delete movement
        deleteMovement: rxMethod<{
          projectId: string;
          id: string;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
            switchMap(({ projectId, id }) => {
              return stockMovementService.deleteMovement(projectId, id).pipe(
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
                      processing: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      "Errore nell'eliminazione del movimento"
                    );
                    patchState(store, {
                      processing: false,
                      error:
                        (error as Error)?.message ||
                        "Errore nell'eliminazione del movimento",
                    });
                  },
                })
              );
            })
          )
        ),

        // Update movement status
        updateMovementStatus: rxMethod<{
          projectId: string;
          id: string;
          status: MovementStatus;
        }>(
          pipe(
            tap(() => patchState(store, { processing: true, error: null })),
            switchMap(({ projectId, id, status }) => {
              return stockMovementService
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
                        processing: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        "Errore nell'aggiornamento dello stato del movimento"
                      );
                      patchState(store, {
                        processing: false,
                        error:
                          (error as Error)?.message ||
                          "Errore nell'aggiornamento dello stato del movimento",
                      });
                    },
                  })
                );
            })
          )
        ),

        // Filter movements by type
        filterMovementsByType(
          type: StockMovementType | StockMovementType[] | null
        ): StockMovement[] {
          const allMovements = store.movements();
          if (!allMovements) return [];

          if (!type) return allMovements;

          const types = Array.isArray(type) ? type : [type];
          return allMovements.filter((movement) =>
            types.includes(movement.movementType)
          );
        },

        // Filter movements by status
        filterMovementsByStatus(
          status: MovementStatus | MovementStatus[] | null
        ): StockMovement[] {
          const allMovements = store.movements();
          if (!allMovements) return [];

          if (!status) return allMovements;

          const statuses = Array.isArray(status) ? status : [status];
          return allMovements.filter((movement) =>
            statuses.includes(movement.status as MovementStatus)
          );
        },

        // Select movement
        selectMovement(movement: StockMovement | null) {
          patchState(store, { selectedMovement: movement });

          // Se è stato selezionato un movimento, carica anche i suoi dettagli
          if (movement && movement.id && movement.projectId) {
            const projectId = movement.projectId;
            instance.fetchMovementDetails({ projectId, id: movement.id });
          } else {
            patchState(store, { movementDetails: null });
          }
        },

        // Clear errors
        clearErrors() {
          patchState(store, { error: null });
        },

        // Reset state
        resetState() {
          patchState(store, initialState);
        },
      };

      return instance;
    }
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo automaticamente i dati all'inizializzazione
    },
  })
);
