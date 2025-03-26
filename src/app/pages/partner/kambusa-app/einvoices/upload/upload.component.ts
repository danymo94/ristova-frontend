import { BadgeModule } from 'primeng/badge';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import { ToastService } from '../../../../../core/services/toast.service';
import { SupplierStore } from '../../../../../core/store/supplier.signal-store';
import { EInvoiceStore } from '../../../../../core/store/einvoice.signal-store';
import {
  XmlParserService,
  ParsedInvoice,
} from '../../../../../core/services/kambusa/xml-parser.service';
import { PdfOcrService } from '../../../../../core/services/kambusa/pdf-to-xml.service';
import { CreateEInvoiceDto } from '../../../../../core/models/einvoice.model';
import { saveAs } from 'file-saver';
import { PrimeNG } from 'primeng/config';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    ButtonModule,
    ProgressBarModule,
    DialogModule,
    BadgeModule,
  ],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent implements OnInit {
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  // Input per ricevere l'ID del progetto dal componente parent
  @Input() projectId: string = '';

  // Output per comunicare eventi al parent
  @Output() uploadComplete = new EventEmitter<void>();
  @Output() uploadCanceled = new EventEmitter<void>();

  // Proprietà per la gestione dei file
  files: any[] = [];
  totalSize: number = 0;
  progressPercent: number = 0;

  // Stato di caricamento
  uploading: boolean = false;

  // Servizi iniettati
  private config = inject(PrimeNG);
  private toastService = inject(ToastService);
  private supplierStore = inject(SupplierStore);
  private einvoiceStore = inject(EInvoiceStore);
  private xmlParserService = inject(XmlParserService);
  private pdfToXmlService = inject(PdfOcrService);

  // Segnali dagli store
  suppliers = this.supplierStore.suppliers;
  supplierLoading = this.supplierStore.loading;
  einvoiceLoading = this.einvoiceStore.loading;

  constructor() {}

  ngOnInit(): void {}

  // Metodi per la gestione dei file
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

  resetUploadState(): void {
    this.progressPercent = 0;
    this.files = [];
    this.totalSize = 0;
    if (this.fileUpload) {
      this.fileUpload.clear();
    }
  }

  cancel(): void {
    this.resetUploadState();
    this.uploadCanceled.emit();
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

  // Metodo principale per caricare e processare le fatture
  async uploadInvoices(): Promise<void> {
    if (!this.projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Filtra i file per tipo
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

    this.uploading = true;
    const parsedInvoices: ParsedInvoice[] = [];
    const totalFiles = xmlFiles.length + pdfFiles.length;
    const fileReadIncrement = totalFiles > 0 ? 50 / totalFiles : 0;
    this.progressPercent = 0;

    // Fase 1: Elaborazione dei file XML
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

    // Fase 1b: Elaborazione dei file PDF
    for (const pdfFile of pdfFiles) {
      try {
        // Utilizzo del servizio OCR per estrarre testo dalle pagine del PDF
        const ocrResult = await this.pdfToXmlService.extractTextFromPdf(
          pdfFile
        );

        // Salvataggio dei risultati OCR come file di testo per riferimento
        let fullText = '';
        ocrResult.pages.forEach((page) => {
          fullText += `=== PAGINA ${page.pageNumber} ===\n\n`;
          fullText += page.text + '\n\n';
        });

        // Salva il testo estratto come file .txt
        const textBlob = new Blob([fullText], {
          type: 'text/plain;charset=utf-8',
        });
        saveAs(textBlob, `${pdfFile.name.replace('.pdf', '')}_ocr.txt`);

        // Per ora, aggiungi un messaggio di log per indicare il completamento dell'OCR
        console.log(
          `OCR completato per ${pdfFile.name}: ${ocrResult.pages.length} pagine elaborate`
        );

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

    // Fase 2: Creazione delle fatture nel sistema
    const totalInvoices = parsedInvoices.length;
    const invoiceProcessIncrement = totalInvoices > 0 ? 50 / totalInvoices : 0;

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0; // Nuovo contatore per fatture saltate

    for (const invoice of parsedInvoices) {
      try {
        if (
          this.isDuplicateInvoice(
            invoice.invoiceNumber,
            invoice.supplierData.taxCode
          )
        ) {
          skipCount++;
          console.log(
            `Fattura ${invoice.invoiceNumber} già presente nel sistema. Saltata.`
          );
          this.progressPercent += invoiceProcessIncrement;
          continue;
        }
        // Verifica se il fornitore esiste
        let supplierId = this.findSupplierIdByTaxCode(
          invoice.supplierData.taxCode
        );

        if (!supplierId) {
          // Crea il fornitore se non esiste
          await this.createSupplierAndWait(
            this.projectId,
            invoice.supplierData
          );
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

        // Crea la fattura
        const invoiceDto: CreateEInvoiceDto = {
          supplierId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          totalAmount: invoice.totalAmount,
          invoiceLines: invoice.invoiceLines,
        };

        this.einvoiceStore.createInvoice({
          projectId: this.projectId,
          invoice: invoiceDto,
        });

        // Attendi il completamento
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

    // Mostra i risultati
    if (successCount > 0) {
      this.toastService.showSuccess(
        `${successCount} fatture elaborate con successo`
      );
    }

    if (skipCount > 0) {
      this.toastService.showInfo(
        `${skipCount} fatture saltate perché già esistenti`
      );
    }

    if (errorCount > 0) {
      this.toastService.showWarn(
        `${errorCount} fatture non elaborate per errori`
      );
    }

    if (successCount === 0 && errorCount === 0) {
      this.toastService.showWarn('Nessuna fattura è stata elaborata');
    }

    // Completa il caricamento
    this.progressPercent = 100;
    setTimeout(() => {
      this.uploading = false;
      this.resetUploadState();
      this.uploadComplete.emit();
    }, 1000);
  }

  private isDuplicateInvoice(
    invoiceNumber: string,
    supplierTaxCode: string
  ): boolean {
    const invoicesArray = this.einvoiceStore.invoices();
    if (!invoicesArray) return false;

    // Trova il fornitore corrispondente al codice fiscale
    const supplierId = this.findSupplierIdByTaxCode(supplierTaxCode);
    if (!supplierId) return false;

    // Controlla se esiste già una fattura con lo stesso numero e fornitore
    return invoicesArray.some(
      (invoice) =>
        invoice.invoiceNumber === invoiceNumber &&
        invoice.supplierId === supplierId
    );
  }

  // Metodi di supporto per la gestione dei fornitori
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

    // Attendi che la creazione del fornitore sia completata
    while (this.supplierLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
