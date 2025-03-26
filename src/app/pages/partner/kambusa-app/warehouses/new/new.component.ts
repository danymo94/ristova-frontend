import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';

// Models
import {
  CreateWarehouseDto,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-warehouse-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    InputSwitchModule,
    DialogModule,
  ],
  templateUrl: './new.component.html',
  styleUrl: './new.component.scss',
})
export class NewComponent {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);
  private toastService = inject(ToastService);

  // Input properties
  @Input() visible = false;

  // Output events
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() warehouseCreated = new EventEmitter<void>();

  // Form data
  newWarehouse: CreateWarehouseDto = this.getEmptyWarehouseDto();

  // Close dialog method
  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  // Create warehouse method
  createWarehouse(): void {
    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Validazione basilare
    if (!this.newWarehouse.name || !this.newWarehouse.type) {
      this.toastService.showError('Nome e tipo sono campi obbligatori');
      return;
    }

    this.warehouseStore.createWarehouse({
      projectId,
      warehouse: this.newWarehouse,
    });

    this.closeDialog();
    this.warehouseCreated.emit();
  }

  // Helper methods for creating new warehouses
  ensureNewResponsibleExists(): void {
    if (!this.newWarehouse.responsible) {
      this.newWarehouse.responsible = {
        name: '',
        phone: '',
        email: '',
      };
    }
  }

  ensureNewLocationExists(): void {
    if (!this.newWarehouse.location) {
      this.newWarehouse.location = {
        address: '',
        city: '',
        postalCode: '',
        country: 'Italia',
      };
    }
  }

  getEmptyWarehouseDto(): CreateWarehouseDto {
    return {
      name: '',
      description: '',
      type: 'PHYSICAL',
      isActive: true,
      location: {
        address: '',
        city: '',
        postalCode: '',
        country: 'Italia',
      },
      responsible: {
        name: '',
        phone: '',
        email: '',
      },
      notes: '',
    };
  }

  // Reset form data when dialog is closed
  onHide() {
    this.visibleChange.emit(false);
    this.newWarehouse = this.getEmptyWarehouseDto();
  }
}
