import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';

// Core imports
import {
  Warehouse,
  UpdateWarehouseDto,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-warehouse-edit',
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
  templateUrl: './edit.component.html',
  styleUrl: './edit.component.scss',
})
export class EditComponent implements OnInit {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);
  private toastService = inject(ToastService);

  // Input properties
  @Input() warehouse: Warehouse | null = null;
  @Input() visible = false;

  // Output events
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() warehouseUpdated = new EventEmitter<void>();

  // Form data
  editingWarehouse: UpdateWarehouseDto | null = null;

  ngOnInit(): void {
    // Inizializza il form quando il componente viene creato
    this.initForm();
  }

  // Inizializza il form con i dati del magazzino
  initForm(): void {
    if (this.warehouse) {
      this.editingWarehouse = {
        name: this.warehouse.name,
        description: this.warehouse.description,
        isActive: this.warehouse.isActive,
        location: this.warehouse.location
          ? { ...this.warehouse.location }
          : undefined,
        responsible: this.warehouse.responsible
          ? { ...this.warehouse.responsible }
          : undefined,
        notes: this.warehouse.notes,
        costCenterCode: this.warehouse.costCenterCode,
        costCenterCategories: this.warehouse.costCenterCategories
          ? [...this.warehouse.costCenterCategories]
          : undefined,
      };
    }
  }

  // Close dialog method
  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  // Update warehouse method
  updateWarehouse(): void {
    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId || !this.warehouse || !this.editingWarehouse) {
      this.toastService.showError(
        'Dati insufficienti per aggiornare il magazzino'
      );
      return;
    }

    // Verifica che l'ID sia definito
    if (!this.warehouse.id) {
      this.toastService.showError('ID magazzino non valido');
      return;
    }

    // Validazione basilare
    if (!this.editingWarehouse.name) {
      this.toastService.showError('Il nome è un campo obbligatorio');
      return;
    }

    this.warehouseStore.updateWarehouse({
      projectId,
      id: this.warehouse.id,
      warehouse: this.editingWarehouse,
    });

    this.closeDialog();
    this.warehouseUpdated.emit();
  }

  // Helper methods per gestire oggetti annidati opzionali
  ensureLocationExists(): void {
    if (this.editingWarehouse && !this.editingWarehouse.location) {
      this.editingWarehouse.location = {
        address: '',
        city: '',
        postalCode: '',
        country: 'Italia',
      };
    }
  }

  ensureResponsibleExists(): void {
    if (this.editingWarehouse && !this.editingWarehouse.responsible) {
      this.editingWarehouse.responsible = {
        name: '',
        phone: '',
        email: '',
      };
    }
  }

  // Getter e setter per accedere alle proprietà annidate in modo sicuro
  getLocationAddress(): string {
    return this.editingWarehouse?.location?.address || '';
  }

  setLocationAddress(value: string): void {
    this.ensureLocationExists();
    if (this.editingWarehouse && this.editingWarehouse.location) {
      this.editingWarehouse.location.address = value;
    }
  }

  getResponsibleName(): string {
    return this.editingWarehouse?.responsible?.name || '';
  }

  setResponsibleName(value: string): void {
    this.ensureResponsibleExists();
    if (this.editingWarehouse && this.editingWarehouse.responsible) {
      this.editingWarehouse.responsible.name = value;
    }
  }

  getResponsiblePhone(): string {
    return this.editingWarehouse?.responsible?.phone || '';
  }

  setResponsiblePhone(value: string): void {
    this.ensureResponsibleExists();
    if (this.editingWarehouse && this.editingWarehouse.responsible) {
      this.editingWarehouse.responsible.phone = value;
    }
  }

  getResponsibleEmail(): string {
    return this.editingWarehouse?.responsible?.email || '';
  }

  setResponsibleEmail(value: string): void {
    this.ensureResponsibleExists();
    if (this.editingWarehouse && this.editingWarehouse.responsible) {
      this.editingWarehouse.responsible.email = value;
    }
  }

  getLocationCity(): string {
    return this.editingWarehouse?.location?.city || '';
  }

  setLocationCity(value: string): void {
    this.ensureLocationExists();
    if (this.editingWarehouse && this.editingWarehouse.location) {
      this.editingWarehouse.location.city = value;
    }
  }

  getLocationPostalCode(): string {
    return this.editingWarehouse?.location?.postalCode || '';
  }

  setLocationPostalCode(value: string): void {
    this.ensureLocationExists();
    if (this.editingWarehouse && this.editingWarehouse.location) {
      this.editingWarehouse.location.postalCode = value;
    }
  }

  getLocationCountry(): string {
    return this.editingWarehouse?.location?.country || 'Italia';
  }

  setLocationCountry(value: string): void {
    this.ensureLocationExists();
    if (this.editingWarehouse && this.editingWarehouse.location) {
      this.editingWarehouse.location.country = value;
    }
  }

  // Reset del form quando il dialog viene chiuso
  onHide(): void {
    this.visibleChange.emit(false);
    this.editingWarehouse = null;
  }

  // Metodo chiamato quando il dialog diventa visibile
  onShow(): void {
    this.initForm();
  }
}
