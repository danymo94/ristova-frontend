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
  Warehouse,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseType,
} from '../models/warehouse.model';
import { WarehouseService } from '../services/api/local/warehouse.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY, Observable } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface WarehouseState {
  warehouses: Warehouse[] | null;
  filteredWarehouses: Warehouse[] | null;
  selectedWarehouse: Warehouse | null;
  loading: boolean;
  error: string | null;
}

const initialState: WarehouseState = {
  warehouses: null,
  filteredWarehouses: null,
  selectedWarehouse: null,
  loading: false,
  error: null,
};

export const WarehouseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      warehouseService = inject(WarehouseService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      // Utility method to get warehouse by ID
      getWarehouseById(id: string) {
        const currentWarehouses = store.warehouses();
        return currentWarehouses
          ? currentWarehouses.find((warehouse) => warehouse.id === id)
          : null;
      },

      // Filter warehouses by type
      filterByType(type?: WarehouseType) {
        const warehouses = store.warehouses();
        if (!warehouses) return;

        if (!type) {
          patchState(store, { filteredWarehouses: warehouses });
          return;
        }

        const filtered = warehouses.filter((w) => w.type === type);
        patchState(store, { filteredWarehouses: filtered });
      },

      // Filter warehouses by search term
      filterBySearch(search?: string) {
        const warehouses = store.warehouses();
        if (!warehouses) return;

        if (!search || search.trim() === '') {
          patchState(store, { filteredWarehouses: warehouses });
          return;
        }

        const searchLower = search.toLowerCase();
        const filtered = warehouses.filter(
          (w) =>
            w.name.toLowerCase().includes(searchLower) ||
            w.description?.toLowerCase().includes(searchLower)
        );
        patchState(store, { filteredWarehouses: filtered });
      },

      // Fetch project warehouses (based on role)
      fetchProjectWarehouses: rxMethod<{
        projectId: string;
        type?: WarehouseType;
        search?: string;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, type, search }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? warehouseService.getAdminProjectWarehouses(
                    projectId,
                    type,
                    search
                  )
                : warehouseService.getPartnerProjectWarehouses(
                    projectId,
                    type,
                    search
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
                      (error as Error)?.message || 'Failed to fetch warehouses',
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

      // Get specific warehouse
      fetchWarehouse: rxMethod<{
        projectId: string;
        id: string;
        withStats?: boolean;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id, withStats }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? warehouseService.getAdminWarehouse(projectId, id, withStats)
                : warehouseService.getPartnerWarehouse(
                    projectId,
                    id,
                    withStats
                  );

            return request.pipe(
              tapResponse({
                next: (warehouse) => {
                  patchState(store, {
                    selectedWarehouse: warehouse,
                    loading: false,
                    error: null,
                  });

                  // Se il warehouse è già presente nell'array, aggiorniamo anche quello
                  const currentWarehouses = store.warehouses();
                  if (currentWarehouses) {
                    const index = currentWarehouses.findIndex(
                      (w) => w.id === id
                    );
                    if (index !== -1) {
                      const updatedWarehouses = [...currentWarehouses];
                      updatedWarehouses[index] = warehouse;
                      patchState(store, { warehouses: updatedWarehouses });
                    }
                  }
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to fetch warehouse',
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

      // Create warehouse
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

                  // Update warehouses array
                  const currentWarehouses = store.warehouses() || [];
                  patchState(store, {
                    warehouses: [...currentWarehouses, createdWarehouse],
                    filteredWarehouses: [
                      ...currentWarehouses,
                      createdWarehouse,
                    ],
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore nella creazione del magazzino'
                  );
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to create warehouse',
                  });
                },
              })
            )
          )
        )
      ),

      // Update warehouse
      updateWarehouse: rxMethod<{
        projectId: string;
        id: string;
        warehouse: UpdateWarehouseDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id, warehouse }) =>
            warehouseService.updateWarehouse(projectId, id, warehouse).pipe(
              tapResponse({
                next: (updatedWarehouse) => {
                  toastService.showSuccess('Magazzino aggiornato con successo');

                  // Update warehouses array
                  const currentWarehouses = store.warehouses() || [];
                  const updatedWarehouses = currentWarehouses.map((w) =>
                    w.id === id ? updatedWarehouse : w
                  );

                  patchState(store, {
                    warehouses: updatedWarehouses,
                    filteredWarehouses: store.filteredWarehouses()
                      ? store
                          .filteredWarehouses()!
                          .map((w) => (w.id === id ? updatedWarehouse : w))
                      : null,
                    selectedWarehouse:
                      store.selectedWarehouse()?.id === id
                        ? updatedWarehouse
                        : store.selectedWarehouse(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore nell'aggiornamento del magazzino"
                  );
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to update warehouse',
                  });
                },
              })
            )
          )
        )
      ),

      // Delete warehouse
      deleteWarehouse: rxMethod<{ projectId: string; id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id }) =>
            warehouseService.deleteWarehouse(projectId, id).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Magazzino eliminato con successo');

                  // Update warehouses array by filtering out the deleted warehouse
                  const currentWarehouses = store.warehouses() || [];
                  const filteredWarehouses = currentWarehouses.filter(
                    (w) => w.id !== id
                  );

                  patchState(store, {
                    warehouses: filteredWarehouses,
                    filteredWarehouses: store.filteredWarehouses()
                      ? store.filteredWarehouses()!.filter((w) => w.id !== id)
                      : null,
                    selectedWarehouse:
                      store.selectedWarehouse()?.id === id
                        ? null
                        : store.selectedWarehouse(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore nell'eliminazione del magazzino"
                  );
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to delete warehouse',
                  });
                },
              })
            )
          )
        )
      ),

      // Update warehouse status (active/inactive)
      updateWarehouseStatus: rxMethod<{
        projectId: string;
        id: string;
        isActive: boolean;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id, isActive }) =>
            warehouseService
              .updateWarehouseStatus(projectId, id, isActive)
              .pipe(
                tapResponse({
                  next: (updatedWarehouse) => {
                    const statusMessage = isActive ? 'attivato' : 'disattivato';
                    toastService.showSuccess(
                      `Magazzino ${statusMessage} con successo`
                    );

                    // Update warehouses array
                    const currentWarehouses = store.warehouses() || [];
                    const updatedWarehouses = currentWarehouses.map((w) =>
                      w.id === id ? { ...w, isActive } : w
                    );

                    patchState(store, {
                      warehouses: updatedWarehouses,
                      filteredWarehouses: store.filteredWarehouses()
                        ? store
                            .filteredWarehouses()!
                            .map((w) => (w.id === id ? { ...w, isActive } : w))
                        : null,
                      selectedWarehouse:
                        store.selectedWarehouse()?.id === id
                          ? { ...store.selectedWarehouse()!, isActive }
                          : store.selectedWarehouse(),
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      (error as Error)?.message ||
                        `Errore nell'aggiornamento dello stato del magazzino`
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

      // Select warehouse
      selectWarehouse: (warehouse: Warehouse) => {
        patchState(store, { selectedWarehouse: warehouse });
      },

      // Clear selected warehouse
      clearSelectedWarehouse: () => {
        patchState(store, { selectedWarehouse: null });
      },

      // Clear errors
      clearWarehouseErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo i warehouses automaticamente all'inizializzazione
      // perché potrebbero essere richiesti in contesti diversi (per progetto)
    },
  })
);
