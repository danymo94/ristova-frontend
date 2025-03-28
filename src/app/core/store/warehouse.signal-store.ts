import { computed, inject, signal } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  Warehouse,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseType,
  WarehouseBalance,
  WarehouseInventory,
  WarehouseStats,
  WarehouseProductInventory,
  WarehouseMovementSummary,
} from '../models/warehouse.model';
import { WarehouseService } from '../services/api/local/warehouse.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, of, Observable } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

/**
 * Filtri per i warehouse
 */
export interface WarehouseFilters {
  type?: WarehouseType;
  search?: string;
  isActive?: boolean;
}

/**
 * Stato dello store warehouse
 */
export interface WarehouseState {
  // Dati principali
  warehouses: Warehouse[] | null;
  filteredWarehouses: Warehouse[] | null;
  selectedWarehouse: Warehouse | null;

  // Dati aggiuntivi per il warehouse selezionato
  selectedWarehouseStats: WarehouseStats | null;
  selectedWarehouseInventory: WarehouseInventory | null;
  selectedWarehouseMovements: WarehouseMovementSummary | null;

  // Filtri attivi
  filters: WarehouseFilters;

  // Stato dell'interfaccia
  loading: boolean;
  error: string | null;
}

/**
 * Stato iniziale
 */
const initialState: WarehouseState = {
  warehouses: null,
  filteredWarehouses: null,
  selectedWarehouse: null,
  selectedWarehouseStats: null,
  selectedWarehouseInventory: null,
  selectedWarehouseMovements: null,
  filters: {},
  loading: false,
  error: null,
};

export const WarehouseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(
    ({ warehouses, filteredWarehouses, filters, selectedWarehouse }) => ({
      /**
       * Conteggio totale dei warehouse
       */
      warehousesCount: computed(() => {
        const whs = warehouses();
        return whs ? whs.length : 0;
      }),

      /**
       * Conteggio dei warehouse filtrati
       */
      filteredCount: computed(() => {
        const filtered = filteredWarehouses();
        return filtered ? filtered.length : 0;
      }),

      /**
       * Elenco dei soli warehouse di tipo fisico
       */
      physicalWarehouses: computed(() => {
        const whs = warehouses();
        return whs ? whs.filter((w) => w.type === 'PHYSICAL') : [];
      }),

      /**
       * Elenco dei soli centri di costo
       */
      costCenters: computed(() => {
        const whs = warehouses();
        return whs ? whs.filter((w) => w.type === 'COST_CENTER') : [];
      }),

      /**
       * Indica se ci sono filtri attivi
       */
      hasActiveFilters: computed(() => {
        const currentFilters = filters();
        return (
          Object.keys(currentFilters).length > 0 &&
          Object.values(currentFilters).some((val) => val !== undefined)
        );
      }),

      /**
       * Indica se il warehouse selezionato è di tipo fisico
       */
      isSelectedWarehousePhysical: computed(() => {
        const selected = selectedWarehouse();
        return selected ? selected.type === 'PHYSICAL' : false;
      }),

      /**
       * Indica se il warehouse selezionato è un centro di costo
       */
      isSelectedWarehouseCostCenter: computed(() => {
        const selected = selectedWarehouse();
        return selected ? selected.type === 'COST_CENTER' : false;
      }),

      /**
       * Indica se il warehouse selezionato è attivo
       */
      isSelectedWarehouseActive: computed(() => {
        const selected = selectedWarehouse();
        return selected ? selected.isActive : false;
      }),
    })
  ),

  withMethods(
    (
      store,
      warehouseService = inject(WarehouseService),
      authService = inject(AuthService),
      toastService = inject(ToastService)
    ) => {
      /**
       * Funzione privata per l'applicazione dei filtri
       */
      function applyFilters(filters: WarehouseFilters) {
        const warehouses = store.warehouses();
        if (!warehouses) return;

        let result = [...warehouses];

        // Filtro per tipo
        if (filters.type) {
          result = result.filter((w) => w.type === filters.type);
        }

        // Filtro per termine di ricerca
        if (filters.search && filters.search.trim() !== '') {
          const search = filters.search.toLowerCase().trim();
          result = result.filter(
            (w) =>
              w.name.toLowerCase().includes(search) ||
              (w.description && w.description.toLowerCase().includes(search))
          );
        }

        // Filtro per stato attivo
        if (filters.isActive !== undefined) {
          result = result.filter((w) => w.isActive === filters.isActive);
        }

        patchState(store, { filteredWarehouses: result });
      }

      return {
        /**
         * Recupera tutti i warehouse di un progetto
         */
        fetchWarehouses: rxMethod<{
          projectId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId }) => {
              const role = authService.userRole();
              // Impostiamo withStats=true per avere sempre le statistiche di base
              const options = { withStats: true };

              const request =
                role === 'admin'
                  ? warehouseService.getAdminProjectWarehouses(
                      projectId,
                      options
                    )
                  : warehouseService.getPartnerProjectWarehouses(
                      projectId,
                      options
                    );

              return request.pipe(
                tapResponse({
                  next: (warehouses) => {
                    patchState(store, {
                      warehouses,
                      filteredWarehouses: warehouses,
                      loading: false,
                      error: null,
                    });

                    // Riapplica i filtri correnti se presenti
                    if (Object.keys(store.filters()).length > 0) {
                      applyFilters(store.filters());
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to fetch warehouses',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore nel caricamento dei magazzini'
                    );
                  },
                })
              );
            })
          )
        ),

        /**
         * Recupera i warehouse filtrati per tipo
         */
        fetchWarehousesByType: rxMethod<{
          projectId: string;
          type: WarehouseType;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            tap(({ type }) =>
              patchState(store, { filters: { ...store.filters(), type } })
            ),
            switchMap(({ projectId, type }) => {
              const role = authService.userRole();
              const options = { type, withStats: true };

              const request =
                role === 'admin'
                  ? warehouseService.getAdminProjectWarehouses(
                      projectId,
                      options
                    )
                  : warehouseService.getPartnerProjectWarehouses(
                      projectId,
                      options
                    );

              return request.pipe(
                tapResponse({
                  next: (warehouses) => {
                    patchState(store, {
                      warehouses,
                      filteredWarehouses: warehouses,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to fetch warehouses',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore nel caricamento dei magazzini'
                    );
                  },
                })
              );
            })
          )
        ),

        /**
         * Recupera i dettagli completi di un warehouse specifico
         */
        fetchWarehouseDetails: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) => {
              const role = authService.userRole();
              // Otteniamo il warehouse con statistiche di base
              const request =
                role === 'admin'
                  ? warehouseService.getAdminWarehouse(
                      projectId,
                      warehouseId,
                      true
                    )
                  : warehouseService.getPartnerWarehouse(
                      projectId,
                      warehouseId,
                      true
                    );

              return request.pipe(
                tapResponse({
                  next: (warehouse) => {
                    patchState(store, {
                      selectedWarehouse: warehouse,
                      loading: false,
                      error: null,
                    });

                    // Aggiorniamo anche il warehouse nella lista se è presente
                    const currentWarehouses = store.warehouses();
                    if (currentWarehouses) {
                      const updatedWarehouses = currentWarehouses.map((w) =>
                        w.id === warehouseId ? warehouse : w
                      );
                      patchState(store, { warehouses: updatedWarehouses });

                      // Riapplica i filtri se necessario
                      if (Object.keys(store.filters()).length > 0) {
                        applyFilters(store.filters());
                      }
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to fetch warehouse',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore nel caricamento del magazzino'
                    );
                  },
                })
              );
            })
          )
        ),

        /**
         * Carica le statistiche dettagliate di un warehouse
         */
        fetchWarehouseStats: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) => {
              return warehouseService
                .getWarehouseStats(projectId, warehouseId)
                .pipe(
                  tapResponse({
                    next: (stats) => {
                      patchState(store, {
                        selectedWarehouseStats: stats,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to fetch warehouse stats',
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          'Errore nel caricamento delle statistiche'
                      );
                    },
                  })
                );
            })
          )
        ),

        /**
         * Carica l'inventario di un warehouse fisico
         */
        fetchWarehouseInventory: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) => {
              // Verifica se il warehouse corrente è di tipo fisico
              const currentWarehouse = store.selectedWarehouse();
              if (currentWarehouse && currentWarehouse.type !== 'PHYSICAL') {
                toastService.showWarn(
                  "L'inventario è disponibile solo per magazzini fisici"
                );
                patchState(store, { loading: false });
                return of(null);
              }

              return warehouseService
                .getWarehouseInventory(projectId, warehouseId)
                .pipe(
                  tapResponse({
                    next: (inventory) => {
                      patchState(store, {
                        selectedWarehouseInventory: inventory,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to fetch warehouse inventory',
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          "Errore nel caricamento dell'inventario"
                      );
                    },
                  })
                );
            })
          )
        ),

        /**
         * Carica il riepilogo dei movimenti di un warehouse
         */
        fetchWarehouseMovementSummary: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) => {
              return warehouseService
                .getWarehouseMovementSummary(projectId, warehouseId)
                .pipe(
                  tapResponse({
                    next: (summary) => {
                      patchState(store, {
                        selectedWarehouseMovements: summary,
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to fetch movement summary',
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          'Errore nel caricamento dei movimenti'
                      );
                    },
                  })
                );
            })
          )
        ),

        /**
         * Carica i dettagli di inventario di un prodotto specifico
         */
        fetchProductInventory: rxMethod<{
          projectId: string;
          warehouseId: string;
          rawProductId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, rawProductId }) => {
              // Verifica se il warehouse corrente è di tipo fisico
              const currentWarehouse = store.selectedWarehouse();
              if (currentWarehouse && currentWarehouse.type !== 'PHYSICAL') {
                toastService.showWarn(
                  "L'inventario prodotto è disponibile solo per magazzini fisici"
                );
                patchState(store, { loading: false });
                return of(null);
              }

              return warehouseService
                .getWarehouseProductInventory(
                  projectId,
                  warehouseId,
                  rawProductId
                )
                .pipe(
                  tapResponse({
                    next: (productInventory) => {
                      // Aggiorniamo l'inventario nel modo più efficiente possibile
                      const currentInventory =
                        store.selectedWarehouseInventory();
                      if (currentInventory) {
                        const updatedProducts = currentInventory.products.map(
                          (p) =>
                            p.rawProductId === rawProductId
                              ? {
                                  ...p,
                                  quantity: productInventory.quantity,
                                  value: productInventory.value,
                                  avgCost: productInventory.avgCost,
                                }
                              : p
                        );

                        patchState(store, {
                          selectedWarehouseInventory: {
                            ...currentInventory,
                            products: updatedProducts,
                            lastUpdated: new Date().toISOString(),
                          },
                        });
                      }

                      patchState(store, {
                        loading: false,
                        error: null,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to fetch product inventory',
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          'Errore nel caricamento dei dati del prodotto'
                      );
                    },
                  })
                );
            })
          )
        ),

        /**
         * Crea un nuovo warehouse
         */
        createWarehouse: rxMethod<{
          projectId: string;
          warehouse: CreateWarehouseDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouse }) =>
              warehouseService.createWarehouse(projectId, warehouse).pipe(
                tapResponse({
                  next: (createdWarehouse) => {
                    toastService.showSuccess('Magazzino creato con successo');

                    // Aggiorniamo la lista dei warehouse
                    const currentWarehouses = store.warehouses() || [];
                    const updatedWarehouses = [
                      ...currentWarehouses,
                      createdWarehouse,
                    ];

                    patchState(store, {
                      warehouses: updatedWarehouses,
                      loading: false,
                      error: null,
                    });

                    // Riapplica i filtri se necessario
                    if (Object.keys(store.filters()).length > 0) {
                      applyFilters(store.filters());
                    } else {
                      patchState(store, {
                        filteredWarehouses: updatedWarehouses,
                      });
                    }
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore nella creazione del magazzino'
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to create warehouse',
                    });
                  },
                })
              )
            )
          )
        ),

        /**
         * Aggiorna un warehouse esistente
         */
        updateWarehouse: rxMethod<{
          projectId: string;
          warehouseId: string;
          warehouse: UpdateWarehouseDto;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, warehouse }) =>
              warehouseService
                .updateWarehouse(projectId, warehouseId, warehouse)
                .pipe(
                  tapResponse({
                    next: (updatedWarehouse) => {
                      toastService.showSuccess(
                        'Magazzino aggiornato con successo'
                      );

                      // Aggiorniamo la lista dei warehouse
                      const currentWarehouses = store.warehouses();
                      if (currentWarehouses) {
                        const updatedWarehouses = currentWarehouses.map((w) =>
                          w.id === warehouseId ? updatedWarehouse : w
                        );

                        patchState(store, {
                          warehouses: updatedWarehouses,
                          selectedWarehouse:
                            store.selectedWarehouse()?.id === warehouseId
                              ? updatedWarehouse
                              : store.selectedWarehouse(),
                          loading: false,
                          error: null,
                        });

                        // Riapplica i filtri se necessario
                        if (Object.keys(store.filters()).length > 0) {
                          applyFilters(store.filters());
                        } else {
                          patchState(store, {
                            filteredWarehouses: updatedWarehouses,
                          });
                        }
                      }
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        (error as Error)?.message ||
                          "Errore nell'aggiornamento del magazzino"
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to update warehouse',
                      });
                    },
                  })
                )
            )
          )
        ),

        /**
         * Elimina un warehouse
         */
        deleteWarehouse: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) =>
              warehouseService.deleteWarehouse(projectId, warehouseId).pipe(
                tapResponse({
                  next: () => {
                    toastService.showSuccess(
                      'Magazzino eliminato con successo'
                    );

                    // Aggiorniamo le liste rimuovendo il warehouse eliminato
                    const currentWarehouses = store.warehouses();
                    if (currentWarehouses) {
                      const updatedWarehouses = currentWarehouses.filter(
                        (w) => w.id !== warehouseId
                      );

                      patchState(store, {
                        warehouses: updatedWarehouses,
                        selectedWarehouse:
                          store.selectedWarehouse()?.id === warehouseId
                            ? null
                            : store.selectedWarehouse(),
                        loading: false,
                        error: null,
                      });

                      // Riapplica i filtri se necessario
                      if (Object.keys(store.filters()).length > 0) {
                        applyFilters(store.filters());
                      } else {
                        patchState(store, {
                          filteredWarehouses: updatedWarehouses,
                        });
                      }
                    }
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore nell'eliminazione del magazzino"
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to delete warehouse',
                    });
                  },
                })
              )
            )
          )
        ),

        /**
         * Aggiorna lo stato (attivo/inattivo) di un warehouse
         */
        updateWarehouseStatus: rxMethod<{
          projectId: string;
          warehouseId: string;
          isActive: boolean;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId, isActive }) =>
              warehouseService
                .updateWarehouseStatus(projectId, warehouseId, isActive)
                .pipe(
                  tapResponse({
                    next: (updatedWarehouse) => {
                      const statusMessage = isActive
                        ? 'attivato'
                        : 'disattivato';
                      toastService.showSuccess(
                        `Magazzino ${statusMessage} con successo`
                      );

                      // Aggiorniamo le liste
                      const currentWarehouses = store.warehouses();
                      if (currentWarehouses) {
                        const updatedWarehouses = currentWarehouses.map((w) =>
                          w.id === warehouseId ? updatedWarehouse : w
                        );

                        patchState(store, {
                          warehouses: updatedWarehouses,
                          selectedWarehouse:
                            store.selectedWarehouse()?.id === warehouseId
                              ? updatedWarehouse
                              : store.selectedWarehouse(),
                          loading: false,
                          error: null,
                        });

                        // Riapplica i filtri se necessario
                        if (Object.keys(store.filters()).length > 0) {
                          applyFilters(store.filters());
                        } else {
                          patchState(store, {
                            filteredWarehouses: updatedWarehouses,
                          });
                        }
                      }
                    },
                    error: (error: unknown) => {
                      toastService.showError(
                        (error as Error)?.message ||
                          "Errore nell'aggiornamento dello stato del magazzino"
                      );
                      patchState(store, {
                        loading: false,
                        error:
                          (error as Error)?.message ||
                          'Failed to update warehouse status',
                      });
                    },
                  })
                )
            )
          )
        ),

        /**
         * Carica tutti i dati per un warehouse selezionato
         */
        loadWarehouseCompleteDetails: rxMethod<{
          projectId: string;
          warehouseId: string;
        }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ projectId, warehouseId }) => {
              // Prima carichiamo i dettagli di base del warehouse
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? warehouseService.getAdminWarehouse(
                      projectId,
                      warehouseId,
                      true
                    )
                  : warehouseService.getPartnerWarehouse(
                      projectId,
                      warehouseId,
                      true
                    );

              return request.pipe(
                tapResponse({
                  next: (warehouse) => {
                    patchState(store, {
                      selectedWarehouse: warehouse,
                      loading: false,
                    });

                    // Aggiorniamo anche il warehouse nella lista se è presente
                    const currentWarehouses = store.warehouses();
                    if (currentWarehouses) {
                      const updatedWarehouses = currentWarehouses.map((w) =>
                        w.id === warehouseId ? warehouse : w
                      );
                      patchState(store, { warehouses: updatedWarehouses });

                      // Riapplica i filtri se necessario
                      if (Object.keys(store.filters()).length > 0) {
                        applyFilters(store.filters());
                      }
                    }

                    // Ora carichiamo le statistiche
                    warehouseService
                      .getWarehouseStats(projectId, warehouseId)
                      .pipe(
                        tapResponse({
                          next: (stats) => {
                            patchState(store, {
                              selectedWarehouseStats: stats,
                            });

                            // Se è un warehouse fisico, carichiamo anche l'inventario
                            if (warehouse && warehouse.type === 'PHYSICAL') {
                              warehouseService
                                .getWarehouseInventory(projectId, warehouseId)
                                .pipe(
                                  tapResponse({
                                    next: (inventory) => {
                                      patchState(store, {
                                        selectedWarehouseInventory: inventory,
                                      });

                                      // Infine carichiamo il riepilogo movimenti
                                      loadMovementSummary();
                                    },
                                    error: (error: unknown) => {
                                      toastService.showError(
                                        (error as Error)?.message ||
                                          "Errore nel caricamento dell'inventario"
                                      );
                                      // Anche se fallisce l'inventario, tentiamo di caricare i movimenti
                                      loadMovementSummary();
                                    },
                                  })
                                )
                                .subscribe();
                            } else {
                              // Se non è un warehouse fisico, carichiamo solo i movimenti
                              loadMovementSummary();
                            }
                          },
                          error: (error: unknown) => {
                            toastService.showError(
                              (error as Error)?.message ||
                                'Errore nel caricamento delle statistiche'
                            );
                          },
                        })
                      )
                      .subscribe();
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to fetch warehouse',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore nel caricamento del magazzino'
                    );
                  },
                })
              );

              // Funzione helper per caricare il riepilogo movimenti
              function loadMovementSummary() {
                warehouseService
                  .getWarehouseMovementSummary(projectId, warehouseId)
                  .pipe(
                    tapResponse({
                      next: (summary) => {
                        patchState(store, {
                          selectedWarehouseMovements: summary,
                          loading: false,
                        });
                      },
                      error: (error: unknown) => {
                        patchState(store, {
                          loading: false,
                          error:
                            (error as Error)?.message ||
                            'Failed to fetch movement summary',
                        });
                        toastService.showError(
                          (error as Error)?.message ||
                            'Errore nel caricamento dei movimenti'
                        );
                      },
                    })
                  )
                  .subscribe();
              }
            })
          )
        ),
        
        /**
         * Seleziona un warehouse come corrente
         */
        selectWarehouse(warehouse: Warehouse) {
          patchState(store, { selectedWarehouse: warehouse });
        },

        /**
         * Filtra i warehouse in base ai criteri specificati
         */
        setFilters(filters: WarehouseFilters) {
          patchState(store, { filters });
          applyFilters(filters);
        },

        /**
         * Filtra i warehouse per tipo
         */
        filterByType(type?: WarehouseType) {
          const currentFilters = store.filters();
          this.setFilters({ ...currentFilters, type });
        },

        /**
         * Filtra i warehouse per termine di ricerca
         */
        filterBySearch(search?: string) {
          const currentFilters = store.filters();
          this.setFilters({ ...currentFilters, search });
        },

        /**
         * Filtra i warehouse per stato attivo
         */
        filterByActiveStatus(isActive?: boolean) {
          const currentFilters = store.filters();
          this.setFilters({ ...currentFilters, isActive });
        },

        /**
         * Pulisce tutti i filtri
         */
        clearFilters() {
          patchState(store, { filters: {} });
          const warehouses = store.warehouses();
          patchState(store, { filteredWarehouses: warehouses });
        },

        /**
         * Ottiene un warehouse per ID
         */
        getWarehouseById(id: string): Warehouse | null {
          const warehouses = store.warehouses();
          if (!warehouses) return null;
          return warehouses.find((w) => w.id === id) || null;
        },

        /**
         * Pulisce lo stato del warehouse selezionato
         */
        clearSelectedWarehouse() {
          patchState(store, {
            selectedWarehouse: null,
            selectedWarehouseStats: null,
            selectedWarehouseInventory: null,
            selectedWarehouseMovements: null,
          });
        },

        /**
         * Pulisce gli errori
         */
        clearErrors() {
          patchState(store, { error: null });
        },
      };
    }
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo i warehouses automaticamente all'inizializzazione
      // perché potrebbero essere richiesti in contesti diversi (per progetto)
    },
  })
);
