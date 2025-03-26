import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

// Core imports
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import { EInvoice } from '../../../../../core/models/einvoice.model';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { EInvoiceStore } from '../../../../../core/store/einvoice.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';
import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';

@Component({
  selector: 'app-warehouse-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TableModule,
    TagModule,
  ],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
})
export class AssignmentComponent implements OnInit, OnChanges {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private einvoiceStore = inject(EInvoiceStore);
  private stockMovementStore = inject(StockMovementStore);
  private toastService = inject(ToastService);

  // Inputs and Outputs
  @Input() warehouse: Warehouse | null = null;
  @Input() visible = false;
  @Input() unassignedInvoices: EInvoice[] = [];
  @Input() loading = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() invoicesAssigned = new EventEmitter<void>();

  // Local state
  selectedInvoices: EInvoice[] = []; // Memorizza le fatture complete invece degli ID
  filteredInvoices: EInvoice[] = [];
  showAssignment: boolean = false;

  ngOnInit(): void {
    // Reset the selection when the component initializes
    this.selectedInvoices = [];
    this.filterInvoices();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['warehouse'] || changes['unassignedInvoices']) {
      this.filterInvoices();
    }
  
    if (changes['visible'] && this.visible) {
      this.selectedInvoices = [];
    }
  }

  // Filter invoices based on warehouse type and invoice status
  filterInvoices(): void {
    if (!this.warehouse) {
      this.filteredInvoices = [];
      this.showAssignment = false;
      return;
    }

    // Show assignment only for cost centers
    this.showAssignment = this.warehouse.type === 'COST_CENTER';

    if (this.warehouse.type === 'COST_CENTER') {
      // For cost centers, show only invoices that are not already assigned
      // and have raw products processed
      this.filteredInvoices = this.unassignedInvoices.filter(
        (invoice) =>
          invoice.status?.costCenterStatus === 'not_assigned' &&
          invoice.status?.rawProductStatus === 'not_processed'
      );
    } else {
      // For physical warehouses, don't show any invoices here
      // as they should be processed differently
      this.filteredInvoices = [];
    }
  }

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.selectedInvoices = [];
  }

  assignInvoicesToWarehouse(): void {
    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId || !this.warehouse || this.selectedInvoices.length === 0) {
      this.toastService.showError(
        'Selezionare almeno una fattura da assegnare'
      );
      return;
    }
  
    // Verifica che l'ID sia definito
    if (!this.warehouse.id) {
      this.toastService.showError('ID magazzino non valido');
      return;
    }
  
    // Verifica che sia un centro di costo
    if (this.warehouse.type !== 'COST_CENTER') {
      this.toastService.showError(
        'Solo i centri di costo possono avere fatture assegnate direttamente'
      );
      return;
    }
  
    // Estrai gli ID dalle fatture selezionate
    const selectedIds = this.selectedInvoices.map(invoice => invoice.id);
    
    // Assegna ciascuna fattura selezionata al centro di costo
    this.assignInvoicesToCostCenter(projectId, this.warehouse.id, selectedIds);
  
    this.closeDialog();
    this.invoicesAssigned.emit();
  }

  assignInvoicesToCostCenter(projectId: string, costCenterId: string, invoiceIds: string[]): void {
    // Prepara il contatore per le operazioni di assegnazione completate
    let completedAssignments = 0;
    const totalAssignments = invoiceIds.length;
  
    // Usa assignInvoiceToCostCenter dallo StockMovementStore
    invoiceIds.forEach((invoiceId) => {
      this.stockMovementStore.assignInvoiceToCostCenter({
        projectId,
        invoiceId,
        costCenterId,
      });
  
      completedAssignments++;
  
      // Quando tutte le assegnazioni sono completate, notifica l'utente
      if (completedAssignments === totalAssignments) {
        if (this.warehouse) {
          this.toastService.showSuccess(
            `${totalAssignments} fatture assegnate con successo al centro di costo "${this.warehouse.name}"`
          );
        }
      }
    });
  }

  // Helper methods
  getWarehouseTypeIcon(type: WarehouseType): string {
    return type === 'PHYSICAL' ? 'pi pi-box' : 'pi pi-euro';
  }
}
