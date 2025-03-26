import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { BadgeModule } from 'primeng/badge';

// Core imports
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../core/store/warehouse.signal-store';
import { StockMovementStore } from '../../../../core/store/stock-movement.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import {
  StockMovement,
  StockMovementType,
  MovementStatus,
} from '../../../../core/models/stock-movement.model';

// View Component
import { ViewComponent } from './view/view.component';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    TagModule,
    CardModule,
    BadgeModule,
    ViewComponent,
  ],
  templateUrl: './stock-movements.component.html',
})
export class StockMovementsComponent implements OnInit, OnDestroy {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);
  private stockMovementStore = inject(StockMovementStore);
  private rawProductStore = inject(RawProductStore);
  private toastService = inject(ToastService);

  // Signals from store
  selectedProject = this.projectStore.selectedProject;
  warehouses = this.warehouseStore.warehouses;
  movements = this.stockMovementStore.movements;
  selectedMovement = this.stockMovementStore.selectedMovement;

  // Local signals
  viewMode = signal<'list' | 'grid'>('list');
  searchQuery = signal<string>('');
  filterType = signal<StockMovementType | 'ALL'>('ALL');
  filterWarehouse = signal<string | null>(null);

  // View mode signal
  isDetailView = signal<boolean>(false);
  selectedMovementId = signal<string | null>(null);

  // Loading state
  loading = computed(
    () =>
      this.stockMovementStore.loading() ||
      this.warehouseStore.loading() ||
      this.rawProductStore.loading()
  );

  // Computed values
  filteredMovements = computed(() => {
    const allMovements = this.movements();
    if (!allMovements) return [];

    let filtered = [...allMovements];

    // Filtra per tipo
    if (this.filterType() !== 'ALL') {
      filtered = filtered.filter((m) => m.movementType === this.filterType());
    }

    // Filtra per magazzino
    if (this.filterWarehouse()) {
      filtered = filtered.filter(
        (m) =>
          m.warehouseId === this.filterWarehouse() ||
          m.sourceWarehouseId === this.filterWarehouse() ||
          m.targetWarehouseId === this.filterWarehouse()
      );
    }

    // Filtra per termine di ricerca
    const search = this.searchQuery().toLowerCase();
    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.reference?.toLowerCase().includes(search) ||
          this.getMovementTypeName(m.movementType)
            .toLowerCase()
            .includes(search) ||
          this.getWarehouseName(m.warehouseId).toLowerCase().includes(search)
      );
    }

    return filtered;
  });

  // Tipi di movimento disponibili
  movementTypes: { label: string; value: StockMovementType; icon: string }[] = [
    {
      label: 'Acquisto',
      value: StockMovementType.PURCHASE,
      icon: 'pi pi-shopping-cart',
    },
    {
      label: 'Vendita',
      value: StockMovementType.SALE,
      icon: 'pi pi-money-bill',
    },
    {
      label: 'Rettifica inventario',
      value: StockMovementType.INVENTORY,
      icon: 'pi pi-sync',
    },
    {
      label: 'Trasferimento',
      value: StockMovementType.TRANSFER,
      icon: 'pi pi-arrows-h',
    },
    {
      label: 'Scarico per sprechi',
      value: StockMovementType.WASTE,
      icon: 'pi pi-trash',
    },
    {
      label: 'Uso interno',
      value: StockMovementType.INTERNAL_USE,
      icon: 'pi pi-home',
    },
    {
      label: 'Reso a fornitore',
      value: StockMovementType.RETURN,
      icon: 'pi pi-reply',
    },
    {
      label: 'Spesa (centro di costo)',
      value: StockMovementType.EXPENSE,
      icon: 'pi pi-euro',
    },
  ];

  // Cleanup
  private destroy$ = new Subject<void>();

  constructor() {
    // Carica i dati quando il progetto selezionato cambia
    effect(() => {
      const project = this.selectedProject();
      if (project?.id) {
        this.loadData(project.id);
      }
    });
  }

  ngOnInit(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(projectId: string): void {
    // Carica i movimenti di stock
    this.stockMovementStore.fetchProjectMovements({ projectId });

    // Carica i magazzini/centri di costo
    this.warehouseStore.fetchProjectWarehouses({ projectId });

    // Carica i prodotti grezzi
    this.rawProductStore.fetchProjectRawProducts({ projectId });
  }

  refreshData(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  // Gestione filtri e ricerca
  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  filterByType(type: StockMovementType | 'ALL'): void {
    this.filterType.set(type);
  }

  filterByWarehouse(warehouseId: string | null): void {
    this.filterWarehouse.set(warehouseId);
  }

  // Cambia modalità di visualizzazione
  toggleViewMode(): void {
    this.viewMode.update((current) => (current === 'list' ? 'grid' : 'list'));
  }

  // Formattazione e utility
  getMovementTypeName(type: StockMovementType | undefined): string {
    if (!type) return 'N/A';
    const found = this.movementTypes.find((t) => t.value === type);
    return found ? found.label : type;
  }

  getMovementTypeIcon(type: StockMovementType | undefined): string {
    if (!type) return 'pi pi-question';
    const found = this.movementTypes.find((t) => t.value === type);
    return found ? found.icon : 'pi pi-question';
  }

  getWarehouseName(warehouseId: string | undefined): string {
    if (!warehouseId) return 'N/A';
    const warehouseList = this.warehouses();
    if (!warehouseList) return 'N/A';

    const warehouse = warehouseList.find((w) => w.id === warehouseId);
    return warehouse ? warehouse.name : 'N/A';
  }

  getStatusSeverity(status: MovementStatus | undefined): string {
    if (!status) return 'info';
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'draft':
        return 'warning';
      case 'cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }

  getStatusLabel(status: MovementStatus | undefined): string {
    if (!status) return 'N/A';
    switch (status) {
      case 'confirmed':
        return 'Confermato';
      case 'draft':
        return 'Bozza';
      case 'cancelled':
        return 'Annullato';
      default:
        return status;
    }
  }

  // Navigation methods
  openDetailsDialog(movement: StockMovement): void {
    // Setta il movimento selezionato
    this.stockMovementStore.selectMovement(movement);
    this.selectedMovementId.set(movement.id || null);
    // Attiva la visualizzazione di dettaglio
    this.isDetailView.set(true);
  }

  // Ritorna alla lista
  returnToList(): void {
    this.isDetailView.set(false);
    this.selectedMovementId.set(null);
    // Pulisci la selezione
    this.stockMovementStore.selectMovement(null);
  }

  openNewMovementDialog(): void {
    // Per ora implementeremo solo la visualizzazione
    this.toastService.showInfo('Funzionalità in sviluppo');
  }

  // Gestione stato del movimento dalla lista
  updateMovementStatus(movement: StockMovement, status: MovementStatus): void {
    const projectId = this.selectedProject()?.id;

    if (!projectId || !movement.id) {
      this.toastService.showError('Dati insufficienti per aggiornare lo stato');
      return;
    }

    this.stockMovementStore.updateMovementStatus({
      projectId,
      id: movement.id,
      status,
    });
  }

  // Apre il dialog di eliminazione
  openDeleteDialog(movement: StockMovement): void {
    this.stockMovementStore.selectMovement(movement);
    this.selectedMovementId.set(movement.id || null);
    // Attiva la visualizzazione di dettaglio con l'azione di eliminazione
    this.isDetailView.set(true);
  }
}
