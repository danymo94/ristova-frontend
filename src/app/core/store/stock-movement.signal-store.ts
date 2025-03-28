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
  InboundMovementDto,
  OutboundMovementDto,
  InventoryCheckDto,
  TransferMovementDto,
  UpdateMovementStatusDto,
  StockMovementType,
  MovementStatus,
} from '../models/stock-movement.model';
import { StockMovementService } from '../services/api/local/stock-movement.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, of, EMPTY, forkJoin, Observable } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';
import { WarehouseStore } from './warehouse.signal-store';

/**
 * Filtri per i movimenti di magazzino
 */
export interface MovementFilters {
  type?: StockMovementType | StockMovementType[];
  status?: MovementStatus | MovementStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

/**
 * Stato dello store per i movimenti di magazzino
 */
export interface StockMovementState {
  // Dati principali
  selectedWarehouseId: string | null;
  selectedProjectId: string | null;
  movements: StockMovement[] | null;
  filteredMovements: StockMovement[] | null;
  selectedMovement: StockMovement | null;
  movementDetails: StockMovementDetail[] | null;
  
  // Statistiche del magazzino corrente
  totalMovementCount: number;
  totalInboundValue: number;
  totalOutboundValue: number;
  
  // Filtri attivi
  filters: MovementFilters;
  
  // Stato dell'interfaccia
  loading: boolean;
  processingOperation: boolean;
  error: string | null;
}

/**
 * Stato iniziale
 */
const initialState: StockMovementState = {
  selectedWarehouseId: null,
  selectedProjectId: null,
  movements: null,
  filteredMovements: null,
  selectedMovement: null,
  movementDetails: null,
  totalMovementCount: 0,
  totalInboundValue: 0,
  totalOutboundValue: 0,
  filters: {},
  loading: false,
  processingOperation: false,
  error: null,
};

export const StockMovementStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  
  withComputed(({ movements, filteredMovements, selectedMovement, filters }) => ({
    /**
     * Conteggio totale dei movimenti disponibili
     */
    movementsCount: computed(() => {
      const mvs = movements();
      return mvs ? mvs.length : 0;
    }),
    
    /**
     * Conteggio dei movimenti filtrati
     */
    filteredCount: computed(() => {
      const filtered = filteredMovements();
      return filtered ? filtered.length : 0;
    }),
    
    /**
     * Indica se ci sono filtri attivi
     */
    hasActiveFilters: computed(() => {
      const currentFilters = filters();
      return Object.keys(currentFilters).length > 0 && 
             Object.values(currentFilters).some(val => val !== undefined);
    }),
    
    /**
     * Raggruppa i movimenti per tipo
     */
    movementsByType: computed(() => {
      const allMovements = filteredMovements() || [];
      return allMovements.reduce((acc, movement) => {
        const type = movement.movementType;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(movement);
        return acc;
      }, {} as Record<string, StockMovement[]>);
    }),
    
    /**
     * Raggruppa i movimenti per stato
     */
    movementsByStatus: computed(() => {
      const allMovements = filteredMovements() || [];
      return allMovements.reduce((acc, movement) => {
        const status = movement.status || 'draft';
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(movement);
        return acc;
      }, {} as Record<string, StockMovement[]>);
    }),
    
    /**
     * Raggruppa i movimenti per mese
     */
    movementsByMonth: computed(() => {
      const allMovements = filteredMovements() || [];
      return allMovements.reduce((acc, movement) => {
        const date = new Date(movement.movementDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }
        acc[monthKey].push(movement);
        return acc;
      }, {} as Record<string, StockMovement[]>);
    }),

    /**
     * Indica se il movimento selezionato può essere eliminato
     */
    canDeleteSelected: computed(() => {
      const movement = selectedMovement();
      // Si possono eliminare solo i movimenti in stato 'draft' o 'cancelled'
      return movement ? 
        (movement.status === 'draft' || movement.status === 'cancelled') : false;
    }),
    
    /**
     * Indica se il movimento selezionato può essere modificato
     */
    canEditSelected: computed(() => {
      const movement = selectedMovement();
      // Si possono modificare solo i movimenti in stato 'draft'
      return movement ? movement.status === 'draft' : false;
    }),
    
    /**
     * Restituisce il saldo netto (entrate - uscite)
     */
    netValue: computed(() => {
      return store.totalInboundValue() - store.totalOutboundValue();
    }),
  })),
  
  withMethods((store, 
      stockMovementService = inject(StockMovementService),
      warehouseStore = inject(WarehouseStore),
      projectStore = inject(ProjectStore),
      toastService = inject(ToastService)) => {
    
    /**
     * Funzione privata per l'applicazione dei filtri
     */
    function applyFilters(filters: MovementFilters) {
      const movements = store.movements();
      if (!movements) return;
      
      let result = [...movements];
      
      // Filtro per tipo di movimento
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        result = result.filter(m => types.includes(m.movementType));
      }
      
      // Filtro per stato
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        result = result.filter(m => statuses.includes(m.status as MovementStatus));
      }
      
      // Filtro per intervallo di date
      if (filters.dateFrom) {
        const fromDate = filters.dateFrom.getTime();
        result = result.filter(m => new Date(m.movementDate).getTime() >= fromDate);
      }
      
      if (filters.dateTo) {
        const toDate = filters.dateTo.getTime();
        result = result.filter(m => new Date(m.movementDate).getTime() <= toDate);
      }
      
      // Filtro per ricerca
      if (filters.search && filters.search.trim() !== '') {
        const search = filters.search.toLowerCase().trim();
        result = result.filter(m => 
          (m.reference && m.reference.toLowerCase().includes(search)) ||
          (m.notes && m.notes.toLowerCase().includes(search)) ||
          (m.documentNumber && m.documentNumber.toLowerCase().includes(search)) ||
          (m.id && m.id.toLowerCase().includes(search))
        );
      }
      
      patchState(store, { filteredMovements: result });
    }

    /**
     * Calcola le statistiche dei movimenti
     */
    function calculateMovementStats(movements: StockMovement[]) {
      if (!movements || movements.length === 0) {
        return {
          totalMovementCount: 0,
          totalInboundValue: 0,
          totalOutboundValue: 0
        };
      }

      const inboundTypes = [
        StockMovementType.PURCHASE, 
        StockMovementType.RETURN
      ];
      
      let totalInboundValue = 0;
      let totalOutboundValue = 0;
      
      movements.forEach(movement => {
        const amount = movement.totalAmount || 0;
        
        if (inboundTypes.includes(movement.movementType)) {
          totalInboundValue += amount;
        } else if (movement.movementType === StockMovementType.TRANSFER) {
          // Per i trasferimenti, dipende dal warehouse corrente
          if (movement.sourceWarehouseId === store.selectedWarehouseId()) {
            totalOutboundValue += amount;
          } else if (movement.targetWarehouseId === store.selectedWarehouseId()) {
            totalInboundValue += amount;
          }
        } else {
          totalOutboundValue += amount;
        }
      });
      
      return {
        totalMovementCount: movements.length,
        totalInboundValue,
        totalOutboundValue
      };
    }
    
    return {
      /**
       * Imposta il magazzino e il progetto corrente e carica i dati
       */
      setCurrentWarehouse: rxMethod<{
        projectId: string;
        warehouseId: string;
      }>(
        pipe(
          tap(({ projectId, warehouseId }) => {
            // Aggiorna i valori nello store
            patchState(store, { 
              selectedProjectId: projectId,
              selectedWarehouseId: warehouseId,
              loading: true,
              error: null,
              // Reset dei dati precedenti
              movements: null,
              filteredMovements: null,
              selectedMovement: null,
              movementDetails: null,
              filters: {}
            });
          }),
          switchMap(({ projectId, warehouseId }) => {
            // Carica i dati del magazzino
            return stockMovementService.getWarehouseMovements(projectId, warehouseId).pipe(
              tapResponse({
                next: (movements) => {
                  const stats = calculateMovementStats(movements);
                  
                  patchState(store, {
                    movements,
                    filteredMovements: movements,
                    totalMovementCount: stats.totalMovementCount,
                    totalInboundValue: stats.totalInboundValue,
                    totalOutboundValue: stats.totalOutboundValue,
                    loading: false
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error: (error as Error)?.message || 'Errore nel caricamento dei movimenti'
                  });
                  toastService.showError('Errore nel caricamento dei movimenti di magazzino');
                }
              })
            );
          })
        )
      ),

      /**
       * Carica i dettagli di un movimento
       */
      loadMovementDetails: rxMethod<{
        id: string;
      }>(
        pipe(
          tap(() => {
            patchState(store, { loading: true, error: null });
          }),
          switchMap(({ id }) => {
            const projectId = store.selectedProjectId();
            if (!projectId) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }
            
            return forkJoin({
              movement: stockMovementService.getMovement(projectId, id),
              details: stockMovementService.getMovementDetails(projectId, id)
            }).pipe(
              tapResponse({
                next: (response) => {
                  patchState(store, {
                    selectedMovement: response.movement,
                    movementDetails: response.details,
                    loading: false
                  });
                  
                  // Aggiorna anche nella lista dei movimenti se presente
                  const currentMovements = store.movements();
                  if (currentMovements) {
                    const index = currentMovements.findIndex(m => m.id === id);
                    if (index !== -1) {
                      const updatedMovements = [...currentMovements];
                      updatedMovements[index] = response.movement;
                      
                      patchState(store, { 
                        movements: updatedMovements,
                        filteredMovements: store.hasActiveFilters() ? 
                          store.filteredMovements() : updatedMovements 
                      });
                    }
                  }
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    loading: false, 
                    error: (error as Error)?.message || 'Errore nel caricamento del movimento' 
                  });
                  toastService.showError('Errore nel caricamento dei dettagli del movimento');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Filtra i movimenti
       */
      setFilters(filters: MovementFilters) {
        patchState(store, { filters });
        applyFilters(filters);
      },
      
      /**
       * Filtra per tipo di movimento
       */
      filterByType(type?: StockMovementType | StockMovementType[]) {
        const currentFilters = store.filters();
        this.setFilters({ ...currentFilters, type });
      },
      
      /**
       * Filtra per stato
       */
      filterByStatus(status?: MovementStatus | MovementStatus[]) {
        const currentFilters = store.filters();
        this.setFilters({ ...currentFilters, status });
      },
      
      /**
       * Filtra per intervallo di date
       */
      filterByDateRange(dateFrom?: Date, dateTo?: Date) {
        const currentFilters = store.filters();
        this.setFilters({ ...currentFilters, dateFrom, dateTo });
      },
      
      /**
       * Filtra per termine di ricerca
       */
      filterBySearch(search?: string) {
        const currentFilters = store.filters();
        this.setFilters({ ...currentFilters, search });
      },
      
      /**
       * Pulisce tutti i filtri
       */
      clearFilters() {
        patchState(store, { filters: {} });
        const movements = store.movements();
        patchState(store, { filteredMovements: movements });
      },

      /**
       * Crea un movimento di carico (inbound)
       */
      createInboundMovement: rxMethod<{
        data: InboundMovementDto;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ data }) => {
            const projectId = store.selectedProjectId();
            const warehouseId = store.selectedWarehouseId();
            
            if (!projectId || !warehouseId) {
              toastService.showError('Progetto o magazzino non selezionati');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.createInboundMovement(projectId, warehouseId, data).pipe(
              tapResponse({
                next: (newMovement) => {
                  // Aggiorna la lista dei movimenti
                  const currentMovements = store.movements() || [];
                  const updatedMovements = [newMovement, ...currentMovements];
                  
                  const stats = calculateMovementStats(updatedMovements);
                  
                  patchState(store, {
                    movements: updatedMovements,
                    filteredMovements: store.hasActiveFilters() ? 
                      store.filteredMovements() : updatedMovements,
                    selectedMovement: newMovement,
                    totalMovementCount: stats.totalMovementCount,
                    totalInboundValue: stats.totalInboundValue,
                    totalOutboundValue: stats.totalOutboundValue,
                    processingOperation: false
                  });
                  
                  // Ricarica l'inventario del magazzino
                  warehouseStore.fetchWarehouseInventory({ 
                    projectId, 
                    warehouseId 
                  });
                  
                  toastService.showSuccess('Carico prodotti registrato con successo');
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nella registrazione del carico' 
                  });
                  toastService.showError('Errore nella registrazione del carico');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Crea un movimento di scarico (outbound)
       */
      createOutboundMovement: rxMethod<{
        data: OutboundMovementDto;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ data }) => {
            const projectId = store.selectedProjectId();
            const warehouseId = store.selectedWarehouseId();
            
            if (!projectId || !warehouseId) {
              toastService.showError('Progetto o magazzino non selezionati');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.createOutboundMovement(projectId, warehouseId, data).pipe(
              tapResponse({
                next: (newMovement) => {
                  // Aggiorna la lista dei movimenti
                  const currentMovements = store.movements() || [];
                  const updatedMovements = [newMovement, ...currentMovements];
                  
                  const stats = calculateMovementStats(updatedMovements);
                  
                  patchState(store, {
                    movements: updatedMovements,
                    filteredMovements: store.hasActiveFilters() ? 
                      store.filteredMovements() : updatedMovements,
                    selectedMovement: newMovement,
                    totalMovementCount: stats.totalMovementCount,
                    totalInboundValue: stats.totalInboundValue,
                    totalOutboundValue: stats.totalOutboundValue,
                    processingOperation: false
                  });
                  
                  // Ricarica l'inventario del magazzino
                  warehouseStore.fetchWarehouseInventory({ 
                    projectId, 
                    warehouseId 
                  });
                  
                  toastService.showSuccess('Scarico prodotti registrato con successo');
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nella registrazione dello scarico' 
                  });
                  toastService.showError('Errore nella registrazione dello scarico');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Crea un movimento di rettifica inventario
       */
      createInventoryCheck: rxMethod<{
        data: InventoryCheckDto;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ data }) => {
            const projectId = store.selectedProjectId();
            const warehouseId = store.selectedWarehouseId();
            
            if (!projectId || !warehouseId) {
              toastService.showError('Progetto o magazzino non selezionati');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.createInventoryCheck(projectId, warehouseId, data).pipe(
              tapResponse({
                next: (newMovement) => {
                  // Aggiorna la lista dei movimenti
                  const currentMovements = store.movements() || [];
                  const updatedMovements = [newMovement, ...currentMovements];
                  
                  const stats = calculateMovementStats(updatedMovements);
                  
                  patchState(store, {
                    movements: updatedMovements,
                    filteredMovements: store.hasActiveFilters() ? 
                      store.filteredMovements() : updatedMovements,
                    selectedMovement: newMovement,
                    totalMovementCount: stats.totalMovementCount,
                    totalInboundValue: stats.totalInboundValue,
                    totalOutboundValue: stats.totalOutboundValue,
                    processingOperation: false
                  });
                  
                  // Ricarica l'inventario del magazzino
                  warehouseStore.fetchWarehouseInventory({ 
                    projectId, 
                    warehouseId 
                  });
                  
                  toastService.showSuccess('Rettifica inventario registrata con successo');
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nella registrazione della rettifica' 
                  });
                  toastService.showError('Errore nella registrazione della rettifica inventario');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Crea un movimento di trasferimento tra magazzini
       */
      createTransferMovement: rxMethod<{
        data: TransferMovementDto;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ data }) => {
            const projectId = store.selectedProjectId();
            
            if (!projectId) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.createTransferMovement(projectId, data).pipe(
              tapResponse({
                next: (newMovement) => {
                  // Se il magazzino corrente è coinvolto nel trasferimento, aggiorna la lista
                  const currentWarehouseId = store.selectedWarehouseId();
                  
                  if (currentWarehouseId && 
                      (data.sourceWarehouseId === currentWarehouseId || 
                       data.targetWarehouseId === currentWarehouseId)) {
                    
                    const currentMovements = store.movements() || [];
                    const updatedMovements = [newMovement, ...currentMovements];
                    
                    const stats = calculateMovementStats(updatedMovements);
                    
                    patchState(store, {
                      movements: updatedMovements,
                      filteredMovements: store.hasActiveFilters() ? 
                        store.filteredMovements() : updatedMovements,
                      selectedMovement: newMovement,
                      totalMovementCount: stats.totalMovementCount,
                      totalInboundValue: stats.totalInboundValue,
                      totalOutboundValue: stats.totalOutboundValue
                    });
                    
                    // Ricarica l'inventario del magazzino corrente
                    warehouseStore.fetchWarehouseInventory({ 
                      projectId, 
                      warehouseId: currentWarehouseId 
                    });
                  }
                  
                  patchState(store, { processingOperation: false });
                  
                  // Ricarica anche l'inventario dell'altro magazzino coinvolto
                  const otherWarehouseId = currentWarehouseId === data.sourceWarehouseId ? 
                    data.targetWarehouseId : data.sourceWarehouseId;
                    
                  warehouseStore.fetchWarehouseInventory({ 
                    projectId, 
                    warehouseId: otherWarehouseId 
                  });
                  
                  toastService.showSuccess('Trasferimento registrato con successo');
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nella registrazione del trasferimento' 
                  });
                  toastService.showError('Errore nella registrazione del trasferimento');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Elimina un movimento
       */
      deleteMovement: rxMethod<{
        id: string;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ id }) => {
            const projectId = store.selectedProjectId();
            const warehouseId = store.selectedWarehouseId();
            
            if (!projectId) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.deleteMovement(projectId, id).pipe(
              tapResponse({
                next: () => {
                  // Rimuovi il movimento dalla lista
                  const currentMovements = store.movements();
                  if (currentMovements) {
                    const updatedMovements = currentMovements.filter(m => m.id !== id);
                    
                    const stats = calculateMovementStats(updatedMovements);
                    
                    patchState(store, {
                      movements: updatedMovements,
                      filteredMovements: store.hasActiveFilters() ? 
                        store.filteredMovements()?.filter(m => m.id !== id) : updatedMovements,
                      selectedMovement: store.selectedMovement()?.id === id ? null : store.selectedMovement(),
                      movementDetails: store.selectedMovement()?.id === id ? null : store.movementDetails(),
                      totalMovementCount: stats.totalMovementCount,
                      totalInboundValue: stats.totalInboundValue,
                      totalOutboundValue: stats.totalOutboundValue,
                      processingOperation: false
                    });
                    
                    // Ricarica l'inventario del magazzino se specificato
                    if (warehouseId) {
                      warehouseStore.fetchWarehouseInventory({ 
                        projectId, 
                        warehouseId 
                      });
                    }
                  }
                  
                  toastService.showSuccess('Movimento eliminato con successo');
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nella cancellazione del movimento' 
                  });
                  toastService.showError('Errore nella cancellazione del movimento');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Aggiorna lo stato di un movimento
       */
      updateMovementStatus: rxMethod<{
        id: string;
        status: MovementStatus;
      }>(
        pipe(
          tap(() => {
            patchState(store, { processingOperation: true, error: null });
          }),
          switchMap(({ id, status }) => {
            const projectId = store.selectedProjectId();
            
            if (!projectId) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { processingOperation: false });
              return EMPTY;
            }
            
            return stockMovementService.updateMovementStatus(projectId, id, { status }).pipe(
              tapResponse({
                next: (updatedMovement) => {
                  // Aggiorna il movimento nella lista
                  const currentMovements = store.movements();
                  if (currentMovements) {
                    const updatedMovements = currentMovements.map(m => 
                      m.id === id ? updatedMovement : m
                    );
                    
                    patchState(store, {
                      movements: updatedMovements,
                      filteredMovements: store.hasActiveFilters() ? 
                        store.filteredMovements()?.map(m => 
                          m.id === id ? updatedMovement : m
                        ) : updatedMovements,
                      selectedMovement: store.selectedMovement()?.id === id ? 
                        updatedMovement : store.selectedMovement(),
                      processingOperation: false
                    });
                  }
                  
                  const warehouseId = store.selectedWarehouseId();
                  if (warehouseId) {
                    // Ricarica l'inventario del magazzino se cambiamo lo stato a confirmed/cancelled
                    warehouseStore.fetchWarehouseInventory({
                      projectId,
                      warehouseId
                    });
                  }
                  
                  toastService.showSuccess(`Stato del movimento aggiornato a: ${status}`);
                },
                error: (error: unknown) => {
                  patchState(store, { 
                    processingOperation: false, 
                    error: (error as Error)?.message || 'Errore nell\'aggiornamento dello stato' 
                  });
                  toastService.showError('Errore nell\'aggiornamento dello stato del movimento');
                }
              })
            );
          })
        )
      ),
      
      /**
       * Seleziona un movimento e ne carica i dettagli
       */
      selectMovement(movement: StockMovement | null) {
        if (!movement) {
          patchState(store, { 
            selectedMovement: null,
            movementDetails: null
          });
          return;
        }
        
        patchState(store, { selectedMovement: movement });
        
        // Carica i dettagli del movimento
        if (movement.id) {
          this.loadMovementDetails({ id: movement.id });
        }
      },

      /**
       * Cerca un movimento per ID
       */
      getMovementById(id: string): StockMovement | null {
        const movements = store.movements();
        if (!movements) return null;
        return movements.find(m => m.id === id) || null;
      },
      
      /**
       * Ricarica tutti i dati del magazzino corrente
       */
      refreshCurrentWarehouse() {
        const projectId = store.selectedProjectId();
        const warehouseId = store.selectedWarehouseId();
        
        if (projectId && warehouseId) {
          this.setCurrentWarehouse({ projectId, warehouseId });
        }
      },
      
      /**
       * Pulisce tutti i dati dello store
       */
      resetStore() {
        patchState(store, initialState);
      },
      
      /**
       * Pulisce gli errori
       */
      clearError() {
        patchState(store, { error: null });
      }
    };
  }),
  
  withHooks({
    onInit(store) {
      // Non carichiamo automaticamente dati all'inizializzazione
      // Devono essere caricati esplicitamente quando l'utente seleziona un magazzino
    }
  })
);