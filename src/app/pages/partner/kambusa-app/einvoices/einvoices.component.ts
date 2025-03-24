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
import { Subject } from 'rxjs';

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
  selectedInvoice: EInvoice | null = null;

  // Services
  private config = inject(PrimeNG);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);
  private supplierStore = inject(SupplierStore);
  private einvoiceStore = inject(EInvoiceStore);
  private xmlParserService = inject(XmlParserService);
  private pdfToXmlService = inject(PdfToXmlService);

  // Store signals
  suppliers = this.supplierStore.suppliers;
  einvoices = this.einvoiceStore.invoices;
  selectedProject = this.projectStore.selectedProject;
  supplierLoading = this.supplierStore.loading;
  einvoiceLoading = this.einvoiceStore.loading;
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
}
