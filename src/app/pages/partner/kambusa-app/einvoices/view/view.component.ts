import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';

import {
  EInvoice,
  UpdatePaymentStatusDto,
} from '../../../../../core/models/einvoice.model';
import { Supplier } from '../../../../../core/models/supplier.model';
import { EInvoiceStore } from '../../../../../core/store/einvoice.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

interface PaymentStatusOption {
  value: 'pending' | 'scheduled' | 'paid' | 'canceled';
  label: string;
}

@Component({
  selector: 'app-einvoice-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    BadgeModule,
    TooltipModule,
    CardModule,
    ProgressBarModule,
    DialogModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent {
  @Input() invoice: EInvoice | null = null;
  @Input() suppliers: Supplier[] = [];
  @Input() viewMode: 'card' | 'detail' = 'card';
  @Input() processingRawProducts: boolean = false;
  @Input() processingInvoiceId: string | null = null;
  @Input() progressPercent: number = 0;

  @Output() onDetails = new EventEmitter<EInvoice>();
  @Output() onEdit = new EventEmitter<EInvoice>();
  @Output() onDelete = new EventEmitter<EInvoice>(); // Nuovo output per l'eliminazione
  @Output() onExtractRawProducts = new EventEmitter<EInvoice>();
  @Output() onShowRawProducts = new EventEmitter<string>();
  @Output() onUpdatePaymentStatus = new EventEmitter<{
    invoice: EInvoice;
    paymentData: UpdatePaymentStatusDto;
  }>();

  // Opzioni per il dropdown dello stato pagamento
  paymentStatusOptions: PaymentStatusOption[] = [
    { value: 'pending', label: 'In attesa' },
    { value: 'scheduled', label: 'Programmato' },
    { value: 'paid', label: 'Pagato' },
    { value: 'canceled', label: 'Annullato' },
  ];

  // Stato del dialog per la gestione pagamenti
  paymentDialogVisible = false;
  deleteDialogVisible = false;

  selectedPaymentStatus: 'pending' | 'scheduled' | 'paid' | 'canceled' | null =
    null;
  scheduledPaymentDate: Date | null = null;
  paymentDate: Date | null = null;

  private einvoiceStore = inject(EInvoiceStore);
  private toastService = inject(ToastService);

  // Metodi per recuperare informazioni sul fornitore
  getSupplierName(supplierId: string): string {
    const supplier = this.suppliers.find((s) => s.id === supplierId);
    return supplier?.name || 'Fornitore sconosciuto';
  }

  getSupplierInfo(supplierId: string, field: keyof Supplier): string {
    const supplier = this.suppliers.find((s) => s.id === supplierId);
    return supplier ? (supplier[field] as string) || '-' : '-';
  }

  // Metodi per la gestione dello stato della fattura
  hasRawProductsExtracted(invoice: EInvoice | null): boolean {
    if (!invoice) return false;
    return invoice.status?.rawProductStatus === 'processed';
  }

  isWarehouseValued(invoice: EInvoice | null): boolean {
    if (!invoice) return false;
    return invoice.status?.inventoryStatus === 'processed';
  }

  hasCostCenterAssigned(invoice: EInvoice | null): boolean {
    if (!invoice) return false;
    return invoice.status?.costCenterStatus === 'assigned';
  }

  getPaymentStatusLabel(invoice: EInvoice | null): string {
    if (!invoice) return 'Sconosciuto';

    const status = invoice.status?.paymentStatus;
    switch (status) {
      case 'pending':
        return 'In attesa';
      case 'scheduled':
        return 'Programmato';
      case 'paid':
        return 'Pagato';
      case 'canceled':
        return 'Annullato';
      default:
        return 'In attesa';
    }
  }

  getPaymentStatusSeverity(invoice: EInvoice | null): 'info' | 'warn' | 'success' | 'danger' {
    if (!invoice) return 'info';

    const status = invoice.status?.paymentStatus;
    switch (status) {
      case 'pending':
        return 'warn';
      case 'scheduled':
        return 'info';
      case 'paid':
        return 'success';
      case 'canceled':
        return 'danger';
      default:
        return 'info';
    }
  }

  // Formattazione della data
  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
  }

  // Gestori eventi
  viewDetails(): void {
    if (this.invoice) {
      this.onDetails.emit(this.invoice);
    }
  }

  editInvoice(): void {
    if (this.invoice) {
      this.onEdit.emit(this.invoice);
    }
  }

  confirmDelete(): void {
    if (!this.invoice) return;
    this.deleteDialogVisible = true;
  }

  // Metodo per eliminare la fattura
  deleteInvoice(): void {
    if (!this.invoice) return;
    this.onDelete.emit(this.invoice);
    this.deleteDialogVisible = false;
  }

  extractRawProducts(): void {
    if (this.invoice) {
      this.onExtractRawProducts.emit(this.invoice);
    }
  }

  showRawProducts(): void {
    if (this.invoice?.id) {
      this.onShowRawProducts.emit(this.invoice.id);
    }
  }

  handleRawProductsAction(): void {
    if (!this.invoice) return;

    if (this.hasRawProductsExtracted(this.invoice)) {
      this.showRawProducts();
    } else {
      this.extractRawProducts();
    }
  }

  // Nuovi metodi per la gestione dei pagamenti
  openPaymentDialog(): void {
    if (!this.invoice) return;

    this.selectedPaymentStatus =
      this.invoice.status?.paymentStatus || 'pending';
    this.scheduledPaymentDate = this.invoice.status?.scheduledPaymentDate
      ? new Date(this.invoice.status.scheduledPaymentDate)
      : null;
    this.paymentDate = this.invoice.status?.paymentDate
      ? new Date(this.invoice.status.paymentDate)
      : null;

    this.paymentDialogVisible = true;
  }

  closePaymentDialog(): void {
    this.paymentDialogVisible = false;
    this.resetPaymentForm();
  }

  resetPaymentForm(): void {
    this.selectedPaymentStatus = null;
    this.scheduledPaymentDate = null;
    this.paymentDate = null;
  }

  savePaymentStatus(): void {
    if (!this.invoice || !this.selectedPaymentStatus) return;

    const paymentData: UpdatePaymentStatusDto = {
      paymentStatus: this.selectedPaymentStatus,
    };

    // Aggiungi la data programmata se lo stato è 'scheduled'
    if (
      this.selectedPaymentStatus === 'scheduled' &&
      this.scheduledPaymentDate
    ) {
      paymentData.scheduledPaymentDate =
        this.scheduledPaymentDate.toISOString();
    }

    // Aggiungi la data di pagamento se lo stato è 'paid'
    if (this.selectedPaymentStatus === 'paid' && this.paymentDate) {
      paymentData.paymentDate = this.paymentDate.toISOString();
    }

    this.onUpdatePaymentStatus.emit({
      invoice: this.invoice,
      paymentData,
    });

    this.paymentDialogVisible = false;
    this.resetPaymentForm();
  }

  // Helper per controllo validità form
  isPaymentFormValid(): boolean {
    if (!this.selectedPaymentStatus) return false;

    if (
      this.selectedPaymentStatus === 'scheduled' &&
      !this.scheduledPaymentDate
    ) {
      return false;
    }

    if (this.selectedPaymentStatus === 'paid' && !this.paymentDate) {
      return false;
    }

    return true;
  }
}
