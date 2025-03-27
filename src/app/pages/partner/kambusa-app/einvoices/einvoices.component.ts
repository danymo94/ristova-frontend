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
  HostListener,
  ElementRef,
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
import { XmlParserService } from '../../../../core/services/kambusa/xml-parser.service';
import { PdfOcrService } from '../../../../core/services/kambusa/pdf-to-xml.service';
import { CreateEInvoiceDto } from '../../../../core/models/einvoice.model';

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

  // Nuovo flag per controllare se mostrare solo fatture non processate
  showOnlyUnprocessed: boolean = true;

  // Warehouse section
  showWarehouseSection: boolean = true;
  warehouseMode: 'normal' | 'dropTarget' = 'dropTarget';
  selectedWarehouse: Warehouse | null = null;

  // Nuova proprietà per il filtro per magazzino/centro di costo
  selectedWarehouseFilter: {
    id: string;
    name: string;
    type: 'PHYSICAL' | 'COST_CENTER' | null;
  } | null = null;

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
  private xmlParserService = inject(XmlParserService);
  private pdfOcrService = inject(PdfOcrService);

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

  // Drag and drop file handling
  isDraggingFile: boolean = false;
  isDraggingOverDropZone: boolean = false;
  dragCounter: number = 0; // Per gestire più eventi dragenter/dragleave

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
    // Verifica se l'utente ha cliccato sullo stesso magazzino già selezionato
    if (
      this.selectedWarehouseFilter &&
      this.selectedWarehouseFilter.id === warehouse.id
    ) {
      // Rimuovi il filtro se già selezionato (funziona come un toggle)
      this.clearWarehouseFilter();
      return;
    }

    // Imposta il nuovo filtro per magazzino/centro di costo
    this.selectedWarehouseFilter = {
      id: warehouse.id || '',
      name: warehouse.name,
      type: warehouse.type as 'PHYSICAL' | 'COST_CENTER',
    };

    // Rimuovi filtro per mostrare solo fatture non processate
    // quando si filtra per magazzino, per mostrare tutte le fatture correlate
    this.showOnlyUnprocessed = false;

    // Resetta gli altri filtri
    this.resetFiltersExceptWarehouse();

    // Applica il filtro
    this.applyFiltersAndSearch();

    this.toastService.showInfo(`Filtro applicato: ${warehouse.name}`);
  }

  clearWarehouseFilter(): void {
    this.selectedWarehouseFilter = null;
    this.applyFiltersAndSearch();
    this.toastService.showInfo('Filtro per magazzino/centro di costo rimosso');
  }

  resetFiltersExceptWarehouse(): void {
    this.filters = {
      supplierId: null,
      dateRange: null,
      minAmount: null,
      maxAmount: null,
    };
    this.searchQuery = '';
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
      this.searchQuery ||
      this.selectedWarehouseFilter
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

  // Nuovo metodo per cambiare la visualizzazione
  toggleUnprocessedView(): void {
    this.showOnlyUnprocessed = !this.showOnlyUnprocessed;
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

    // Filtro aggiuntivo per mostrare solo fatture non processate
    if (this.showOnlyUnprocessed) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.status?.costCenterStatus === 'not_assigned' &&
          invoice.status?.inventoryStatus === 'not_processed' &&
          !invoice.processing
      );
    }

    // Nuovo filtro per magazzino/centro di costo
    if (this.selectedWarehouseFilter) {
      if (this.selectedWarehouseFilter.type === 'PHYSICAL') {
        // Filtra per magazzino fisico (cerca nei inventoryIds)
        filtered = filtered.filter((invoice) =>
          invoice.status?.inventoryIds?.includes(
            this.selectedWarehouseFilter!.id
          )
        );
      } else if (this.selectedWarehouseFilter.type === 'COST_CENTER') {
        // Filtra per centro di costo
        filtered = filtered.filter(
          (invoice) =>
            invoice.status?.costCenterId === this.selectedWarehouseFilter!.id
        );
      }
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

  // Aggiunta degli event listeners per il drag and drop
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isDraggingFile) {
      return;
    }

    this.isDraggingOverDropZone = true;
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter++;

    if (event.dataTransfer && event.dataTransfer.items) {
      const hasFiles = Array.from(event.dataTransfer.items).some(
        (item) =>
          item.kind === 'file' &&
          (item.type === 'application/xml' || item.type === 'text/xml')
      );

      this.isDraggingFile = hasFiles;
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter--;

    if (this.dragCounter === 0) {
      this.isDraggingFile = false;
      this.isDraggingOverDropZone = false;
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter = 0;
    this.isDraggingFile = false;
    this.isDraggingOverDropZone = false;

    if (!event.dataTransfer) {
      return;
    }

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      this.handleDroppedFiles(files);
    }
  }

  // Gestisce i file rilasciati
  async handleDroppedFiles(files: FileList) {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError(
        'Nessun progetto selezionato. Impossibile caricare i file.'
      );
      return;
    }

    const xmlFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith('.xml')
    );

    if (xmlFiles.length === 0) {
      this.toastService.showInfo(
        'Nessun file XML rilevato. Sono supportati solo file XML di fatture elettroniche.'
      );
      return;
    }

    // Processiamo direttamente i file XML
    this.toastService.showInfo(
      `Elaborazione di ${xmlFiles.length} file XML in corso...`
    );

    try {
      this.processingInvoiceId = 'processing'; // Indicatore generico per mostrare che c'è un'elaborazione in corso
      this.progressPercent = 0;

      for (let i = 0; i < xmlFiles.length; i++) {
        const file = xmlFiles[i];
        try {
          const xmlContent = await this.xmlParserService.readFileAsText(file);
          const parsedInvoice = this.xmlParserService.parseInvoice(
            xmlContent,
            file.name
          );

          // Verificare se esiste già un fornitore con quel codice fiscale
          let supplierId = this.findSupplierIdByTaxCode(
            parsedInvoice.supplierData.taxCode
          );

          if (!supplierId) {
            // Creare un nuovo fornitore
            await this.createSupplierAndWait(
              projectId,
              parsedInvoice.supplierData
            );
            supplierId = this.findSupplierIdByTaxCode(
              parsedInvoice.supplierData.taxCode
            );

            if (!supplierId) {
              throw new Error(
                `Impossibile creare il fornitore: ${parsedInvoice.supplierData.name}`
              );
            }
          }

          // Verificare se la fattura esiste già
          if (this.doesInvoiceExist(parsedInvoice.invoiceNumber, supplierId)) {
            this.toastService.showWarn(
              `La fattura ${parsedInvoice.invoiceNumber} esiste già per questo fornitore.`
            );
            continue;
          }

          // Creare la fattura
          const invoiceDto: CreateEInvoiceDto = {
            supplierId,
            invoiceNumber: parsedInvoice.invoiceNumber,
            invoiceDate: parsedInvoice.invoiceDate,
            totalAmount: parsedInvoice.totalAmount,
            invoiceLines: parsedInvoice.invoiceLines,
          };

          this.einvoiceStore.createInvoice({
            projectId,
            invoice: invoiceDto,
          });

          // Aggiorna il progresso
          this.progressPercent = Math.round(((i + 1) / xmlFiles.length) * 100);
        } catch (error) {
          console.error(
            `Errore nell'elaborazione del file ${file.name}:`,
            error
          );
          this.toastService.showError(
            `Errore nell'elaborazione di ${file.name}`
          );
        }
      }

      this.toastService.showSuccess(
        `Elaborazione completata per ${xmlFiles.length} file.`
      );
      this.refreshInvoices();
    } catch (error) {
      console.error("Errore durante l'elaborazione dei file:", error);
      this.toastService.showError(
        "Si è verificato un errore durante l'elaborazione dei file."
      );
    } finally {
      this.processingInvoiceId = null;
      this.progressPercent = 0;
    }
  }

  // Helper per verificare se una fattura esiste già
  doesInvoiceExist(invoiceNumber: string, supplierId: string): boolean {
    return this.invoicesArray().some(
      (invoice) =>
        invoice.invoiceNumber === invoiceNumber &&
        invoice.supplierId === supplierId
    );
  }

  // Helper per trovare l'ID del fornitore dal suo codice fiscale
  findSupplierIdByTaxCode(taxCode: string): string | undefined {
    const suppliersArray = this.suppliers();
    if (suppliersArray && Array.isArray(suppliersArray)) {
      const supplier = suppliersArray.find((sup) => sup.taxCode === taxCode);
      return supplier?.id;
    }
    return undefined;
  }

  // Helper per creare un fornitore e attendere il completamento
  private async createSupplierAndWait(
    projectId: string,
    supplierData: any
  ): Promise<void> {
    this.supplierStore.createOrAssociateSupplier({
      projectId,
      supplier: supplierData,
    });

    // Attendi che la creazione del fornitore sia completata
    while (this.supplierLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
