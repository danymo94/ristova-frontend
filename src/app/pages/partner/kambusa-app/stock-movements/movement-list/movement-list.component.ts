import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import {
  StockMovement,
  StockMovementType,
  MovementStatus,
} from '../../../../../core/models/stock-movement.model';
import { WarehouseType } from '../../../../../core/models/warehouse.model';
import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-movement-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './movement-list.component.html',
})
export class MovementListComponent {
  @Input() movements: StockMovement[] | null = null;
  @Input() loading = false;
  @Input() warehouseType: WarehouseType = 'PHYSICAL';

  @Output() movementSelected = new EventEmitter<StockMovement>();

  private confirmationService = inject(ConfirmationService);
  private stockMovementStore = inject(StockMovementStore);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);

  viewMovement(movement: StockMovement) {
    this.movementSelected.emit(movement);
  }

  confirmDelete(movement: StockMovement) {
    if (!movement.id) return;

    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.confirmationService.confirm({
      message: 'Sei sicuro di voler eliminare questo movimento?',
      accept: () => {
        this.stockMovementStore.deleteMovement({
          id: movement.id!,
        });
      },
    });
  }

  getMovementTypeLabel(type: StockMovementType): string {
    switch (type) {
      case StockMovementType.PURCHASE:
        return 'Acquisto';
      case StockMovementType.SALE:
        return 'Vendita';
      case StockMovementType.TRANSFER:
        return 'Trasferimento';
      case StockMovementType.INVENTORY:
        return 'Inventario';
      case StockMovementType.WASTE:
        return 'Spreco';
      case StockMovementType.INTERNAL_USE:
        return 'Uso Interno';
      case StockMovementType.RETURN:
        return 'Reso';
      case StockMovementType.EXPENSE:
        return 'Spesa';
      case StockMovementType.OTHER:
        return 'Altro';
      default:
        return 'Sconosciuto';
    }
  }

  getMovementTypeSeverity(
    type: StockMovementType
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (type) {
      case StockMovementType.PURCHASE:
        return 'success';
      case StockMovementType.SALE:
        return 'info';
      case StockMovementType.TRANSFER:
        return 'warn';
      case StockMovementType.INVENTORY:
        return 'info';
      case StockMovementType.WASTE:
        return 'danger';
      case StockMovementType.INTERNAL_USE:
        return 'info';
      case StockMovementType.RETURN:
        return 'warn';
      case StockMovementType.EXPENSE:
        return 'danger';
      case StockMovementType.OTHER:
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'draft':
        return 'Bozza';
      case 'confirmed':
        return 'Confermato';
      case 'cancelled':
        return 'Annullato';
      default:
        return 'Bozza';
    }
  }

  getStatusSeverity(status?: string): 'success' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case 'draft':
        return 'warn';
      case 'confirmed':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'warn';
    }
  }

  canDeleteMovement(movement: StockMovement): boolean {
    // Si possono eliminare solo i movimenti in stato bozza o cancellati
    return movement.status === 'draft' || movement.status === 'cancelled';
  }
}
