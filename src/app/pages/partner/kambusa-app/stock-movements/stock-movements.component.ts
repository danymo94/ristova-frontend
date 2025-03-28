import {
  Component,
  OnInit,
  inject,
  computed,
  Signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ProjectStore } from '../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../core/store/warehouse.signal-store';
import { StockMovementStore } from '../../../../core/store/stock-movement.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';

import { WarehouseSelectorComponent } from './warehouse-selector/warehouse-selector.component';
import { MovementListComponent } from './movement-list/movement-list.component';
import { MovementDetailsComponent } from './movement-details/movement-details.component';
import { NewMovementWizardComponent } from './new-movement-wizard/new-movement-wizard.component';
import { WarehouseInventoryComponent } from './warehouse-inventory/warehouse-inventory.component';

import {
  Warehouse,
  WarehouseType,
  WarehouseBalance,
  WarehouseInventory,
} from '../../../../core/models/warehouse.model';
import {
  StockMovement,
  StockMovementType,
  MovementStatus,
  StockMovementDetail,
} from '../../../../core/models/stock-movement.model';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    TableModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    TabViewModule,
    TooltipModule,
    ToastModule,
    SelectButtonModule,

    // Componenti figli
    WarehouseSelectorComponent,
    MovementListComponent,
    MovementDetailsComponent,
    NewMovementWizardComponent,
    WarehouseInventoryComponent,
  ],
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.scss'],
})
export class StockMovementsComponent implements OnInit {
  // Servizi iniettati
  private projectStore = inject(ProjectStore);
  public warehouseStore = inject(WarehouseStore);
  public stockMovementStore = inject(StockMovementStore);
  private rawProductStore = inject(RawProductStore);
  private toastService = inject(ToastService);

  // Signal selectors dagli store
  selectedProject = this.projectStore.selectedProject;
  warehouses = this.warehouseStore.warehouses;
  stockMovements = this.stockMovementStore.movements;
  selectedMovement = this.stockMovementStore.selectedMovement;
  movementDetails = this.stockMovementStore.movementDetails;
  warehouseInventory = this.warehouseStore.selectedWarehouseInventory;

  // Stato del componente
  viewType: 'warehouse' | 'costcenter' = 'warehouse';
  selectedWarehouse: Warehouse | null = null;

  // Stato dei dialog
  showNewMovementDialog = false;
  showDetailsDialog = false;

  // Stato dei tab
  activeTabIndex = 0; // 0: Movimenti, 1: Inventario

  // Filtri
  filterByType: StockMovementType | null = null;
  filterByStatus: MovementStatus | null = null;
  searchQuery = '';

  // Computed signals
  isLoading = computed(
    () => this.warehouseStore.loading() || this.stockMovementStore.loading()
  );

  hasSelectedWarehouse = computed(() => this.selectedWarehouse !== null);

  // Computed signal per convertire WarehouseInventory in WarehouseBalance
  warehouseBalanceAdapter = computed(() => {
    const inventory = this.warehouseStore.selectedWarehouseInventory();
    const warehouse = this.selectedWarehouse;

    if (!inventory || !warehouse) return null;

    // Adattatore per convertire WarehouseInventory in WarehouseBalance
    const balance: WarehouseBalance = {
      warehouseId: inventory.warehouseId,
      warehouseName: warehouse.name,
      type: warehouse.type,
      projectId: inventory.projectId,
      // Converti i prodotti in WarehouseBalanceItem[]
      items: inventory.products.map((product) => ({
        warehouseId: inventory.warehouseId,
        projectId: inventory.projectId,
        rawProductId: product.rawProductId,
        currentQuantity: product.quantity,
        lastMovementDate: product.lastMovementDate || new Date().toISOString(),
        averageUnitCost: product.avgCost,
        totalValue: product.value,
      })),
      totalItems: inventory.products.length,
      totalQuantity: inventory.products.reduce((sum, p) => sum + p.quantity, 0),
      totalValue: inventory.products.reduce((sum, p) => sum + p.value, 0),
      lastUpdate: inventory.lastUpdated,
    };

    return balance;
  });

  // Opzioni per i filtri
  movementTypeOptions = [
    { label: 'Tutti', value: null },
    { label: 'Acquisto', value: StockMovementType.PURCHASE },
    { label: 'Vendita', value: StockMovementType.SALE },
    { label: 'Trasferimento', value: StockMovementType.TRANSFER },
    { label: 'Inventario', value: StockMovementType.INVENTORY },
    { label: 'Spreco', value: StockMovementType.WASTE },
    { label: 'Uso Interno', value: StockMovementType.INTERNAL_USE },
    { label: 'Reso', value: StockMovementType.RETURN },
    { label: 'Spesa', value: StockMovementType.EXPENSE },
    { label: 'Altro', value: StockMovementType.OTHER },
  ];

  movementStatusOptions = [
    { label: 'Tutti', value: null },
    { label: 'Bozza', value: 'draft' },
    { label: 'Confermato', value: 'confirmed' },
    { label: 'Annullato', value: 'cancelled' },
  ];

  activeViewMode: 'movements' | 'inventory' = 'movements';

  // Aggiungere le opzioni per la selezione della vista
  viewModeOptions = [
    { label: 'Movimenti', value: 'movements', icon: 'pi pi-list' },
    { label: 'Inventario', value: 'inventory', icon: 'pi pi-box' },
  ];

  constructor() {
    // Reagire ai cambiamenti del progetto selezionato
    effect(() => {
      const projectId = this.selectedProject()?.id;
      if (projectId) {
        this.loadWarehouses(projectId);
        // Carica anche i prodotti all'avvio
        this.loadRawProducts(projectId);
      }
    });
  }

  ngOnInit() {
    const projectId = this.getSelectedProjectId();
    if (projectId) {
      this.loadWarehouses(projectId);
      // Carica anche i prodotti all'avvio
      this.loadRawProducts(projectId);
    }
  }

  private loadWarehouses(projectId: string) {
    // Carica tutti i magazzini/centri di costo per il progetto
    this.warehouseStore.fetchWarehouses({
      projectId,
    });
  }

  private loadRawProducts(projectId: string) {
    // Carica tutti i prodotti del progetto per averli già disponibili
    this.rawProductStore.fetchProjectRawProducts({ projectId });
  }

  getSelectedProjectId(): string | null {
    return this.selectedProject()?.id || null;
  }

  onWarehouseSelected(warehouse: Warehouse) {
    this.selectedWarehouse = warehouse;
    this.warehouseStore.selectWarehouse(warehouse);

    const projectId = this.getSelectedProjectId();
    if (projectId && warehouse.id) {
      // Carica i movimenti per il magazzino selezionato
      this.stockMovementStore.fetchWarehouseMovements({
        projectId,
        warehouseId: warehouse.id,
      });

      // Carica il bilancio di magazzino solo per i magazzini fisici
      if (warehouse.type === 'PHYSICAL') {
        this.warehouseStore.fetchWarehouseInventory({
          projectId,
          warehouseId: warehouse.id,
        });
      }
    }
  }

  onWarehouseTypeChange(type: WarehouseType) {
    // Aggiorniamo il tipo di visualizzazione
    this.viewType = type === 'PHYSICAL' ? 'warehouse' : 'costcenter';

    // Resetta il magazzino selezionato quando si cambia vista
    this.selectedWarehouse = null;
    this.warehouseStore.clearSelectedWarehouse();
  }

  openNewMovementDialog() {
    // Carica i prodotti per il progetto corrente
    const projectId = this.getSelectedProjectId();
    if (projectId) {
      this.rawProductStore.fetchProjectRawProducts({ projectId });
    }
    this.showNewMovementDialog = true;
  }

  closeNewMovementDialog() {
    this.showNewMovementDialog = false;
  }

  onMovementCreated(movement: StockMovement) {
    this.closeNewMovementDialog();
    this.toastService.showSuccess('Movimento creato con successo');

    // Il movimento è già stato aggiornato nel store dallo wizard
    // Ricarica il bilancio del magazzino corrente
    const projectId = this.getSelectedProjectId();
    const warehouseId = this.selectedWarehouse?.id;

    if (
      projectId &&
      warehouseId &&
      this.selectedWarehouse?.type === 'PHYSICAL'
    ) {
      this.warehouseStore.fetchWarehouseInventory({
        projectId,
        warehouseId,
      });
    }
  }

  onMovementSelected(movement: StockMovement) {
    this.stockMovementStore.selectMovement(movement);
    this.showDetailsDialog = true;
  }

  closeDetailsDialog() {
    this.showDetailsDialog = false;
    this.stockMovementStore.selectMovement(null);
  }

  applyFilters() {
    // Aggiorna i filtri manualmente
    if (this.filterByType || this.filterByStatus || this.searchQuery) {
      const filteredMovements = (this.stockMovements() || []).filter(
        (movement) => {
          // Filtro per tipo
          if (
            this.filterByType &&
            movement.movementType !== this.filterByType
          ) {
            return false;
          }

          // Filtro per stato
          if (this.filterByStatus && movement.status !== this.filterByStatus) {
            return false;
          }

          // Filtro per testo ricerca
          if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const matchesReference =
              movement.reference &&
              movement.reference.toLowerCase().includes(query);
            const matchesNotes =
              movement.notes && movement.notes.toLowerCase().includes(query);
            const matchesDocumentNumber =
              movement.documentNumber &&
              movement.documentNumber.toLowerCase().includes(query);

            if (!matchesReference && !matchesNotes && !matchesDocumentNumber) {
              return false;
            }
          }

          return true;
        }
      );

      // Non abbiamo setFilters, quindi gestiamo il filtro manualmente
      // Potrebbe richiedere un segnale aggiuntivo nel componente
      // o una variabile di stato per memorizzare i movimenti filtrati
    }
  }

  clearFilters() {
    this.filterByType = null;
    this.filterByStatus = null;
    this.searchQuery = '';

    // Aggiorna la UI reimpostando i filtri
    // Poiché non possiamo utilizzare clearFilters dello store
  }

  changeViewMode(mode: 'movements' | 'inventory') {
    this.activeViewMode = mode;

    // Se si passa alla vista inventario e il magazzino è di tipo fisico,
    // assicuriamoci che il bilancio sia caricato
    if (mode === 'inventory' && this.selectedWarehouse?.type === 'PHYSICAL') {
      const projectId = this.getSelectedProjectId();
      if (projectId && this.selectedWarehouse.id) {
        this.warehouseStore.fetchWarehouseInventory({
          projectId,
          warehouseId: this.selectedWarehouse.id,
        });
      }
    }
  }
}
