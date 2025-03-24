import { computed, inject } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Table, CreateTableDto, UpdateTableDto } from '../models/table.model';
import { TableService } from '../services/api/local/table.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY, throwError } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface TableState {
  tables: Table[] | null;
  selectedTable: Table | null;
  loading: boolean;
  error: string | null;
}

const initialState: TableState = {
  tables: null,
  selectedTable: null,
  loading: false,
  error: null,
};

export const TableStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      tableService = inject(TableService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      // Utility method to get table by ID
      getTableById(id: string) {
        const currentTables = store.tables();
        return currentTables
          ? currentTables.find((table) => table.id === id)
          : null;
      },

      // Fetch public tables for a project
      fetchPublicTables: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return tableService.getPublicTables(selectedProject.id).pipe(
              tapResponse({
                next: (tables) => {
                  patchState(store, {
                    tables,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch partner tables for a project
      fetchPartnerTables: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return tableService.getPartnerTables(selectedProject.id).pipe(
              tapResponse({
                next: (tables) => {
                  patchState(store, {
                    tables,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch admin tables for a project
      fetchAdminTables: rxMethod<{ projectId?: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId }) => {
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

            return tableService.getAdminTables(targetProjectId).pipe(
              tapResponse({
                next: (tables) => {
                  patchState(store, {
                    tables,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei tavoli'
                  );
                },
              })
            );
          })
        )
      ),

      // Get a specific table by ID
      getTable: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = tableService.getAdminTable(id);
            } else {
              request = tableService.getPartnerTable(selectedProject.id, id);
            }

            return request.pipe(
              tapResponse({
                next: (table) => {
                  patchState(store, {
                    selectedTable: table,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero del tavolo',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero del tavolo'
                  );
                },
              })
            );
          })
        )
      ),

      // Create a new table
      createTable: rxMethod<{ table: CreateTableDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ table }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            // Ensure projectId is set
            let tableData = { ...table, projectId: selectedProject.id };

            let request;
            if (role === 'admin') {
              request = tableService.createAdminTable(
                selectedProject.id,
                tableData
              );
            } else {
              request = tableService.createPartnerTable(
                selectedProject.id,
                tableData
              );
            }

            return request.pipe(
              tapResponse({
                next: (createdTable) => {
                  toastService.showSuccess('Tavolo creato con successo');

                  // Add the new table to the list
                  const currentTables = store.tables() || [];
                  patchState(store, {
                    tables: [...currentTables, createdTable],
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante la creazione del tavolo',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante la creazione del tavolo'
                  );
                },
              })
            );
          })
        )
      ),

      // Update an existing table
      updateTable: rxMethod<{ id: string; table: UpdateTableDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, table }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = tableService.updateAdminTable(id, table);
            } else {
              request = tableService.updatePartnerTable(
                selectedProject.id,
                id,
                table
              );
            }

            return request.pipe(
              tapResponse({
                next: (updatedTable) => {
                  toastService.showSuccess('Tavolo aggiornato con successo');

                  // Update tables array with the updated table
                  const currentTables = store.tables() || [];
                  const updatedTables = currentTables.map((t) =>
                    t.id === updatedTable.id ? updatedTable : t
                  );

                  patchState(store, {
                    tables: updatedTables,
                    selectedTable:
                      store.selectedTable()?.id === updatedTable.id
                        ? updatedTable
                        : store.selectedTable(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'aggiornamento del tavolo",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'aggiornamento del tavolo"
                  );
                },
              })
            );
          })
        )
      ),

      // Delete a table
      deleteTable: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = tableService.deleteAdminTable(id);
            } else {
              request = tableService.deletePartnerTable(selectedProject.id, id);
            }

            return request.pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Tavolo eliminato con successo');

                  // Filter out the deleted table
                  const currentTables = store.tables() || [];
                  const filteredTables = currentTables.filter(
                    (table) => table.id !== id
                  );

                  patchState(store, {
                    tables: filteredTables,
                    selectedTable:
                      store.selectedTable()?.id === id
                        ? null
                        : store.selectedTable(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'eliminazione del tavolo",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'eliminazione del tavolo"
                  );
                },
              })
            );
          })
        )
      ),

      // Import tables from Cassa in Cloud
      importCCTables: rxMethod<{ ccTables: any[] }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ ccTables }) => {
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            if (!ccTables || ccTables.length === 0) {
              toastService.showError('Nessun tavolo da importare');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return tableService
              .importCCTables(selectedProject.id, ccTables)
              .pipe(
                tapResponse({
                  next: (importedTables) => {
                    toastService.showSuccess(
                      `${importedTables.length} tavoli importati con successo`
                    );

                    // Merge with existing tables
                    const currentTables = store.tables() || [];

                    // Create a map of existing tables by CCTableId
                    const existingTablesMap = new Map<string, Table>();
                    currentTables.forEach((tab) => {
                      if (tab.CCTableId) {
                        existingTablesMap.set(tab.CCTableId, tab);
                      }
                    });

                    // Merge imported tables with existing ones
                    const mergedTables = [...currentTables];

                    importedTables.forEach((imported) => {
                      const existingIndex = mergedTables.findIndex(
                        (tab) => tab.CCTableId === imported.CCTableId
                      );

                      if (existingIndex >= 0) {
                        // Update existing table
                        mergedTables[existingIndex] = imported;
                      } else {
                        // Add new table
                        mergedTables.push(imported);
                      }
                    });

                    patchState(store, {
                      tables: mergedTables,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante l'importazione dei tavoli",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante l'importazione dei tavoli"
                    );
                  },
                })
              );
          })
        )
      ),

      // Select a table
      selectTable: (table: Table) => {
        patchState(store, { selectedTable: table });
      },

      // Clear selected table
      clearSelectedTable: () => {
        patchState(store, { selectedTable: null });
      },

      // Clear errors
      clearTableErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Don't automatically load tables on initialization,
      // as we need a selected project first
    },
  })
);
