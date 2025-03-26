import { ChipModule } from 'primeng/chip';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG imports
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

// Models
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';

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
    ChipModule
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class WarehouseViewComponent {
  @Input() warehouse: Warehouse | null = null;
  @Input() viewMode: 'card' | 'detail' | 'list-item' = 'card';

  @Output() onDetails = new EventEmitter<Warehouse>();
  @Output() onEdit = new EventEmitter<Warehouse>();
  @Output() onDelete = new EventEmitter<Warehouse>();
  @Output() onToggleStatus = new EventEmitter<Warehouse>();
  @Output() onAssignInvoices = new EventEmitter<Warehouse>();

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
