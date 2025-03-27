import { StockMovementStore } from './../../../../../core/store/stock-movement.signal-store';
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TableModule } from 'primeng/table';
import { ToastService } from '../../../../../core/services/toast.service';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { Warehouse } from '../../../../../core/models/warehouse.model';
import {
  EInvoice,
  InvoiceLine,
} from '../../../../../core/models/einvoice.model';

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    RadioButtonModule,
    TableModule,
  ],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
})
export class AssignmentComponent implements OnInit {
  @Input() projectId: string = '';
  @Input() suppliers: any[] = [];

  private stockMovementStore = inject(StockMovementStore);
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
  selectedInvoiceLines: any[] = [];

  // Stato di elaborazione
  assigningToWarehouse: boolean = false;

  // Services
  private toastService = inject(ToastService);
  private warehouseStore = inject(WarehouseStore);

  ngOnInit(): void {
    if (this.projectId) {
      this.warehouseStore.fetchProjectWarehouses({ projectId: this.projectId });
    }
  }

  // Metodo per gestire il drop di una fattura su un magazzino/centro di costo
  handleInvoiceDropped(event: {
    invoiceId: string;
    warehouseId: string;
    invoice: EInvoice;
    warehouse: Warehouse;
  }): void {
    const { invoiceId, warehouseId, invoice, warehouse } = event;

    if (!invoiceId || !warehouseId || !invoice || !warehouse) {
      this.toastService.showError("Dati incompleti per l'assegnazione");
      return;
    }

    // Determina se è un centro di costo o un magazzino fisico
    if (warehouse.type === 'COST_CENTER') {
      // Apri dialog di conferma per centro di costo
      this.openCostCenterAssignDialog(invoice, warehouseId);
    } else {
      // Apri dialog per valorizzazione magazzino fisico
      this.openWarehouseValuationDialog(invoice, warehouseId);
    }
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

    if (!this.projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Log per debug
    console.log('Assegnazione fattura a centro di costo:', {
      invoiceId: this.selectedInvoiceForCostCenter.id,
      costCenterId: this.selectedCostCenterId,
      projectId: this.projectId,
    });

    // Imposta lo stato di elaborazione
    this.assigningToWarehouse = true;

    // Chiamata allo stockMovementStore per assegnare la fattura al centro di costo
    this.stockMovementStore.assignInvoiceToCostCenter({
      projectId: this.projectId,
      invoiceId: this.selectedInvoiceForCostCenter.id!,
      costCenterId: this.selectedCostCenterId,
    });

    // Chiudiamo la dialog - il toast di successo verrà gestito dallo store
    this.closeCostCenterAssignDialog();
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
      this.closeWarehouseValuationDialog();
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

  // Nuovo metodo per ottenere solo le righe non processate
  getUnprocessedLines(): InvoiceLine[] {
    if (
      !this.selectedInvoiceForWarehouse ||
      !this.selectedInvoiceForWarehouse.invoiceLines
    ) {
      return [];
    }

    return this.selectedInvoiceForWarehouse.invoiceLines.filter(
      (line) => !line.processed && !line.processedWarehouseId
    );
  }

  // Verifica se ci sono righe già processate
  hasProcessedLines(): boolean {
    if (
      !this.selectedInvoiceForWarehouse ||
      !this.selectedInvoiceForWarehouse.invoiceLines
    ) {
      return false;
    }

    const totalLines = this.selectedInvoiceForWarehouse.invoiceLines.length;
    const unprocessedLines = this.getUnprocessedLines().length;

    return totalLines > unprocessedLines;
  }

  // Calcola il totale delle righe selezionate
  calculateSelectedTotal(): number {
    if (!this.selectedInvoiceLines || this.selectedInvoiceLines.length === 0) {
      return 0;
    }

    return this.selectedInvoiceLines.reduce(
      (sum, line) => sum + line.totalPrice,
      0
    );
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

    // Ottieni gli identificatori delle righe selezionate
    const lineNumbers = this.selectedInvoiceLines.map(
      (line) => line.lineNumber
    );


    // Prepara i dati per l'invio all'API
    const data = {
      lineIndices: lineNumbers, // Indici delle righe selezionate
    };

    // Chiamata allo stockMovementStore per processare la fattura nel magazzino
    this.assigningToWarehouse = true;
    this.stockMovementStore.processInvoiceToWarehouse({
      projectId: this.projectId,
      invoiceId: this.selectedInvoiceForWarehouse.id!,
      warehouseId: this.selectedWarehouseId,
      data: data,
    });

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
    if (!this.projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Log per debug
    console.log('Valorizzazione magazzino:', {
      invoiceId,
      warehouseId,
      selectedLines,
      isPartial: !!selectedLines,
      projectId: this.projectId,
    });

    // Prepara i dati per l'invio all'API
    const data = {
      lineIndices: selectedLines || [], // Se null, invia array vuoto per indicare valorizzazione completa
    };

    // Chiamata allo stockMovementStore per processare la fattura nel magazzino
    this.assigningToWarehouse = true;

    this.stockMovementStore.processInvoiceToWarehouse({
      projectId: this.projectId,
      invoiceId: invoiceId,
      warehouseId: warehouseId,
      data: data,
    });

    // Rimuovo il timeout simulato e mi affido all'API effettiva
    // Lo store dovrebbe gestire lo stato di caricamento e notifiche
    this.assigningToWarehouse = false;
    this.toastService.showSuccess(
      'Richiesta di valorizzazione magazzino inviata'
    );
  }

  // Helper per recuperare i dati del fornitore
  getSupplierName(supplierId: string): string {
    const supplier = this.suppliers?.find((s) => s.id === supplierId);
    return supplier?.name || 'Fornitore sconosciuto';
  }

  // Helper per recuperare i dati del magazzino
  getWarehouseById(warehouseId: string | null): Warehouse | undefined {
    if (!warehouseId) return undefined;
    const warehouses = this.warehouseStore.warehouses();
    return warehouses?.find((w) => w.id === warehouseId);
  }
}
