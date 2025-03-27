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

import { Warehouse } from '../../../../core/models/warehouse.model';
import {
  StockMovement,
  StockMovementType,
  MovementStatus,
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

  hasSelectedWarehouse = computed(() => !!this.selectedWarehouse);

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

  // Opzioni per la selezione della vista
  viewOptions = [
    { icon: 'pi pi-building', label: 'Magazzini', value: 'warehouse' },
    { icon: 'pi pi-chart-pie', label: 'Centri di Costo', value: 'costcenter' },
  ];

  constructor() {
    // Reagire ai cambiamenti del progetto selezionato
    effect(() => {
      const projectId = this.selectedProject()?.id;
      if (projectId) {
        this.loadWarehouses(projectId);
      }
    });
  }

  ngOnInit() {
    const projectId = this.getSelectedProjectId();
    if (projectId) {
      this.loadWarehouses(projectId);
    }
  }

  private loadWarehouses(projectId: string) {
    // Carica tutti i magazzini/centri di costo per il progetto
    this.warehouseStore.fetchProjectWarehouses({
      projectId,
      withStats: true,
    });
  }

  getSelectedProjectId(): string | null {
    return this.selectedProject()?.id || null;
  }

  onWarehouseSelected(warehouse: Warehouse) {
    this.selectedWarehouse = warehouse;

    const projectId = this.getSelectedProjectId();
    if (projectId && warehouse.id) {
      // Carica i movimenti per il magazzino selezionato
      this.stockMovementStore.fetchWarehouseMovements({
        projectId,
        warehouseId: warehouse.id,
      });

      // Carica anche il bilancio di magazzino
      this.warehouseStore.fetchWarehouseBalance({
        projectId,
        warehouseId: warehouse.id,
      });
    }
  }

  changeView(type: 'warehouse' | 'costcenter') {
    this.viewType = type;

    // Resetta il magazzino selezionato quando si cambia vista
    this.selectedWarehouse = null;
    this.stockMovementStore.resetState();
  }

  openNewMovementDialog() {
    this.showNewMovementDialog = true;
  }

  closeNewMovementDialog() {
    this.showNewMovementDialog = false;
  }

  onMovementCreated(movement: StockMovement) {
    this.closeNewMovementDialog();
    this.toastService.showSuccess('Movimento creato con successo');

    // Aggiorna i movimenti per il magazzino selezionato
    if (this.selectedWarehouse?.id && this.getSelectedProjectId()) {
      this.stockMovementStore.fetchWarehouseMovements({
        projectId: this.getSelectedProjectId()!,
        warehouseId: this.selectedWarehouse.id,
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
    const projectId = this.getSelectedProjectId();
    const warehouseId = this.selectedWarehouse?.id;

    if (projectId && warehouseId) {
      // Qui dovremmo implementare una logica per filtrare i movimenti
      // In una implementazione reale, probabilmente passeremmo i filtri all'API
      // Per ora, recuperiamo tutti i movimenti e filtriamo lato client
      this.stockMovementStore.fetchWarehouseMovements({
        projectId,
        warehouseId,
      });
    }
  }

  clearFilters() {
    this.filterByType = null;
    this.filterByStatus = null;
    this.searchQuery = '';
    this.applyFilters();
  }

  changeTab(index: number) {
    this.activeTabIndex = index;
  }
}
