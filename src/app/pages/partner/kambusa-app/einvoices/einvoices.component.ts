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
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { Subject } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { SupplierStore } from '../../../../core/store/supplier.signal-store';
import { EInvoiceStore } from '../../../../core/store/einvoice.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import {
  EInvoice,
  UpdatePaymentStatusDto,
} from '../../../../core/models/einvoice.model';

// Componenti scorporati
import { UploadComponent } from './upload/upload.component';
import { ViewComponent } from './view/view.component';
import {
  FilterComponent,
  FilterOptions,
  SupplierOption,
} from './filter/filter.component';

@Component({
  selector: 'app-einvoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    BadgeModule,
    TableModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    ProgressBarModule,
    // Componenti scorporati
    UploadComponent,
    ViewComponent,
    FilterComponent,
  ],
  templateUrl: './einvoices.component.html',
  styleUrls: ['./einvoices.component.scss'],
})
export class EinvoicesComponent implements OnInit, OnDestroy {
  // View mode
  viewMode: 'grid' | 'list' = 'list';

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

  // Dialog control
  uploadDialogVisible: boolean = false;
  detailsDialogVisible: boolean = false;
  filterDialogVisible: boolean = false;
  rawProductsDialogVisible: boolean = false;
  selectedInvoice: EInvoice | null = null;
  selectedInvoiceForRawProducts: EInvoice | null = null;

  // Processing state
  processingRawProducts: boolean = false;
  processingInvoiceId: string | null = null;
  progressPercent: number = 0;

  // Services
  private toastService = inject(ToastService);
  private projectStore = inject(ProjectStore);
  private supplierStore = inject(SupplierStore);
  private einvoiceStore = inject(EInvoiceStore);
  private rawProductStore = inject(RawProductStore);

  // Store signals
  suppliers = this.supplierStore.suppliers;
  einvoices = this.einvoiceStore.invoices;
  selectedProject = this.projectStore.selectedProject;
  supplierLoading = this.supplierStore.loading;
  einvoiceLoading = this.einvoiceStore.loading;
  rawProductLoading = this.rawProductStore.loading;
  processingEmbeddings = this.rawProductStore.processingEmbeddings;
  invoiceRawProducts = this.rawProductStore.invoiceRawProducts;
  extractingFromInvoice = this.rawProductStore.extractingFromInvoice;

  error = computed(
    () =>
      this.supplierStore.error() ||
      this.einvoiceStore.error() ||
      this.projectStore.error()
  );

  // Computed signals for template
  isLoading = computed(() => this.supplierLoading() || this.einvoiceLoading());
  suppliersArray = computed(() => this.suppliers() || []);
  invoicesArray = computed(() => this.einvoices() || []);
  projectName = computed(
    () => this.selectedProject()?.name || 'Nessun progetto selezionato'
  );

  private destroy$ = new Subject<void>();

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

  // View mode controls
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
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

  // Raw products handling
  createRawProducts(invoice: EInvoice): void {
    if (!invoice.id) {
      this.toastService.showError('ID fattura mancante');
      return;
    }

    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.processingRawProducts = true;
    this.processingInvoiceId = invoice.id;
    this.progressPercent = 0;

    // Utilizziamo il nuovo metodo del rawProductStore per l'estrazione batch
    this.rawProductStore.extractRawProductsFromInvoice({
      projectId,
      invoiceId: invoice.id,
    });

    // Mostriamo una barra di progresso simulata mentre il backend elabora
    const interval = setInterval(() => {
      if (this.progressPercent < 90) {
        this.progressPercent += 5;
      }
    }, 300);

    // Controllo periodico per verificare se l'elaborazione è completata
    const checkInterval = setInterval(() => {
      if (!this.extractingFromInvoice()) {
        clearInterval(interval);
        clearInterval(checkInterval);
        this.progressPercent = 100;
        setTimeout(() => {
          this.processingRawProducts = false;
          this.processingInvoiceId = null;
          this.progressPercent = 0;
          this.refreshInvoices(); // Aggiorniamo le fatture per mostrare lo stato aggiornato
        }, 500);
      }
    }, 500);
  }

  loadInvoiceRawProducts(invoiceId: string): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Trova la fattura corrispondente all'id
    const invoice = this.getInvoiceById(invoiceId);
    if (invoice) {
      this.selectedInvoiceForRawProducts = invoice;
      this.rawProductStore.fetchInvoiceRawProducts({ projectId, invoiceId });
      this.rawProductsDialogVisible = true;
    } else {
      this.toastService.showError('Fattura non trovata');
    }
  }

  closeRawProductsDialog(): void {
    this.rawProductsDialogVisible = false;
    this.selectedInvoiceForRawProducts = null;
    this.rawProductStore.clearInvoiceRawProducts();
  }

  generateEmbeddings(): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.rawProductStore.generateEmbeddings({ projectId });
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

    // Chiudiamo il dialog dei dettagli se è aperto
    if (this.detailsDialogVisible) {
      this.closeDetailsDialog();
    }
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
}
