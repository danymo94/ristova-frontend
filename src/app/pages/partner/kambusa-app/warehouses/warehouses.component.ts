import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

// PrimeNG imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { BadgeModule } from 'primeng/badge';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ProgressBarModule } from 'primeng/progressbar';

// Core imports
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../core/store/warehouse.signal-store';
import { EInvoiceStore } from '../../../../core/store/einvoice.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Warehouse,
  WarehouseType,
  WarehouseBalance,
} from '../../../../core/models/warehouse.model';
import { EInvoice } from '../../../../core/models/einvoice.model';

// Componenti
import { WarehouseViewComponent } from './view/view.component';
import { NewComponent } from './new/new.component';
import { DetailsComponent } from './details/details.component';
import { EditComponent } from './edit/edit.component';
import { AssignmentComponent } from './assignment/assignment.component';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
    TagModule,
    CardModule,
    BadgeModule,
    InputSwitchModule,
    ProgressBarModule,
    WarehouseViewComponent,
    NewComponent,
    DetailsComponent,
    EditComponent,
    AssignmentComponent,
  ],
  templateUrl: './warehouses.component.html',
})
export class WarehousesComponent implements OnInit, OnDestroy {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);
  private einvoiceStore = inject(EInvoiceStore);
  private toastService = inject(ToastService);

  // Signals
  selectedProject = this.projectStore.selectedProject;
  warehouses = this.warehouseStore.warehouses;
  filteredWarehouses = this.warehouseStore.filteredWarehouses;
  selectedWarehouse = this.warehouseStore.selectedWarehouse;
  invoices = this.einvoiceStore.invoices;
  warehouseBalance = this.warehouseStore.warehouseBalance;

  // Loading states
  loading = computed(
    () => this.warehouseStore.loading() || this.einvoiceStore.loading()
  );

  // Local state
  viewMode: 'grid' | 'list' = 'grid';
  searchQuery: string = '';
  filterType: WarehouseType | 'ALL' = 'ALL';

  // Dialog controls
  createDialogVisible: boolean = false;
  editDialogVisible: boolean = false;
  detailsDialogVisible: boolean = false;
  deleteDialogVisible: boolean = false;
  assignInvoicesDialogVisible: boolean = false;

  // Invoice assignment
  unassignedInvoices: EInvoice[] = [];

  // Cleanup
  private destroy$ = new Subject<void>();

  constructor() {
    // Monitor project changes to load warehouses
    effect(() => {
      const projectId = this.selectedProject()?.id;
      if (projectId) {
        this.warehouseStore.fetchProjectWarehouses({ projectId });
        this.loadUnassignedInvoices();
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
    this.warehouseStore.fetchProjectWarehouses({
      projectId,
      withStats: true, // Richiedi statistiche per i magazzini
    });
    this.loadUnassignedInvoices();
  }

  loadUnassignedInvoices(): void {
    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Carica tutte le fatture del progetto
    this.einvoiceStore.fetchProjectInvoices({ projectId });
  }

  getUnassignedInvoices(): EInvoice[] {
    const allInvoices = this.invoices() || [];

    // Filtra le fatture in base al tipo di magazzino selezionato
    if (this.selectedWarehouse()?.type === 'PHYSICAL') {
      // Per i magazzini fisici, seleziona le fatture che non sono state valorizzate per magazzini
      return allInvoices.filter(
        (invoice) =>
          invoice.status?.inventoryStatus === 'not_processed' ||
          invoice.status?.inventoryStatus === 'partially_processed'
      );
    } else if (this.selectedWarehouse()?.type === 'COST_CENTER') {
      // Per i centri di costo, seleziona le fatture che non sono state assegnate
      // e che hanno i prodotti grezzi già elaborati
      return allInvoices.filter(
        (invoice) =>
          invoice.status?.costCenterStatus === 'not_assigned' &&
          invoice.status?.rawProductStatus === 'not_processed'
      );
    }

    // Di default ritorna le fatture non processate
    return allInvoices.filter(
      (invoice) =>
        invoice.status?.costCenterStatus === 'not_assigned' ||
        invoice.status?.inventoryStatus === 'not_processed'
    );
  }

  // Filter handlers
  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  filterByType(type: WarehouseType | 'ALL'): void {
    this.filterType = type;
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.warehouses()) return;

    // Applica filtro per tipo
    this.warehouseStore.filterByType(
      this.filterType === 'ALL' ? undefined : this.filterType
    );

    // Applica filtro di ricerca
    if (this.searchQuery) {
      this.warehouseStore.filterBySearch(this.searchQuery);
    }
  }

  // Dialog handlers
  openCreateDialog(): void {
    this.createDialogVisible = true;
  }

  handleCreateDialogVisibilityChange(visible: boolean): void {
    this.createDialogVisible = visible;
  }

  openEditDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.editDialogVisible = true;
  }

  handleEditDialogVisibilityChange(visible: boolean): void {
    this.editDialogVisible = visible;
  }

  handleWarehouseUpdated(): void {
    // Refresh data if needed
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  openDetailsDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.detailsDialogVisible = true;
  }

  handleDetailsDialogVisibilityChange(visible: boolean): void {
    this.detailsDialogVisible = visible;
  }

  openDeleteDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.deleteDialogVisible = true;
  }

  openAssignDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.unassignedInvoices = this.getUnassignedInvoices();
    this.assignInvoicesDialogVisible = true;
  }

  handleAssignDialogVisibilityChange(visible: boolean): void {
    this.assignInvoicesDialogVisible = visible;
  }

  handleInvoicesAssigned(): void {
    // Aggiorna i dati dopo l'assegnazione delle fatture
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadUnassignedInvoices();
    }
  }

  handleWarehouseCreated(): void {
    // Refresh data after warehouse creation if needed
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  deleteWarehouse(): void {
    const projectId = this.selectedProject()?.id;
    const selectedWarehouse = this.selectedWarehouse();

    if (!projectId || !selectedWarehouse) {
      this.toastService.showError(
        'Dati insufficienti per eliminare il magazzino'
      );
      return;
    }

    // Verifica che l'ID sia definito
    if (!selectedWarehouse.id) {
      this.toastService.showError('ID magazzino non valido');
      return;
    }

    this.warehouseStore.deleteWarehouse({
      projectId,
      id: selectedWarehouse.id,
    });

    this.deleteDialogVisible = false;
  }

  toggleWarehouseStatus(warehouse: Warehouse): void {
    const projectId = this.selectedProject()?.id;

    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Verifica che l'ID sia definito
    if (!warehouse.id) {
      this.toastService.showError('ID magazzino non valido');
      return;
    }

    this.warehouseStore.updateWarehouseStatus({
      projectId,
      id: warehouse.id,
      isActive: !warehouse.isActive,
    });
  }

  // Aggiornamento del componente per recuperare il bilancio di un magazzino
  getWarehouseBalance(warehouseId: string): WarehouseBalance | null {
    const balance = this.warehouseBalance();
    if (!balance || balance.warehouseId !== warehouseId) {
      // Se non abbiamo un bilancio per questo magazzino, ne richiediamo uno
      const projectId = this.selectedProject()?.id;
      if (projectId && warehouseId) {
        this.warehouseStore.fetchWarehouseBalance({
          projectId,
          warehouseId,
        });
      }
      return null;
    }
    return balance;
  }

  getWarehouseTypeLabel(type: WarehouseType): string {
    return type === 'PHYSICAL' ? 'Magazzino Fisico' : 'Centro di Costo';
  }

  getWarehouseTypeIcon(type: WarehouseType): string {
    return type === 'PHYSICAL' ? 'pi pi-box' : 'pi pi-euro';
  }

  getWarehouseTypeSeverity(type: WarehouseType): 'info' | 'success' {
    return type === 'PHYSICAL' ? 'info' : 'success';
  }

  getStatusSeverity(isActive: boolean): 'success' | 'danger' {
    return isActive ? 'success' : 'danger';
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'Attivo' : 'Inattivo';
  }

  getLocationText(warehouse: Warehouse): string {
    if (!warehouse.location) return '-';

    const { address, city, postalCode } = warehouse.location;
    return `${address}, ${postalCode} ${city}`;
  }

  // Handlers per gli eventi emessi dal componente view
  handleWarehouseDetails(warehouse: Warehouse): void {
    this.openDetailsDialog(warehouse);
  }

  handleWarehouseEdit(warehouse: Warehouse): void {
    this.openEditDialog(warehouse);
  }

  handleWarehouseDelete(warehouse: Warehouse): void {
    this.openDeleteDialog(warehouse);
  }

  handleToggleStatus(warehouse: Warehouse): void {
    this.toggleWarehouseStatus(warehouse);
  }

  handleAssignInvoices(warehouse: Warehouse): void {
    this.openAssignDialog(warehouse);
  }

  handleEditFromDetails(warehouse: Warehouse): void {
    this.detailsDialogVisible = false;
    this.openEditDialog(warehouse);
  }

  // Clear search query method
  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  // Refresh warehouses data
  refreshWarehouses(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }
}
