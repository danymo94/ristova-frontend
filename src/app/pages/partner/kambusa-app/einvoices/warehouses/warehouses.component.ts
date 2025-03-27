import {
  Component,
  OnInit,
  inject,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { ProgressBarModule } from 'primeng/progressbar';
import { DragDropModule } from 'primeng/dragdrop';
import { SkeletonModule } from 'primeng/skeleton';

import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { EInvoice } from '../../../../../core/models/einvoice.model';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    TabViewModule,
    BadgeModule,
    TooltipModule,
    DropdownModule,
    ProgressBarModule,
    DragDropModule,
    SkeletonModule,
  ],
  templateUrl: './warehouses.component.html',
  styleUrls: ['./warehouses.component.scss'],
})
export class WarehousesComponent implements OnInit, OnChanges {
  @Input() projectId: string = '';
  @Input() invoice: EInvoice | null = null;
  @Input() mode: 'normal' | 'dropTarget' = 'normal';
  @Output() onWarehouseSelected = new EventEmitter<Warehouse>();
  @Output() onInvoiceDropped = new EventEmitter<{
    invoiceId: string;
    warehouseId: string;
  }>();

  // Nuovo stato per il tipo di visualizzazione
  viewType: 'warehouse' | 'costcenter' = 'warehouse';

  private warehouseStore = inject(WarehouseStore);

  physicalWarehouses: Warehouse[] = [];
  costCenters: Warehouse[] = [];
  loading = false;
  dragOverWarehouseId: string | null = null;

  // Selettori dai segnali dello store
  get warehouses() {
    return this.warehouseStore.warehouses();
  }

  get isLoading() {
    return this.warehouseStore.loading();
  }

  constructor() {
    // Utilizziamo effect() per reagire ai cambiamenti del segnale warehouses
    effect(() => {
      const warehousesData = this.warehouses;
      if (warehousesData) {
        this.filterWarehouses();
      }
    });
  }

  ngOnInit(): void {
    if (this.projectId) {
      this.loadWarehouses();
    }

    // Rimuoviamo questa parte che causa l'errore
    // this.warehouseStore.warehouses.subscribe((warehouses) => {
    //   if (warehouses) {
    //     this.filterWarehouses();
    //   }
    // });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['projectId'] &&
      !changes['projectId'].firstChange &&
      this.projectId
    ) {
      this.loadWarehouses();
    }
  }

  loadWarehouses(): void {
    this.warehouseStore.fetchProjectWarehouses({
      projectId: this.projectId,
    });
  }

  onTabChange(event: any): void {
    // Possiamo usare questo evento per caricare dati specifici se necessario
  }

  filterWarehouses(): void {
    if (!this.warehouses) return;

    this.physicalWarehouses = this.warehouses.filter(
      (w) => w.type === 'PHYSICAL' && w.isActive
    );

    this.costCenters = this.warehouses.filter(
      (w) => w.type === 'COST_CENTER' && w.isActive
    );
  }

  selectWarehouse(warehouse: Warehouse): void {
    this.onWarehouseSelected.emit(warehouse);
  }

  // Gestione eventi drag and drop
  onDragEnter(event: any, warehouseId: string): void {
    if (this.mode === 'dropTarget') {
      this.dragOverWarehouseId = warehouseId;
    }
  }

  onDragLeave(event: any): void {
    this.dragOverWarehouseId = null;
  }

  onDrop(event: any, warehouseId: string): void {
    if (this.mode !== 'dropTarget') return;

    this.dragOverWarehouseId = null;
    const invoiceId = event.dataTransfer.getData('invoiceId');
    if (invoiceId) {
      this.onInvoiceDropped.emit({ invoiceId, warehouseId });
    }
  }

  onDragOver(event: any): void {
    if (this.mode === 'dropTarget') {
      event.preventDefault();
    }
  }

  // Nuovo metodo per cambiare la vista
  changeView(type: 'warehouse' | 'costcenter'): void {
    this.viewType = type;
  }

  // Helper per calcolare le statistiche
  getProductCount(warehouse: Warehouse): number {
    return warehouse.statistics?.productCount || 0;
  }

  getTotalValue(warehouse: Warehouse): number {
    return warehouse.statistics?.stockValue || 0;
  }

  getLastMovement(warehouse: Warehouse): string {
    return warehouse.statistics?.lastMovementDate || '';
  }
}
