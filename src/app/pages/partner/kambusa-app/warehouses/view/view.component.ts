import { ChipModule } from 'primeng/chip';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  Injector,
  OnInit,
  OnChanges,
  SimpleChanges,
  runInInjectionContext,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// PrimeNG imports
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';

// Models
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';

// Store
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';

@Component({
  selector: 'app-warehouse-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TagModule,
    BadgeModule,
    ButtonModule,
    TooltipModule,
    ChipModule,
    ProgressBarModule,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class WarehouseViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() warehouse: Warehouse | null = null;
  @Input() viewMode: 'card' | 'detail' | 'list-item' = 'card';

  @Output() onDetails = new EventEmitter<Warehouse>();
  @Output() onEdit = new EventEmitter<Warehouse>();
  @Output() onDelete = new EventEmitter<Warehouse>();
  @Output() onToggleStatus = new EventEmitter<Warehouse>();
  @Output() onAssignInvoices = new EventEmitter<Warehouse>();

  // Inject stores
  private warehouseStore = inject(WarehouseStore);
  private projectStore = inject(ProjectStore);

  // Warehouse economic values
  warehouseValue: number = 0;
  totalInValue: number = 0;
  totalOutValue: number = 0;
  loadingValues: boolean = false;

  ngOnInit(): void {
    if (this.warehouse?.id && this.viewMode === 'card') {
      // Ottieni i valori dalle statistiche warehouse se disponibili
      this.updateEconomicValuesFromStats();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Quando cambia il warehouse, aggiorna i valori economici dalle statistiche
    if (
      changes['warehouse'] &&
      this.warehouse?.id &&
      this.viewMode === 'card'
    ) {
      this.updateEconomicValuesFromStats();
    }
  }

  ngOnDestroy(): void {
    // Non ci sono più sottoscrizioni da gestire
  }

  private updateEconomicValuesFromStats(): void {
    if (!this.warehouse) return;
    
    // Usa le statistiche già presenti nel warehouse
    this.warehouseValue = this.warehouse.statistics?.stockValue || 0;
    
    if (this.warehouse.type === 'PHYSICAL') {
      this.totalInValue = this.warehouse.statistics?.stockValue || 0;
      this.totalOutValue = this.warehouse.statistics?.totalStock || 0;
    } else if (this.warehouse.type === 'COST_CENTER') {
      this.totalOutValue = this.warehouse.statistics?.stockValue || 0;
      this.warehouseValue = this.totalOutValue;
    }
  }

  private resetEconomicValues(): void {
    this.warehouseValue = 0;
    this.totalInValue = 0;
    this.totalOutValue = 0;
  }

  // Helper methods for warehouse display
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

  // Event handlers
  viewDetails(): void {
    if (this.warehouse) {
      this.onDetails.emit(this.warehouse);
    }
  }

  editWarehouse(): void {
    if (this.warehouse) {
      this.onEdit.emit(this.warehouse);
    }
  }

  deleteWarehouse(): void {
    if (this.warehouse) {
      this.onDelete.emit(this.warehouse);
    }
  }

  toggleStatus(): void {
    if (this.warehouse) {
      this.onToggleStatus.emit(this.warehouse);
    }
  }

  assignInvoices(): void {
    if (this.warehouse) {
      this.onAssignInvoices.emit(this.warehouse);
    }
  }
}