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
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// Models
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import {
  WarehouseBalance,
} from '../../../../../core/models/stock-movement.model';

// Store
import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';
import { ProjectStore } from '../../../../../core/store/project.signal-store';

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
  private stockMovementStore = inject(StockMovementStore);
  private projectStore = inject(ProjectStore);

  // Warehouse economic values
  warehouseValue: number = 0;
  totalInValue: number = 0;
  totalOutValue: number = 0;
  loadingValues: boolean = false;
  private subscriptions: Map<string, Subscription> = new Map();

  private injector = inject(Injector);

  ngOnInit(): void {
    if (this.warehouse?.id && this.viewMode === 'card') {
      this.loadEconomicValues();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Quando cambia il warehouse, ricarica i valori economici
    if (
      changes['warehouse'] &&
      this.warehouse?.id &&
      this.viewMode === 'card'
    ) {
      this.loadEconomicValues();
    }
  }

  ngOnDestroy(): void {
    // Elimina tutte le sottoscrizioni
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
  }

  loadEconomicValues(): void {
    if (!this.warehouse?.id) return;

    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) return;

    // Cancella eventuali sottoscrizioni precedenti per questo magazzino
    if (this.subscriptions.has(this.warehouse.id)) {
      this.subscriptions.get(this.warehouse.id)?.unsubscribe();
      this.subscriptions.delete(this.warehouse.id);
    }

    this.loadingValues = true;
    this.resetEconomicValues();

    // Eseguiamo il metodo fetchWarehouseBalance che internamente effettua la chiamata API
    this.stockMovementStore.fetchWarehouseBalance({
      projectId,
      warehouseId: this.warehouse.id,
    });

    // Utilizziamo runInInjectionContext per fornire il contesto di injection necessario
    runInInjectionContext(this.injector, () => {
      const subscription = toObservable(
        this.stockMovementStore.warehouseBalance
      ).subscribe((balance: WarehouseBalance | null) => {
        if (balance && balance.warehouseId === this.warehouse?.id) {
          // Processa i dati solo se il balance si riferisce al magazzino corrente
          this.processWarehouseBalance(balance);
        }
        this.loadingValues = false;
      });

      // Salva la sottoscrizione nella mappa usando l'ID del magazzino come chiave
      this.subscriptions.set(this.warehouse?.id || '', subscription || '');
    });
  }

  private processWarehouseBalance(balance: WarehouseBalance): void {
    // Per magazzini fisici, usa i valori direttamente
    if (this.warehouse?.type === 'PHYSICAL') {
      this.warehouseValue = balance.totalValue || 0;
      this.totalInValue =
        balance.balance?.reduce(
          (sum: number, item: any) => sum + item.totalValue,
          0
        ) || 0;
      this.totalOutValue = balance.productCount || 0;
    }
    // Per centri di costo, il valore totale rappresenta la spesa
    else if (this.warehouse?.type === 'COST_CENTER') {
      this.totalOutValue = balance.totalValue || 0;
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
