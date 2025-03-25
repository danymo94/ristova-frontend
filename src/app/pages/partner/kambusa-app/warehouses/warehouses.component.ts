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
  CreateWarehouseDto,
  WarehouseType,
  UpdateWarehouseDto,
} from '../../../../core/models/warehouse.model';
import { EInvoice } from '../../../../core/models/einvoice.model';

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

  // Form data
  newWarehouse: CreateWarehouseDto = this.getEmptyWarehouseDto();
  editingWarehouse: UpdateWarehouseDto | null = null;

  // Invoice assignment
  unassignedInvoices: EInvoice[] = [];
  selectedInvoiceIds: string[] = [];

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
    this.warehouseStore.fetchProjectWarehouses({ projectId });
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

    // Filtra le fatture che non sono state assegnate a centri di costo
    // o che non sono state valorizzate per magazzini fisici
    return allInvoices.filter(
      (invoice) =>
        !invoice.status?.costCenterAssigned || !invoice.status?.warehouseValued
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

    let filtered = [...this.warehouses()!];

    // Applica filtro per tipo
    if (this.filterType !== 'ALL') {
      filtered = filtered.filter((w) => w.type === this.filterType);
    }

    // Applica filtro di ricerca
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description.toLowerCase().includes(query)
      );
    }

    // Aggiorna i magazzini filtrati
    this.warehouseStore.filterByType(
      this.filterType === 'ALL' ? undefined : this.filterType
    );

    if (this.searchQuery) {
      this.warehouseStore.filterBySearch(this.searchQuery);
    }
  }

  // Dialog handlers
  openCreateDialog(): void {
    this.newWarehouse = this.getEmptyWarehouseDto();
    this.createDialogVisible = true;
  }

  openEditDialog(warehouse: Warehouse): void {
    this.editingWarehouse = {
      name: warehouse.name,
      description: warehouse.description,
      isActive: warehouse.isActive,
      location: warehouse.location ? { ...warehouse.location } : undefined,
      responsible: warehouse.responsible
        ? { ...warehouse.responsible }
        : undefined,
      notes: warehouse.notes,
      costCenterCode: warehouse.costCenterCode,
      costCenterCategories: warehouse.costCenterCategories
        ? [...warehouse.costCenterCategories]
        : undefined,
    };

    this.warehouseStore.selectWarehouse(warehouse);
    this.editDialogVisible = true;
  }

  openDetailsDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.detailsDialogVisible = true;

    // Carica i dettagli estesi del magazzino incluse le statistiche se è un magazzino fisico
    const projectId = this.selectedProject()?.id;
    if (projectId && warehouse.type === 'PHYSICAL') {
      this.warehouseStore.fetchWarehouse({
        projectId,
        id: warehouse.id,
        withStats: true,
      });
    }
  }

  openDeleteDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.deleteDialogVisible = true;
  }

  openAssignDialog(warehouse: Warehouse): void {
    this.warehouseStore.selectWarehouse(warehouse);
    this.unassignedInvoices = this.getUnassignedInvoices();
    this.selectedInvoiceIds = [];
    this.assignInvoicesDialogVisible = true;
  }

  // CRUD operations
  createWarehouse(): void {
    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Validazione basilare
    if (!this.newWarehouse.name || !this.newWarehouse.type) {
      this.toastService.showError('Nome e tipo sono campi obbligatori');
      return;
    }

    this.warehouseStore.createWarehouse({
      projectId,
      warehouse: this.newWarehouse,
    });

    this.createDialogVisible = false;
  }

  updateWarehouse(): void {
    const projectId = this.selectedProject()?.id;
    const selectedWarehouse = this.selectedWarehouse();

    if (!projectId || !selectedWarehouse || !this.editingWarehouse) {
      this.toastService.showError(
        'Dati insufficienti per aggiornare il magazzino'
      );
      return;
    }

    // Validazione basilare
    if (!this.editingWarehouse.name) {
      this.toastService.showError('Il nome è un campo obbligatorio');
      return;
    }

    this.warehouseStore.updateWarehouse({
      projectId,
      id: selectedWarehouse.id,
      warehouse: this.editingWarehouse,
    });

    this.editDialogVisible = false;
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

    this.warehouseStore.updateWarehouseStatus({
      projectId,
      id: warehouse.id,
      isActive: !warehouse.isActive,
    });
  }

  assignInvoicesToWarehouse(): void {
    // Implementazione da fare: assegnare fatture al magazzino/centro di costo selezionato
    const projectId = this.selectedProject()?.id;
    const selectedWarehouse = this.selectedWarehouse();

    if (
      !projectId ||
      !selectedWarehouse ||
      this.selectedInvoiceIds.length === 0
    ) {
      this.toastService.showError(
        'Selezionare almeno una fattura da assegnare'
      );
      return;
    }

    // Qui implementeremo la logica di assegnazione
    // Per ora mostriamo solo un messaggio di conferma
    this.toastService.showInfo(
      `Assegnazione di ${this.selectedInvoiceIds.length} fatture al ${
        selectedWarehouse.type === 'PHYSICAL' ? 'magazzino' : 'centro di costo'
      } "${selectedWarehouse.name}" sarà implementata nella prossima versione`
    );

    this.assignInvoicesDialogVisible = false;
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

  // ...existing code...

// Metodi helper per gestire oggetti annidati opzionali nel form di editing
ensureLocationExists(): void {
  if (this.editingWarehouse && !this.editingWarehouse.location) {
    this.editingWarehouse.location = {
      address: '',
      city: '',
      postalCode: '',
      country: 'Italia'
    };
  }
}

ensureResponsibleExists(): void {
  if (this.editingWarehouse && !this.editingWarehouse.responsible) {
    this.editingWarehouse.responsible = {
      name: '',
      phone: '',
      email: ''
    };
  }
}

getLocationAddress(): string {
  return this.editingWarehouse?.location?.address || '';
}

setLocationAddress(value: string): void {
  this.ensureLocationExists();
  if (this.editingWarehouse && this.editingWarehouse.location) {
    this.editingWarehouse.location.address = value;
  }
}

getResponsibleName(): string {
  return this.editingWarehouse?.responsible?.name || '';
}

setResponsibleName(value: string): void {
  this.ensureResponsibleExists();
  if (this.editingWarehouse && this.editingWarehouse.responsible) {
    this.editingWarehouse.responsible.name = value;
  }
}

getResponsiblePhone(): string {
  return this.editingWarehouse?.responsible?.phone || '';
}

setResponsiblePhone(value: string): void {
  this.ensureResponsibleExists();
  if (this.editingWarehouse && this.editingWarehouse.responsible) {
    this.editingWarehouse.responsible.phone = value;
  }
}

getResponsibleEmail(): string {
  return this.editingWarehouse?.responsible?.email || '';
}

setResponsibleEmail(value: string): void {
  this.ensureResponsibleExists();
  if (this.editingWarehouse && this.editingWarehouse.responsible) {
    this.editingWarehouse.responsible.email = value;
  }
}

getLocationCity(): string {
  return this.editingWarehouse?.location?.city || '';
}

setLocationCity(value: string): void {
  this.ensureLocationExists();
  if (this.editingWarehouse && this.editingWarehouse.location) {
    this.editingWarehouse.location.city = value;
  }
}

getLocationPostalCode(): string {
  return this.editingWarehouse?.location?.postalCode || '';
}

setLocationPostalCode(value: string): void {
  this.ensureLocationExists();
  if (this.editingWarehouse && this.editingWarehouse.location) {
    this.editingWarehouse.location.postalCode = value;
  }
}

getLocationCountry(): string {
  return this.editingWarehouse?.location?.country || 'Italia';
}

setLocationCountry(value: string): void {
  this.ensureLocationExists();
  if (this.editingWarehouse && this.editingWarehouse.location) {
    this.editingWarehouse.location.country = value;
  }
}
// ...existing code...

// Helper methods for creating new warehouses
ensureNewResponsibleExists(): void {
  if (!this.newWarehouse.responsible) {
    this.newWarehouse.responsible = {
      name: '',
      phone: '',
      email: ''
    };
  }
}

ensureNewLocationExists(): void {
  if (!this.newWarehouse.location) {
    this.newWarehouse.location = {
      address: '',
      city: '',
      postalCode: '',
      country: 'Italia'
    };
  }
}

getEmptyWarehouseDto(): CreateWarehouseDto {
  return {
    name: '',
    description: '',
    type: 'PHYSICAL',
    isActive: true,
    location: {
      address: '',
      city: '',
      postalCode: '',
      country: 'Italia',
    },
    responsible: {
      name: '',
      phone: '',
      email: ''
    },
    notes: '',
  };
}

// ...existing code...

// ...existing code...

}
