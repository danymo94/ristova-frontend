import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import {
  StockMovement,
  StockMovementDetail,
  StockMovementType,
  MovementStatus,
  MovementDetailDirection,
} from '../../../../../core/models/stock-movement.model';
import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { RawProductStore } from '../../../../../core/store/rawproduct.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-movement-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    DialogModule,
    InputTextModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './movement-details.component.html',
})
export class MovementDetailsComponent {
  @Input() movement: StockMovement | null = null;
  @Input() movementDetails: StockMovementDetail[] | null = null;
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();

  showConfirmDialog = false;
  showCancelDialog = false;

  private confirmationService = inject(ConfirmationService);
  private stockMovementStore = inject(StockMovementStore);
  private projectStore = inject(ProjectStore);
  private rawProductStore = inject(RawProductStore);
  private toastService = inject(ToastService);

  // Stato per la visualizzazione di nomi di prodotti
  productNames = new Map<string, string>();

  ngOnInit() {
    this.loadProducts();
  }

  ngOnChanges() {
    // Ricarica i prodotti quando cambiano i dettagli
    if (this.movementDetails) {
      this.loadProducts();
    }
  }

  private async loadProducts() {
    if (!this.movementDetails) return;

    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) return;

    // Pre-carica tutti i prodotti grezzi per mostrare i nomi
    this.rawProductStore.fetchProjectRawProducts({ projectId });

    // Osserva i prodotti per associare i nomi
    setTimeout(() => this.mapProductNames(), 1000);
  }

  private mapProductNames() {
    const rawProducts = this.rawProductStore.rawProducts();
    if (!rawProducts) return;

    this.movementDetails?.forEach((detail) => {
      const product = rawProducts.find((p) => p.id === detail.rawProductId);
      if (product) {
        this.productNames.set(detail.rawProductId, product.description);
      }
    });
  }

  confirmMovement() {
    if (!this.movement || !this.movement.id) return;

    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.confirmationService.confirm({
      message:
        "Sei sicuro di voler confermare questo movimento? L'operazione non può essere annullata.",
      accept: () => {
        this.stockMovementStore.updateMovementStatus({
          id: this.movement!.id!,
          status: 'confirmed',
        });
        this.showConfirmDialog = false;
      },
    });
  }

  cancelMovement() {
    if (!this.movement || !this.movement.id) return;

    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.confirmationService.confirm({
      message:
        "Sei sicuro di voler annullare questo movimento? L'operazione non può essere annullata.",
      accept: () => {
        this.stockMovementStore.updateMovementStatus({
          id: this.movement!.id!,
          status: 'cancelled',
        });
        this.showCancelDialog = false;
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

  getDirectionLabel(direction: MovementDetailDirection): string {
    return direction === 'IN' ? 'Entrata' : 'Uscita';
  }

  getDirectionIcon(direction: MovementDetailDirection): string {
    return direction === 'IN' ? 'pi pi-arrow-down' : 'pi pi-arrow-up';
  }

  getDirectionColor(direction: MovementDetailDirection): string {
    return direction === 'IN' ? 'text-green-500' : 'text-red-500';
  }

  getRawProductName(rawProductId: string): string {
    return (
      this.productNames.get(rawProductId) ||
      `Prodotto (${rawProductId.substring(0, 8)})`
    );
  }

  canConfirmMovement(): boolean {
    return this.movement?.status === 'draft';
  }

  canCancelMovement(): boolean {
    return this.movement?.status === 'draft';
  }

  closeDetails() {
    this.close.emit();
  }
}
