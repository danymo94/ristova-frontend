import { TableModule } from 'primeng/table';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  Signal,
  computed,
  effect,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { Subject } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { SupplierStore } from '../../../../core/store/supplier.signal-store';
import { EInvoiceStore } from '../../../../core/store/einvoice.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import { WarehouseStore } from '../../../../core/store/warehouse.signal-store';
import {
  EInvoice,
  UpdatePaymentStatusDto,
} from '../../../../core/models/einvoice.model';
import { Warehouse } from '../../../../core/models/warehouse.model';

// Componenti scorporati
import { UploadComponent } from './upload/upload.component';
import { ViewComponent } from './view/view.component';
import {
  FilterComponent,
  FilterOptions,
  SupplierOption,
} from './filter/filter.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { AssignmentComponent } from './assignment/assignment.component';

@Component({
  selector: 'app-einvoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    BadgeModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    ProgressBarModule,
    TableModule,
    RadioButtonModule,
    CheckboxModule,
    // Componenti scorporati
    UploadComponent,
    ViewComponent,
    FilterComponent,
    WarehousesComponent,
    AssignmentComponent,
  ],
  templateUrl: './einvoices.component.html',
  styleUrls: ['./einvoices.component.scss'],
})
export class EinvoicesComponent implements OnInit, OnDestroy {
  // Search and filters
  searchQuery: string = '';
  filters: FilterOptions = {
    supplierId: null,
    dateRange: null,
    minAmount: null,
    maxAmount: null,
  };
  filteredInvoices: EInvoice[] = [];
  supplierOptions: SupplierOption[] = [];

  // Warehouse section
  showWarehouseSection: boolean = true;
  warehouseMode: 'normal' | 'dropTarget' = 'dropTarget';
  selectedWarehouse: Warehouse | null = null;

  // Dialog control
  uploadDialogVisible: boolean = false;
  detailsDialogVisible: boolean = false;
  filterDialogVisible: boolean = false;
  selectedInvoice: EInvoice | null = null;

  // Dialog e variabili per conferma assegnazione a centro di costo
  costCenterAssignDialogVisible: boolean = false;
  selectedCostCenterId: string | null = null;
  selectedInvoiceForCostCenter: EInvoice | null = null;

  // Dialog e variabili per valorizzazione magazzino
  warehouseValuationDialogVisible: boolean = false;
  selectedWarehouseId: string | null = null;
  selectedInvoiceForWarehouse: EInvoice | null = null;
  valuationType: 'total' | 'partial' = 'total';

  // Dialog e variabili per selezione parziale delle righe
  partialSelectionDialogVisible: boolean = false;
  selectedInvoiceLines: number[] = [];

  // Processing state
  processingRawProducts: boolean = false;
  processingInvoiceId: string | null = null;
  progressPercent: number = 0;
  assigningToWarehouse: boolean = false;

  // Services
  private toastService = inject(ToastService);
  private projectStore = inject(ProjectStore);
  private supplierStore = inject(SupplierStore);
  private einvoiceStore = inject(EInvoiceStore);
  private warehouseStore = inject(WarehouseStore);

  // Store signals
  suppliers = this.supplierStore.suppliers;
  einvoices = this.einvoiceStore.invoices;
  selectedProject = this.projectStore.selectedProject;
  supplierLoading = this.supplierStore.loading;
  einvoiceLoading = this.einvoiceStore.loading;
  warehouseLoading = this.warehouseStore.loading;

  error = computed(
    () =>
      this.supplierStore.error() ||
      this.einvoiceStore.error() ||
      this.projectStore.error() ||
      this.warehouseStore.error()
  );

  // Computed signals for template
  isLoading = computed(
    () =>
      this.supplierLoading() ||
      this.einvoiceLoading() ||
      this.warehouseLoading()
  );
  suppliersArray = computed(() => this.suppliers() || []);
  invoicesArray = computed(() => this.einvoices() || []);
  projectName = computed(
    () => this.selectedProject()?.name || 'Nessun progetto selezionato'
  );

  private destroy$ = new Subject<void>();

  @ViewChild(AssignmentComponent) assignmentComponent!: AssignmentComponent;

  constructor() {
    // Monitor selected project changes
    effect(() => {
      const projectId = this.selectedProject()?.id;
      if (projectId) {
        this.supplierStore.fetchProjectSuppliers({ projectId });
        this.einvoiceStore.fetchProjectInvoices({ projectId });
      }
    });

    // Quando i fornitori sono caricati, aggiorna le opzioni per il dropdown
    effect(() => {
      const suppliersArray = this.suppliersArray();
      if (suppliersArray.length > 0) {
        this.supplierOptions = suppliersArray.map((s) => ({
          id: s.id,
          name: s.name,
        }));
      }
    });

    // Quando le fatture sono caricate, aggiorna le fatture filtrate
    effect(() => {
      const invoices = this.invoicesArray();
      if (invoices.length > 0) {
        this.applyFiltersAndSearch();
      } else {
        this.filteredInvoices = [];
      }
    });
  }

  ngOnInit(): void {
    const projectId = this.getSelectedProjectId();
    if (projectId) {
      this.supplierStore.fetchProjectSuppliers({ projectId });
      this.einvoiceStore.fetchProjectInvoices({ projectId });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public getSelectedProjectId(): string | null {
    return this.selectedProject()?.id || null;
  }

  // Warehouse section controls
  toggleWarehouseSection(): void {
    this.showWarehouseSection = !this.showWarehouseSection;
  }

  handleWarehouseSelected(warehouse: Warehouse): void {
    this.selectedWarehouse = warehouse;
    this.toastService.showInfo(`Magazzino selezionato: ${warehouse.name}`);
    // Qui puoi implementare la logica per filtrare le fatture per questo magazzino
  }

  handleInvoiceDropped(event: {
    invoiceId: string;
    warehouseId: string;
  }): void {
    const { invoiceId, warehouseId } = event;
    if (!invoiceId || !warehouseId) {
      this.toastService.showError("Dati incompleti per l'assegnazione");
      return;
    }

    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Ottieni l'invoice dal suo ID
    const invoice = this.getInvoiceById(invoiceId);
    if (!invoice) {
      this.toastService.showError('Fattura non trovata');
      return;
    }

    // Ottieni il warehouse dal suo ID
    const warehouse = this.getWarehouseById(warehouseId);
    if (!warehouse) {
      this.toastService.showError('Magazzino non trovato');
      return;
    }

    // Invia i dati al componente assignment per la gestione
    if (this.assignmentComponent) {
      this.assignmentComponent.handleInvoiceDropped({
        invoiceId,
        warehouseId,
        invoice,
        warehouse,
      });
    } else {
      this.toastService.showError(
        'Componente di assegnazione non inizializzato'
      );
    }
  }

  // Nuovo metodo per ottenere un warehouse dal suo ID
  getWarehouseById(warehouseId: string): Warehouse | undefined {
    const warehouses = this.warehouseStore.warehouses();
    return warehouses?.find((w) => w.id === warehouseId);
  }

  // Metodo per la gestione dell'assegnazione al centro di costo
  openCostCenterAssignDialog(invoice: EInvoice, costCenterId: string): void {
    this.selectedInvoiceForCostCenter = invoice;
    this.selectedCostCenterId = costCenterId;
    this.costCenterAssignDialogVisible = true;
  }

  confirmCostCenterAssignment(): void {
    if (!this.selectedInvoiceForCostCenter || !this.selectedCostCenterId) {
      this.toastService.showError("Dati incompleti per l'assegnazione");
      return;
    }

    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Log per debug
    console.log('Assegnazione fattura a centro di costo:', {
      invoiceId: this.selectedInvoiceForCostCenter.id,
      costCenterId: this.selectedCostCenterId,
    });

    // Qui implementeresti la chiamata effettiva all'API
    this.assigningToWarehouse = true;
    setTimeout(() => {
      // Simuliamo una chiamata API
      this.assigningToWarehouse = false;
      this.toastService.showSuccess(
        'Fattura assegnata al centro di costo con successo!'
      );
      this.closeCostCenterAssignDialog();
      // Refresh dei dati
      this.refreshInvoices();
    }, 1000);
  }

  closeCostCenterAssignDialog(): void {
    this.costCenterAssignDialogVisible = false;
    this.selectedInvoiceForCostCenter = null;
    this.selectedCostCenterId = null;
  }

  // Metodo per la gestione della valorizzazione del magazzino
  openWarehouseValuationDialog(invoice: EInvoice, warehouseId: string): void {
    this.selectedInvoiceForWarehouse = invoice;
    this.selectedWarehouseId = warehouseId;
    this.valuationType = 'total';
    this.warehouseValuationDialogVisible = true;
  }

  confirmWarehouseValuation(): void {
    if (!this.selectedInvoiceForWarehouse || !this.selectedWarehouseId) {
      this.toastService.showError('Dati incompleti per la valorizzazione');
      return;
    }

    if (this.valuationType === 'total') {
      // Valorizzazione totale
      this.processWarehouseValuation(
        this.selectedInvoiceForWarehouse.id!,
        this.selectedWarehouseId,
        null
      );
    } else {
      // Valorizzazione parziale - apri dialog per selezionare le righe
      this.openPartialSelectionDialog();
    }
  }

  closeWarehouseValuationDialog(): void {
    this.warehouseValuationDialogVisible = false;
    this.selectedInvoiceForWarehouse = null;
    this.selectedWarehouseId = null;
  }

  // Metodi per la selezione parziale delle righe
  openPartialSelectionDialog(): void {
    this.selectedInvoiceLines = [];
    this.partialSelectionDialogVisible = true;
    this.warehouseValuationDialogVisible = false; // Nascondi la prima dialog
  }

  toggleLineSelection(lineIndex: number): void {
    const index = this.selectedInvoiceLines.indexOf(lineIndex);
    if (index === -1) {
      this.selectedInvoiceLines.push(lineIndex);
    } else {
      this.selectedInvoiceLines.splice(index, 1);
    }
  }

  isLineSelected(lineIndex: number): boolean {
    return this.selectedInvoiceLines.includes(lineIndex);
  }

  confirmPartialSelection(): void {
    if (!this.selectedInvoiceForWarehouse || !this.selectedWarehouseId) {
      this.toastService.showError('Dati incompleti per la valorizzazione');
      return;
    }

    if (this.selectedInvoiceLines.length === 0) {
      this.toastService.showWarn('Seleziona almeno una riga della fattura');
      return;
    }

    // Process the warehouse valuation with selected lines
    this.processWarehouseValuation(
      this.selectedInvoiceForWarehouse.id!,
      this.selectedWarehouseId,
      this.selectedInvoiceLines
    );
    this.closePartialSelectionDialog();
  }

  closePartialSelectionDialog(): void {
    this.partialSelectionDialogVisible = false;
    this.selectedInvoiceLines = [];
  }

  // Metodo comune per elaborare la valorizzazione del magazzino
  processWarehouseValuation(
    invoiceId: string,
    warehouseId: string,
    selectedLines: number[] | null
  ): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Log per debug
    console.log('Valorizzazione magazzino:', {
      invoiceId,
      warehouseId,
      selectedLines,
      isPartial: !!selectedLines,
    });

    // Qui implementeresti la chiamata effettiva all'API
    this.assigningToWarehouse = true;
    setTimeout(() => {
      // Simuliamo una chiamata API
      this.assigningToWarehouse = false;
      this.toastService.showSuccess('Magazzino valorizzato con successo!');
      // Refresh dei dati
      this.refreshInvoices();
    }, 1000);
  }

  // Upload dialog
  openUploadDialog(): void {
    this.uploadDialogVisible = true;
  }

  closeUploadDialog(): void {
    this.uploadDialogVisible = false;
  }

  handleUploadComplete(): void {
    this.closeUploadDialog();
    this.refreshInvoices();
  }

  handleUploadCanceled(): void {
    this.closeUploadDialog();
  }

  // Filter handling
  openFilterDialog(): void {
    this.filterDialogVisible = true;
  }

  closeFilterDialog(): void {
    this.filterDialogVisible = false;
  }

  applyFilters(newFilters: FilterOptions): void {
    this.filters = newFilters;
    this.applyFiltersAndSearch();
    this.closeFilterDialog();
  }

  resetFilters(): void {
    this.filters = {
      supplierId: null,
      dateRange: null,
      minAmount: null,
      maxAmount: null,
    };
    this.applyFiltersAndSearch();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filters.supplierId ||
      this.filters.dateRange ||
      this.filters.minAmount ||
      this.filters.maxAmount ||
      this.searchQuery
    );
  }

  // Search handling
  filterInvoices(query: string): void {
    this.searchQuery = query;
    this.applyFiltersAndSearch();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFiltersAndSearch();
  }

  applyFiltersAndSearch(): void {
    let filtered = [...(this.einvoices() || [])];

    // Apply search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          this.getSupplierName(invoice.supplierId).toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (this.filters.supplierId) {
      filtered = filtered.filter(
        (invoice) => invoice.supplierId === this.filters.supplierId
      );
    }

    if (this.filters.dateRange && this.filters.dateRange.length === 2) {
      const startDate = this.filters.dateRange[0];
      const endDate = this.filters.dateRange[1];

      filtered = filtered.filter((invoice) => {
        const invoiceDate = new Date(invoice.invoiceDate);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
    }

    if (this.filters.minAmount !== null) {
      filtered = filtered.filter(
        (invoice) => invoice.totalAmount >= (this.filters.minAmount || 0)
      );
    }

    if (this.filters.maxAmount !== null) {
      filtered = filtered.filter(
        (invoice) => invoice.totalAmount <= (this.filters.maxAmount || Infinity)
      );
    }

    this.filteredInvoices = filtered;
  }

  // Refresh data
  refreshInvoices(): void {
    const projectId = this.getSelectedProjectId();
    if (projectId) {
      this.einvoiceStore.fetchProjectInvoices({ projectId });
    }
  }

  // Supplier related methods
  getSupplierName(supplierId: string): string {
    const supplier = this.suppliersArray().find((s) => s.id === supplierId);
    return supplier?.name || 'Fornitore sconosciuto';
  }

  // Invoice view/edit handlers
  viewInvoiceDetails(invoice: EInvoice): void {
    this.selectedInvoice = invoice;
    this.detailsDialogVisible = true;
  }

  closeDetailsDialog(): void {
    this.detailsDialogVisible = false;
    this.selectedInvoice = null;
  }

  editInvoice(invoice: EInvoice): void {
    // Placeholder for future edit functionality
    this.toastService.showInfo(
      'La funzionalità di modifica sarà disponibile prossimamente'
    );
  }

  handleInvoiceDelete(invoice: EInvoice): void {
    this.deleteInvoice(invoice);
  }

  /**
   * Ottiene una fattura specifica dall'array delle fatture
   */
  private getInvoiceById(id: string): EInvoice | undefined {
    const invoicesArray = this.invoicesArray();
    return invoicesArray.find((invoice) => invoice.id === id);
  }

  // Gestione dello stato di pagamento
  handleUpdatePaymentStatus(data: {
    invoice: EInvoice;
    paymentData: UpdatePaymentStatusDto;
  }): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId || !data.invoice.id) {
      this.toastService.showError(
        'Dati insufficienti per aggiornare la fattura'
      );
      return;
    }

    this.einvoiceStore.updatePaymentStatus({
      projectId,
      invoiceId: data.invoice.id,
      paymentData: data.paymentData,
    });
  }

  deleteInvoice(invoice: EInvoice): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId || !invoice.id) {
      this.toastService.showError('Impossibile eliminare la fattura');
      return;
    }

    this.einvoiceStore.deleteInvoice({
      projectId,
      invoiceId: invoice.id,
    });
  }
}
