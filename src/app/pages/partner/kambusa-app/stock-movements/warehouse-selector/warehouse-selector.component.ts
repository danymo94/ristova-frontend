import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';

@Component({
  selector: 'app-warehouse-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, SkeletonModule],
  template: `
    <!-- Ricerca -->
    <div class="p-3 border-bottom-1 border-gray-200">
      <span class="p-input-icon-left w-full">
        <i class="pi pi-search"></i>
        <input
          type="text"
          pInputText
          class="w-full"
          placeholder="Cerca..."
          [(ngModel)]="searchTerm"
          (input)="filterWarehouses()"
        />
      </span>
    </div>

    <!-- Loading state -->
    <div *ngIf="loading" class="p-3">
      <div *ngFor="let i of [1, 2, 3, 4]" class="mb-3">
        <p-skeleton height="3rem"></p-skeleton>
      </div>
    </div>

    <!-- Stato vuoto -->
    <div
      *ngIf="!loading && filteredWarehouses.length === 0"
      class="p-4 text-center"
    >
      <i class="pi pi-inbox text-4xl text-gray-400 mb-3"></i>
      <p class="mb-2">
        Nessun
        {{
          warehouseType === 'PHYSICAL' ? 'magazzino' : 'centro di costo'
        }}
        trovato
      </p>
      <small class="text-gray-500"
        >Prova a modificare i criteri di ricerca</small
      >
    </div>

    <!-- Lista warehouses -->
    <div
      *ngIf="!loading && filteredWarehouses.length > 0"
      class="warehouse-list"
    >
      <div
        *ngFor="let warehouse of filteredWarehouses"
        class="warehouse-item p-3 cursor-pointer border-bottom-1 border-gray-200"
        [class.selected]="warehouse.id === selectedWarehouseId"
        (click)="selectWarehouse(warehouse)"
      >
        <div class="flex align-items-center">
          <div class="warehouse-icon mr-3">
            <i
              class="pi"
              [ngClass]="{
                'pi-building': warehouseType === 'PHYSICAL',
                'pi-chart-pie': warehouseType === 'COST_CENTER'
              }"
            >
            </i>
          </div>
          <div class="warehouse-details">
            <div class="warehouse-name font-medium">{{ warehouse.name }}</div>
            <div
              *ngIf="warehouse.costCenterCode"
              class="warehouse-code text-sm text-gray-500"
            >
              {{ warehouse.costCenterCode }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .warehouse-list {
        max-height: 500px;
        overflow-y: auto;
      }

      .warehouse-item {
        transition: background-color 0.2s;
      }

      .warehouse-item:hover {
        background-color: var(--surface-hover);
      }

      .warehouse-item.selected {
        background-color: var(--primary-color-lighter, #e3f2fd);
      }

      .warehouse-icon {
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: var(--primary-color-lighter, #e3f2fd);
      }

      .warehouse-icon i {
        font-size: 1.2rem;
        color: var(--primary-color);
      }
    `,
  ],
})
export class WarehouseSelectorComponent {
  @Input() warehouses: Warehouse[] | null = [];
  @Input() loading = false;
  @Input() warehouseType: WarehouseType = 'PHYSICAL';
  @Input() selectedWarehouseId: string | undefined = undefined;

  @Output() warehouseSelected = new EventEmitter<Warehouse>();

  searchTerm = '';
  filteredWarehouses: Warehouse[] = [];

  ngOnChanges() {
    this.filterWarehouses();
  }

  filterWarehouses() {
    if (!this.warehouses) {
      this.filteredWarehouses = [];
      return;
    }

    // Filtra per tipo di warehouse (magazzino o centro di costo)
    let filtered = this.warehouses.filter((w) => w.type === this.warehouseType);

    // Applica il filtro di ricerca se presente
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.costCenterCode?.toLowerCase().includes(term) ||
          w.description?.toLowerCase().includes(term)
      );
    }

    this.filteredWarehouses = filtered;
  }

  selectWarehouse(warehouse: Warehouse) {
    this.warehouseSelected.emit(warehouse);
  }
}
