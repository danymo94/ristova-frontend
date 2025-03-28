import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChipModule } from 'primeng/chip';

// Core imports
import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';

@Component({
  selector: 'app-warehouse-details',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, ChipModule],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
})
export class DetailsComponent implements OnInit {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);

  // Inputs and Outputs
  @Input() warehouse: Warehouse | null = null;
  @Input() visible = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onEdit = new EventEmitter<Warehouse>();

  ngOnInit(): void {
    // Se necessario, carica i dettagli estesi del magazzino
    this.loadWarehouseDetails();
  }

  loadWarehouseDetails(): void {
    if (!this.warehouse) return;
  
    const projectId = this.projectStore.selectedProject()?.id;
    if (projectId && this.warehouse.type === 'PHYSICAL') {
      // Carica i dettagli estesi del magazzino incluse le statistiche se è un magazzino fisico
      this.warehouseStore.fetchWarehouseDetails({
        projectId,
        warehouseId: this.warehouse.id ?? '',
      });
      
      // Carichiamo anche le statistiche
      if (this.warehouse.id) {
        this.warehouseStore.fetchWarehouseStats({
          projectId,
          warehouseId: this.warehouse.id
        });
        
        // Per i magazzini fisici, carichiamo anche l'inventario
        this.warehouseStore.fetchWarehouseInventory({
          projectId,
          warehouseId: this.warehouse.id
        });
      }
    }
  }

  // Helper methods
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

  // Event handlers
  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  editWarehouse(): void {
    if (this.warehouse) {
      this.onEdit.emit(this.warehouse);
      this.closeDialog();
    }
  }
}
