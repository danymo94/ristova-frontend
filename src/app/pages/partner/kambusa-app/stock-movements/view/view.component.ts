import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';

// Core imports
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';
import { RawProductStore } from '../../../../../core/store/rawproduct.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

import {
  StockMovement,
  MovementStatus,
  StockMovementType,
} from '../../../../../core/models/stock-movement.model';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    DialogModule,
    TooltipModule,
    TagModule,
    CardModule,
    DividerModule,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit, OnDestroy {
  @Input() movementId: string | null = null;
  @Output() backToList = new EventEmitter<void>();

  // Injection di servizi
  private projectStore = inject(ProjectStore);
  private stockMovementStore = inject(StockMovementStore);
  private rawProductStore = inject(RawProductStore);
  private warehouseStore = inject(WarehouseStore);
  private toastService = inject(ToastService);

  // Variabili
  loading = false;
  deleteDialogVisible = false;

  // Signals condivisi dai services
  selectedProject = this.projectStore.selectedProject;
  selectedMovement = this.stockMovementStore.selectedMovement;
  movementDetails = this.stockMovementStore.movementDetails;
  rawProducts = this.rawProductStore.rawProducts;
  warehouses = this.warehouseStore.warehouses;

  // Clean up
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Carica i dettagli del movimento
    if (this.movementId) {
      const projectId = this.selectedProject()?.id;
      if (projectId) {
        this.loadMovementData(projectId, this.movementId);
      } else {
        this.toastService.showError('Nessun progetto selezionato');
        this.navigateToList();
      }
    } else {
      this.navigateToList();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMovementData(projectId: string, movementId: string): void {
    this.loading = true;

    // Carica i dettagli del movimento
    this.stockMovementStore.fetchMovement({
      projectId,
      id: movementId,
    });

    // Carica i dettagli delle righe del movimento
    this.stockMovementStore.fetchMovementDetails({
      projectId,
      id: movementId,
    });

    // Carica i dati di supporto se necessario
    if (!this.warehouses()) {
      this.warehouseStore.fetchProjectWarehouses({ projectId });
    }

    if (!this.rawProducts()) {
      this.rawProductStore.fetchProjectRawProducts({ projectId });
    }

    // Monitora il caricamento
    this.stockMovementStore.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.loading = loading;
      });

    // Controlla che il movimento esista
    setTimeout(() => {
      if (!this.selectedMovement() && !this.loading) {
        this.toastService.showError('Movimento non trovato');
        this.navigateToList();
      }
    }, 1000);
  }

  navigateToList(): void {
    this.backToList.emit();
  }

  confirmMovement(): void {
    if (!this.movementId) {
      this.toastService.showError(
        'Dati insufficienti per confermare il movimento'
      );
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.stockMovementStore.updateMovementStatus({
      projectId,
      id: this.movementId,
      status: 'confirmed' as MovementStatus,
    });
  }

  cancelMovement(): void {
    if (!this.movementId) {
      this.toastService.showError(
        'Dati insufficienti per annullare il movimento'
      );
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.stockMovementStore.updateMovementStatus({
      projectId,
      id: this.movementId,
      status: 'cancelled' as MovementStatus,
    });
  }

  openDeleteDialog(): void {
    this.deleteDialogVisible = true;
  }

  closeDeleteDialog(): void {
    this.deleteDialogVisible = false;
  }

  deleteMovement(): void {
    if (!this.movementId) {
      this.toastService.showError(
        'Dati insufficienti per eliminare il movimento'
      );
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.stockMovementStore.deleteMovement({
      projectId,
      id: this.movementId,
    });

    this.closeDeleteDialog();
    this.navigateToList();
  }

  // Utility per la visualizzazione
  getMovementTypeName(type: StockMovementType | undefined): string {
    if (!type) return 'N/A';

    // Mappa dei nomi dei tipi di movimento
    const typeNames: Record<StockMovementType, string> = {
      PURCHASE: 'Acquisto',
      SALE: 'Vendita',
      INVENTORY: 'Rettifica inventario',
      TRANSFER: 'Trasferimento',
      WASTE: 'Scarico per sprechi',
      INTERNAL_USE: 'Uso interno',
      RETURN: 'Reso a fornitore',
      EXPENSE: 'Spesa (centro di costo)',
      OTHER: 'Altro',
    };

    return typeNames[type] || type;
  }

  getMovementTypeIcon(type: StockMovementType | undefined): string {
    if (!type) return 'pi pi-question';

    // Mappa delle icone per tipo di movimento
    const typeIcons: Record<StockMovementType, string> = {
      PURCHASE: 'pi pi-shopping-cart',
      SALE: 'pi pi-money-bill',
      INVENTORY: 'pi pi-sync',
      TRANSFER: 'pi pi-arrows-h',
      WASTE: 'pi pi-trash',
      INTERNAL_USE: 'pi pi-home',
      RETURN: 'pi pi-reply',
      EXPENSE: 'pi pi-euro',
      OTHER: 'pi pi-question',
    };

    return typeIcons[type] || 'pi pi-question';
  }

  getWarehouseName(warehouseId: string | undefined): string {
    if (!warehouseId) return 'N/A';
    const warehouseList = this.warehouses();
    if (!warehouseList) return 'N/A';

    const warehouse = warehouseList.find((w) => w.id === warehouseId);
    return warehouse ? warehouse.name : 'N/A';
  }

  getStatusSeverity(
    status: MovementStatus | undefined
  ): 'success' | 'danger' | 'info' | 'warn' {
    if (!status) return 'info';
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'draft':
        return 'warn';
      case 'cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }

  getStatusLabel(status: MovementStatus | undefined): string {
    if (!status) return 'N/A';
    switch (status) {
      case 'confirmed':
        return 'Confermato';
      case 'draft':
        return 'Bozza';
      case 'cancelled':
        return 'Annullato';
      default:
        return status;
    }
  }

  getProductDescription(productId: string): string {
    const products = this.rawProducts();
    if (!products) return 'Prodotto sconosciuto';

    const product = products.find((p) => p.id === productId);
    return product ? product.description : 'Prodotto sconosciuto';
  }
}
