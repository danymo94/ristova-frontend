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
    <!-- Toggle switch per cambio visualizzazione -->
    <div class="toggle-container">
      <div class="toggle-wrapper">
        <button
          class="toggle-button"
          [ngClass]="{ active: warehouseType === 'PHYSICAL' }"
          (click)="changeWarehouseType('PHYSICAL')"
        >
          <i class="pi pi-building mr-2"></i>
          Magazzini
        </button>
        <button
          class="toggle-button"
          [ngClass]="{ active: warehouseType === 'COST_CENTER' }"
          (click)="changeWarehouseType('COST_CENTER')"
        >
          <i class="pi pi-chart-pie mr-2"></i>
          Centri di Costo
        </button>
        <div
          class="toggle-slider"
          [ngClass]="{ costcenter: warehouseType === 'COST_CENTER' }"
        ></div>
      </div>
    </div>

    <!-- Loading state -->
    <div *ngIf="loading" class="loading-skeleton p-3">
      <div class="warehouse-grid">
        <div *ngFor="let i of [1, 2, 3, 4, 5, 6]" class="warehouse-cell">
          <p-skeleton height="100%" styleClass="mb-2"></p-skeleton>
        </div>
      </div>
    </div>

    <!-- Stato vuoto -->
    <div
      *ngIf="!loading && filteredWarehouses.length === 0"
      class="empty-state p-4 text-center"
    >
      <i class="pi pi-inbox text-4xl text-gray-400 mb-3"></i>
      <p class="mb-2">
        Nessun
        {{ warehouseType === 'PHYSICAL' ? 'magazzino' : 'centro di costo' }}
        trovato
      </p>
      <small class="text-gray-500"
        >Prova a modificare i criteri di ricerca</small
      >
    </div>

    <!-- Lista warehouses -->
    <div
      *ngIf="!loading && filteredWarehouses.length > 0"
      class="warehouse-grid"
    >
      <div *ngFor="let warehouse of filteredWarehouses" class="warehouse-cell">
        <div
          class="warehouse-card"
          [ngClass]="{
            selected: warehouse.id === selectedWarehouseId,
            'cost-center': warehouseType === 'COST_CENTER'
          }"
          (click)="selectWarehouse(warehouse)"
        >
          <div class="warehouse-icon">
            <i
              class="pi"
              [ngClass]="{
                'pi-building': warehouseType === 'PHYSICAL',
                'pi-chart-pie': warehouseType === 'COST_CENTER'
              }"
            >
            </i>
          </div>
          <div class="warehouse-content">
            <h5 class="warehouse-name">{{ warehouse.name }}</h5>
            <div *ngIf="warehouse.costCenterCode" class="cost-center-code">
              {{ warehouse.costCenterCode }}
            </div>
            <div *ngIf="warehouse.description" class="warehouse-description">
              {{ warehouse.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Toggle Switch Styles */
      .toggle-container {
        display: flex;
        justify-content: center;
        margin: 1rem 0;
      }

      .toggle-wrapper {
        position: relative;
        display: inline-flex;
        background-color: #f0f0f0;
        border-radius: 25px;
        padding: 0.25rem;
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
      }

      .toggle-button {
        position: relative;
        z-index: 1;
        padding: 0.6rem 1.2rem;
        border: none;
        background: none;
        color: #666;
        font-weight: 500;
        cursor: pointer;
        transition: color 0.3s ease;
        border-radius: 20px;
        min-width: 130px;
      }

      .toggle-button.active {
        color: white;
      }

      .toggle-slider {
        position: absolute;
        top: 0.25rem;
        left: 0.25rem;
        height: calc(100% - 0.5rem);
        width: calc(50% - 0.25rem);
        border-radius: 20px;
        background-color: #2a3f54;
        transition: transform 0.3s ease;
      }

      .toggle-slider.costcenter {
        transform: translateX(100%);
      }

      /* Grid Layout Styles */
      .warehouse-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        padding: 10px;
        max-height: 500px;
        overflow-y: auto;
      }

      .warehouse-cell {
        aspect-ratio: 1/1;
        min-height: 120px;
      }

      .warehouse-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
   
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 0.75rem;
        text-align: center;
        overflow: hidden;
      }

      .warehouse-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-color: var(--primary-color);
      }

      .warehouse-card.selected {
        background-color: var(--primary-color-lighter, #e3f2fd);
        border-color: var(--primary-color);
        transform: translateY(-3px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .warehouse-card.cost-center {
        background-color: #f0f7ff;
      }

      .warehouse-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background-color: #2a3f54;
        border-radius: 50%;
        color: white;
        margin-bottom: 0.75rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .warehouse-icon i {
        font-size: 1.25rem;
      }

      .warehouse-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      .warehouse-name {
        margin: 0 0 0.25rem 0;
        font-size: 0.9rem;
        font-weight: bold;
        color: var(--text-color);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }

      .warehouse-description {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.85rem;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        text-align: center;
      }

      .cost-center-code {
        font-size: 0.7rem;
        background-color: var(--primary-color);
        color: white;
        padding: 0.15rem 0.35rem;
        border-radius: 3px;
        margin: 0.25rem 0;
        display: inline-block;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--text-color-secondary);
      }

      .loading-skeleton {
        padding: 0.5rem;
      }

      /* Media queries per adattare il numero di colonne */
      @media screen and (min-width: 400px) {
        .warehouse-grid {
          grid-template-columns: repeat(5, 1fr);
        }
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
  @Output() warehouseTypeChange = new EventEmitter<WarehouseType>();

  searchTerm = '';
  filteredWarehouses: Warehouse[] = [];

  ngOnChanges() {
    this.filterWarehouses();
  }

  changeWarehouseType(type: WarehouseType) {
    if (this.warehouseType !== type) {
      this.warehouseType = type;
      this.warehouseTypeChange.emit(type);
      this.filterWarehouses();
    }
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
