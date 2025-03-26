import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { Supplier } from '../../../../../core/models/supplier.model';

export interface FilterOptions {
  supplierId: string | null;
  dateRange: Date[] | null;
  minAmount: number | null;
  maxAmount: number | null;
}

export interface SupplierOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-einvoice-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    CalendarModule,
    InputNumberModule,
    ButtonModule,
  ],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
})
export class FilterComponent {
  @Input() supplierOptions: SupplierOption[] = [];
  @Input() filters: FilterOptions = {
    supplierId: null,
    dateRange: null,
    minAmount: null,
    maxAmount: null,
  };

  @Output() onApplyFilters = new EventEmitter<FilterOptions>();
  @Output() onResetFilters = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  // Creazione di una copia locale dei filtri per l'editing
  public localFilters: FilterOptions = {
    supplierId: null,
    dateRange: null,
    minAmount: null,
    maxAmount: null,
  };

  ngOnInit() {
    this.resetLocalFilters();
  }

  ngOnChanges() {
    this.resetLocalFilters();
  }

  resetLocalFilters() {
    this.localFilters = {
      supplierId: this.filters.supplierId,
      dateRange: this.filters.dateRange ? [...this.filters.dateRange] : null,
      minAmount: this.filters.minAmount,
      maxAmount: this.filters.maxAmount,
    };
  }

  applyFilters(): void {
    this.onApplyFilters.emit({ ...this.localFilters });
  }

  resetFilters(): void {
    this.localFilters = {
      supplierId: null,
      dateRange: null,
      minAmount: null,
      maxAmount: null,
    };
    this.onResetFilters.emit();
  }

  cancel(): void {
    this.resetLocalFilters();
    this.onCancel.emit();
  }
}
