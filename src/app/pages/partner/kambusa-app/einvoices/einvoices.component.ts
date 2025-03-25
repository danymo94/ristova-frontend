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
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { BadgeModule } from 'primeng/badge';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { PrimeNG } from 'primeng/config';
import { saveAs } from 'file-saver';
import { Subject, Observable } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { SupplierStore } from '../../../../core/store/supplier.signal-store';
import { EInvoiceStore } from '../../../../core/store/einvoice.signal-store';
import {
  XmlParserService,
  ParsedInvoice,
} from '../../../../core/services/kambusa/xml-parser.service';
import { PdfToXmlService } from '../../../../core/services/kambusa/pdf-to-xml.service';
import { Supplier } from '../../../../core/models/supplier.model';
import {
  EInvoice,
  CreateEInvoiceDto,
} from '../../../../core/models/einvoice.model';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import {
  RawProduct,
  CreateRawProductDto,
  InvoiceRawProduct,
  PurchaseHistory,
} from '../../../../core/models/rawproduct.model';

interface FilterOptions {
  supplierId: string | null;
  dateRange: Date[] | null;
  minAmount: number | null;
  maxAmount: number | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-einvoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    ButtonModule,
    ProgressBarModule,
    ToastModule,
    BadgeModule,
    TableModule,
    CardModule,
    DialogModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
    InputNumberModule,
    TooltipModule,
  ],
  templateUrl: './einvoices.component.html',
})
export class EinvoicesComponent implements OnInit, OnDestroy {
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  // View mode
  viewMode: 'grid' | 'list' = 'list';

  // Files for upload
  files: any[] = [];
  totalSize: number = 0;
  progressPercent: number = 0;

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

  // Services
  private config = inject(PrimeNG);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);
  private supplierStore = inject(SupplierStore);
  private einvoiceStore = inject(EInvoiceStore);
  private xmlParserService = inject(XmlParserService);
  private pdfToXmlService = inject(PdfToXmlService);
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
  suppliersCount = computed(() => this.suppliers()?.length || 0);
  invoicesCount = computed(() => this.einvoices()?.length || 0);

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

  private getSelectedProjectId(): string | null {
    return this.selectedProject()?.id || null;
  }

  loadSuppliers(projectId: string): void {
    this.supplierStore.fetchProjectSuppliers({ projectId });
  }

  loadEInvoices(projectId: string): void {
    this.einvoiceStore.fetchProjectInvoices({ projectId });
  }

  // View mode controls
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  // Upload dialog
  openUploadDialog(): void {
    this.files = [];
    this.totalSize = 0;
    this.progressPercent = 0;
    this.uploadDialogVisible = true;
  }

  closeUploadDialog(): void {
    this.uploadDialogVisible = false;
    this.files = [];
    this.totalSize = 0;
    this.progressPercent = 0;
  }

  // Detail dialog
  viewInvoiceDetails(invoice: EInvoice): void {
    this.selectedInvoice = invoice;
    this.detailsDialogVisible = true;
  }

  closeDetailsDialog(): void {
    this.detailsDialogVisible = false;
    this.selectedInvoice = null;
  }

  // Filter dialog
  openFilterDialog(): void {
    this.filterDialogVisible = true;
  }

  closeFilterDialog(): void {
    this.filterDialogVisible = false;
  }

  resetFilters(): void {
    this.filters = {
      supplierId: null,
      dateRange: null,
      minAmount: null,
      maxAmount: null,
    };
  }

  applyFilters(): void {
    this.applyFiltersAndSearch();
    this.closeFilterDialog();
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
      this.loadEInvoices(projectId);
    }
  }

  // File upload handling
  onSelectedFiles(event: any): void {
    this.files = event.currentFiles;
    this.totalSize = 0;
    this.files.forEach((file) => {
      this.totalSize += file.size;
    });
  }

  onClearFiles(): void {
    this.files = [];
    this.totalSize = 0;
    this.progressPercent = 0;
  }

  onRemoveFile(event: any): void {
    const removedFile = event.file;
    this.totalSize -= removedFile.size;
  }

  formatSize(bytes: number): string {
    const k = 1024;
    const dm = 3;
    const sizes = this.config.translation?.fileSizeTypes || [
      'B',
      'KB',
      'MB',
      'GB',
      'TB',
    ];
    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${formattedSize} ${sizes[i]}`;
  }

  // Invoice editing
  editInvoice(invoice: EInvoice | null): void {
    // Placeholder for future edit functionality
    this.toastService.showInfo(
      'La funzionalità di modifica sarà disponibile prossimamente'
    );
  }

  // Date formatting
  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
  }

  // Supplier related methods
  getSupplierName(supplierId: string): string {
    const supplier = this.suppliersArray().find((s) => s.id === supplierId);
    return supplier?.name || 'Fornitore sconosciuto';
  }

  getSupplierInfo(supplierId: string, field: keyof Supplier): string {
    const supplier = this.suppliersArray().find((s) => s.id === supplierId);
    return supplier ? (supplier[field] as string) || '-' : '-';
  }

  hasSupplierWithId(supplierId: string): boolean {
    return this.suppliersArray().some((supplier) => supplier.id === supplierId);
  }

  // Upload and process invoices
  async uploadInvoices(): Promise<void> {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Filter files
    const xmlFiles = this.files.filter((file) =>
      file.name.toLowerCase().endsWith('.xml')
    );
    const pdfFiles = this.files.filter((file) =>
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (xmlFiles.length === 0 && pdfFiles.length === 0) {
      this.toastService.showError('Nessun file XML o PDF selezionato');
      return;
    }

    const parsedInvoices: ParsedInvoice[] = [];
    const totalFiles = xmlFiles.length + pdfFiles.length;
    const fileReadIncrement = totalFiles > 0 ? 50 / totalFiles : 0;
    this.progressPercent = 0;

    // Phase 1: Parse XML files
    for (const file of xmlFiles) {
      try {
        const xmlContent = await this.xmlParserService.readFileAsText(file);
        const parsedInvoice = this.xmlParserService.parseInvoice(
          xmlContent,
          file.name
        );
        parsedInvoices.push(parsedInvoice);
        this.progressPercent += fileReadIncrement;
      } catch (error) {
        console.error(`Errore nella lettura del file ${file.name}:`, error);
        this.toastService.showError(
          `Errore nell'elaborazione del file ${file.name}`
        );
      }
    }

    // Process PDF files
    for (const pdfFile of pdfFiles) {
      try {
        const generatedXml = await this.pdfToXmlService.convertPdfToXml(
          pdfFile
        );

        // Save XML for reference
        const blob = new Blob([generatedXml], {
          type: 'text/xml;charset=utf-8',
        });
        saveAs(blob, `${pdfFile.name.replace('.pdf', '')}.xml`);

        const pdfParsed = this.xmlParserService.parseInvoice(
          generatedXml,
          pdfFile.name
        );
        parsedInvoices.push(pdfParsed);
        this.progressPercent += fileReadIncrement;
      } catch (error) {
        console.error(
          `Errore nell'elaborazione del PDF ${pdfFile.name}:`,
          error
        );
        this.toastService.showError(
          `Errore nell'elaborazione del PDF ${pdfFile.name}`
        );
      }
    }

    // Phase 2: Create invoices
    const totalInvoices = parsedInvoices.length;
    const invoiceProcessIncrement = totalInvoices > 0 ? 50 / totalInvoices : 0;
    const project = this.selectedProject();
    const partnerId = project?.partnerId || '';

    let successCount = 0;
    let errorCount = 0;

    for (const invoice of parsedInvoices) {
      try {
        // Check if supplier exists
        let supplierId = this.findSupplierIdByTaxCode(
          invoice.supplierData.taxCode
        );

        if (!supplierId) {
          // Create supplier if not exists
          await this.createSupplierAndWait(projectId, invoice.supplierData);
          supplierId = this.findSupplierIdByTaxCode(
            invoice.supplierData.taxCode
          );

          if (!supplierId) {
            errorCount++;
            console.error(
              `Errore: impossibile creare il fornitore: ${invoice.supplierData.taxCode}`
            );
            continue;
          }
        }

        // Create invoice
        const invoiceDto: CreateEInvoiceDto = {
          supplierId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          totalAmount: invoice.totalAmount,
          invoiceLines: invoice.invoiceLines,
        };

        this.einvoiceStore.createInvoice({ projectId, invoice: invoiceDto });

        // Wait for completion
        while (this.einvoiceLoading()) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        successCount++;
        this.progressPercent += invoiceProcessIncrement;
      } catch (error) {
        errorCount++;
        console.error(`Errore nell'elaborazione della fattura:`, error);
      }
    }

    // Show results
    if (successCount > 0) {
      this.toastService.showSuccess(
        `${successCount} fatture elaborate con successo`
      );
      this.refreshInvoices();
    }

    if (errorCount > 0) {
      this.toastService.showWarn(
        `${errorCount} fatture non elaborate per errori`
      );
    }

    if (successCount === 0 && errorCount === 0) {
      this.toastService.showWarn('Nessuna fattura è stata elaborata');
    }

    // Reset upload state
    this.progressPercent = 100;
    setTimeout(() => {
      this.closeUploadDialog();
      if (this.fileUpload) {
        this.fileUpload.clear();
      }
    }, 1000);
  }

  findSupplierIdByTaxCode(taxCode: string): string | undefined {
    const suppliersArray = this.suppliers();
    if (suppliersArray && Array.isArray(suppliersArray)) {
      const supplier = suppliersArray.find((sup) => sup.taxCode === taxCode);
      return supplier?.id;
    }
    return undefined;
  }

  private async createSupplierAndWait(
    projectId: string,
    supplierData: any
  ): Promise<void> {
    this.supplierStore.createOrAssociateSupplier({
      projectId,
      supplier: supplierData,
    });

    // Wait for supplier creation to complete
    while (this.supplierLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Trasforma le righe di una fattura in prodotti grezzi (RawProducts)
   * @param invoice La fattura da cui estrarre i prodotti
   */
  async createRawProducts(invoice: EInvoice): Promise<void> {
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

    const totalLines = invoice.invoiceLines?.length || 0;
    if (totalLines === 0) {
      this.toastService.showWarn(
        'Questa fattura non contiene righe da elaborare'
      );
      this.processingRawProducts = false;
      this.processingInvoiceId = null;
      return;
    }

    const increment = 100 / totalLines;
    let processedLines = 0;

    // Elabora ogni riga della fattura
    for (const line of invoice.invoiceLines) {
      try {
        // Crea l'oggetto purchaseHistory
        const purchase: PurchaseHistory = {
          invoiceId: invoice.id,
          purchaseDate: invoice.invoiceDate,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
        };

        // Prepara il DTO per il prodotto grezzo
        const rawProductData: CreateRawProductDto = {
          supplierId: invoice.supplierId,
          productCode: line.articleCode,
          productCodeType: line.codeType,
          description: line.description,
          unitOfMeasure: line.unitOfMeasure,
          vatRate: line.vatRate,
          purchaseHistory: [purchase],
          additionalData: {
            category: 'auto', // Categoria di default, può essere personalizzata
            note: `Importato dalla fattura ${invoice.invoiceNumber}`,
          },
        };

        // Crea o aggiorna il prodotto grezzo
        this.rawProductStore.createOrUpdateRawProduct({
          projectId,
          rawProduct: rawProductData,
        });

        // Attendi che l'operazione sia completata
        await this.waitForRawProductProcessing();

        // Aggiorna il progresso
        processedLines++;
        this.progressPercent = Math.min(processedLines * increment, 100);
      } catch (error) {
        console.error(
          'Errore durante la creazione del prodotto grezzo:',
          error
        );
        this.toastService.showError(
          `Errore nell'elaborazione della riga: ${line.description}`
        );
      }
    }

    // Aggiorna lo stato della fattura
    try {
      // Ottieni la fattura aggiornata per avere tutti i dati correnti
      const currentInvoice = this.getInvoiceById(invoice.id);
      if (currentInvoice) {
        const updatedInvoice: Partial<EInvoice> = {
          ...currentInvoice,
          status: {
            ...currentInvoice.status,
            rawProductsExtracted: true,
          },
        };

        // Aggiorna la fattura nel backend
        this.einvoiceStore.updateInvoice({
          projectId,
          invoiceId: invoice.id,
          invoice: updatedInvoice,
        });

        // Attendi che l'aggiornamento sia completato
        while (this.einvoiceLoading()) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Carica i prodotti grezzi di questa fattura
      this.loadInvoiceRawProducts(invoice.id);
      this.toastService.showSuccess('Prodotti grezzi creati con successo');
    } catch (error) {
      console.error("Errore durante l'aggiornamento della fattura:", error);
      this.toastService.showError(
        "Errore durante l'aggiornamento dello stato della fattura"
      );
    } finally {
      this.processingRawProducts = false;
      this.processingInvoiceId = null;
      this.progressPercent = 0;
    }
  }

  /**
   * Attende che il processo di creazione/aggiornamento del prodotto grezzo sia completato
   */
  private async waitForRawProductProcessing(): Promise<void> {
    while (this.rawProductLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Carica i prodotti grezzi associati a una fattura
   */
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

  /**
   * Genera gli embedding per i prodotti grezzi
   */
  generateEmbeddings(): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.rawProductStore.generateEmbeddings({ projectId });
  }

  /**
   * Ottiene una fattura specifica dall'array delle fatture
   */
  private getInvoiceById(id: string): EInvoice | undefined {
    const invoicesArray = this.invoicesArray();
    return invoicesArray.find((invoice) => invoice.id === id);
  }

  /**
   * Verifica se una fattura ha già prodotti grezzi estratti
   */
  hasRawProductsExtracted(invoice: EInvoice): boolean {
    return !!invoice.status?.rawProductsExtracted;
  }

  /**
   * Verifica se una fattura è stata valutata nel magazzino
   */
  isWarehouseValued(invoice: EInvoice): boolean {
    return !!invoice.status?.warehouseValued;
  }

  /**
   * Verifica se una fattura ha un centro di costo assegnato
   */
  hasCostCenterAssigned(invoice: EInvoice): boolean {
    return !!invoice.status?.costCenterAssigned;
  }

  /**
   * Aggiorna lo stato di valorizzazione del magazzino
   */
  updateWarehouseValued(invoice: EInvoice): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId || !invoice.id) {
      this.toastService.showError(
        'Dati insufficienti per aggiornare la fattura'
      );
      return;
    }

    const updatedInvoice: Partial<EInvoice> = {
      status: {
        ...invoice.status,
        warehouseValued: !invoice.status?.warehouseValued,
      },
    };

    this.einvoiceStore.updateInvoice({
      projectId,
      invoiceId: invoice.id,
      invoice: updatedInvoice,
    });
  }

  /**
   * Aggiorna lo stato di assegnazione centro di costo
   */
  updateCostCenterAssigned(invoice: EInvoice): void {
    const projectId = this.getSelectedProjectId();
    if (!projectId || !invoice.id) {
      this.toastService.showError(
        'Dati insufficienti per aggiornare la fattura'
      );
      return;
    }

    const updatedInvoice: Partial<EInvoice> = {
      status: {
        ...invoice.status,
        costCenterAssigned: !invoice.status?.costCenterAssigned,
      },
    };

    this.einvoiceStore.updateInvoice({
      projectId,
      invoiceId: invoice.id,
      invoice: updatedInvoice,
    });
  }
}
