import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { AuthStore } from '../../../../core/store/auth.signal-store';
import {
  DepartmentService,
  Department,
  DepartmentCreateParams,
  DepartmentUpdateParams,
  SalesType,
} from '../../../../core/services/api/cassa-cloud/department.service';
import {
  TaxService,
  Tax,
} from '../../../../core/services/api/cassa-cloud/tax.service';
import { Project } from '../../../../core/models/project.model';
import { finalize } from 'rxjs/operators';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import { ColorPickerModule } from 'primeng/colorpicker';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    DialogModule,
    CheckboxModule,
    DropdownModule,
    InputNumberModule,
    SelectButtonModule,
    ColorPickerModule,
  ],
  templateUrl: './departments.component.html',
  styles: [
    `
      .empty-state {
        text-align: center;
        padding: 80px 20px;
        color: #666;
      }
      .empty-state i {
        font-size: 5rem;
        color: #d1d5db;
        margin-bottom: 1.5rem;
      }
      .empty-state h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }
      .empty-state p {
        max-width: 500px;
        margin: 0 auto;
      }
      .color-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: inline-block;
        margin-right: 8px;
        vertical-align: middle;
      }
    `,
  ],
})
export class DepartmentsComponent implements OnInit {
  // Inject services
  private projectStore = inject(ProjectStore);
  private authStore = inject(AuthStore);
  private departmentService = inject(DepartmentService);
  private taxService = inject(TaxService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);

  // State signals
  selectedProject = this.projectStore.selectedProject;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;

  // Component state
  departments = signal<Department[] | null>(null);
  filteredDepartments = signal<Department[] | null>(null);
  taxes = signal<Tax[] | null>(null);
  loading = signal<boolean>(false);
  loadingTaxes = signal<boolean>(false);
  error = signal<string | null>(null);
  searchQuery = '';

  // State per la gestione del dialogo di modifica
  editDialogVisible = signal<boolean>(false);
  editingDepartment = signal<Department | null>(null);
  editForm!: FormGroup;
  updatingDepartment = signal<boolean>(false);

  // State per la gestione del dialogo di creazione
  createDialogVisible = signal<boolean>(false);
  creatingDepartment = signal<boolean>(false);
  createForm!: FormGroup;

  // Opzioni per salesType
  salesTypeOptions = [
    { label: 'Beni', value: SalesType.GOODS },
    { label: 'Servizi', value: SalesType.SERVICES },
  ];

  // Lista di colori predefiniti
  colorOptions = [
    'd177ab', // Rosa acceso
    '7e4e60', // Bordeaux
    'ae7ff9', // Viola chiaro
    'bfa4d6', // Lavanda
    '61c0b6', // Acquamarina
    '3e767a', // Verde acqua scuro
    '98c32c', // Verde lime
    '49b76c', // Verde medio
    '70a8eb', // Azzurro cielo
    '0a7cad', // Blu oceano
    '94d4ef', // Celeste chiaro
    'ebbd1d', // Giallo oro
    'ffd993', // Beige/pesca
    'a88a5c', // Marrone chiaro
    'e8864a', // Arancione chiaro
    'db4925', // Arancione scuro
    'cccccc', // Grigio chiaro
    '7f7f7f', // Grigio medio
    '333333', // Grigio scuro
  ];

  constructor(private fb: FormBuilder) {
    // Effect to track project changes and fetch departments when appropriate
    effect(() => {
      const project = this.selectedProject();
      if (
        project &&
        project.CCConnection &&
        project.CCApiKey &&
        project.CCSalesPointId
      ) {
        this.fetchDepartments(project);
        this.fetchTaxes(project); // Carica anche le tasse per i form
      } else {
        this.departments.set(null);
        this.filteredDepartments.set(null);
        this.taxes.set(null);
      }
    });

    // Inizializza i form
    this.initEditForm();
    this.initCreateForm();
  }

  ngOnInit(): void {
    // Initialize component if needed
  }

  /**
   * Inizializza il form per la modifica dei dipartimenti
   */
  initEditForm(): void {
    this.editForm = this.fb.group({
      description: ['', Validators.required],
      descriptionLabel: ['', Validators.required],
      descriptionReceipt: ['', Validators.required],
      idTax: ['', Validators.required],
      color: ['#4CAF50', Validators.required], // Default color: green
      amountLimit: [null],
      externalId: [''],
      salesType: [SalesType.GOODS, Validators.required],
    });
  }

  /**
   * Inizializza il form per la creazione di un nuovo dipartimento
   */
  initCreateForm(): void {
    this.createForm = this.fb.group({
      description: ['', Validators.required],
      descriptionLabel: ['', Validators.required],
      descriptionReceipt: ['', Validators.required],
      idTax: ['', Validators.required],
      color: ['#4CAF50', Validators.required], // Default color: green
      amountLimit: [null],
      externalId: [''],
      salesType: [SalesType.GOODS, Validators.required],
    });

    // Aggiungere logica per sincronizzare description e label se necessario
    this.createForm.get('description')?.valueChanges.subscribe((value) => {
      if (!this.createForm.get('descriptionLabel')?.dirty) {
        this.createForm.get('descriptionLabel')?.setValue(value);
      }
      if (!this.createForm.get('descriptionReceipt')?.dirty) {
        this.createForm.get('descriptionReceipt')?.setValue(value);
      }
    });
  }

  /**
   * Apre il dialogo di modifica per un dipartimento specifico
   */
  openEditDialog(id: string): void {
    const department = this.departments()?.find((d) => d.id === id);
    if (!department) {
      this.toastService.showError('Dipartimento non trovato');
      return;
    }

    this.editingDepartment.set(department);

    // Popola il form con i dati del dipartimento
    this.editForm.patchValue({
      description: department.description,
      descriptionLabel: department.descriptionLabel,
      descriptionReceipt: department.descriptionReceipt,
      idTax: department.idTax,
      color: department.color,
      amountLimit: department.amountLimit || null,
      externalId: department.externalId || '',
      salesType: department.salesType,
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di modifica
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingDepartment.set(null);
    this.editForm.reset({
      color: '#4CAF50',
      salesType: SalesType.GOODS,
    });
  }

  /**
   * Salva le modifiche al dipartimento
   */
  saveDepartmentChanges(): void {
    if (this.editForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();
    const departmentToEdit = this.editingDepartment();

    if (!project || !project.CCApiKey || !departmentToEdit) {
      this.toastService.showError("Dati mancanti per l'aggiornamento");
      return;
    }

    // Ottieni i valori dal form
    const formValues = this.editForm.value;

    // Crea un oggetto pulito rimuovendo i campi vuoti o null
    const updateParams: DepartmentUpdateParams = {};

    // Aggiungi solo i campi con valori effettivi
    if (formValues.description)
      updateParams.description = formValues.description;
    if (formValues.descriptionLabel)
      updateParams.descriptionLabel = formValues.descriptionLabel;
    if (formValues.descriptionReceipt)
      updateParams.descriptionReceipt = formValues.descriptionReceipt;
    if (formValues.idTax) updateParams.idTax = formValues.idTax;
    if (formValues.color) updateParams.color = formValues.color;
    if (formValues.externalId && formValues.externalId.trim() !== '')
      updateParams.externalId = formValues.externalId;
    if (formValues.salesType) updateParams.salesType = formValues.salesType;

    // amountLimit può essere null, ma vogliamo includerlo esplicitamente solo se è un numero
    if (
      formValues.amountLimit !== null &&
      formValues.amountLimit !== undefined &&
      formValues.amountLimit !== ''
    ) {
      updateParams.amountLimit = formValues.amountLimit;
    }

    // Debug: stampa la richiesta che verrà inviata
    console.log('Sending department update:', JSON.stringify(updateParams));

    this.updatingDepartment.set(true);

    this.departmentService
      .updateDepartment(project.CCApiKey, departmentToEdit.id, updateParams)
      .pipe(finalize(() => this.updatingDepartment.set(false)))
      .subscribe({
        next: (updatedDepartmentOrVoid) => {
          // Aggiorna il dipartimento nell'elenco
          const currentDepartments = this.departments() || [];

          // Se la risposta è void (204 No Content), costruiamo un oggetto department aggiornato
          // basato sui valori del form
          const updatedDepartment = (updatedDepartmentOrVoid as Department) || {
            ...departmentToEdit,
            ...updateParams,
          };

          // Trova la tassa corrispondente per visualizzarla nella tabella
          const taxInfo = this.taxes()?.find(
            (tax) => tax.id === updatedDepartment.idTax
          );
          if (taxInfo) {
            updatedDepartment.tax = taxInfo;
          }

          const updatedDepartments = currentDepartments.map((d) =>
            d.id === departmentToEdit.id ? updatedDepartment : d
          );

          this.departments.set(updatedDepartments);
          this.filteredDepartments.set(updatedDepartments);

          this.toastService.showSuccess('Dipartimento aggiornato con successo');
          this.closeEditDialog();
        },
        error: (err) => {
          console.error('Error updating department:', err);
          console.error('Request body:', JSON.stringify(updateParams));
          this.toastService.showError(
            err.message || "Errore durante l'aggiornamento del dipartimento"
          );
        },
      });
  }

  /**
   * Apre il dialogo di creazione di un nuovo dipartimento
   */
  openCreateDialog(): void {
    this.createForm.reset({
      color: '#4CAF50',
      salesType: SalesType.GOODS,
    });
    this.createDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di creazione
   */
  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset({
      color: '#4CAF50',
      salesType: SalesType.GOODS,
    });
  }

  /**
   * Gestisce il cambio di visibilità del dialogo di creazione
   */
  onCreateDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeCreateDialog();
    } else {
      this.createDialogVisible.set(true);
    }
  }

  /**
   * Crea un nuovo dipartimento
   */
  createDepartment(): void {
    if (this.createForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();

    if (!project || !project.CCApiKey || !project.CCSalesPointId) {
      this.toastService.showError('Dati del progetto mancanti');
      return;
    }

    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      this.toastService.showError('ID punto vendita non valido');
      return;
    }

    // Ottieni i valori dal form
    const formValues = this.createForm.value;

    // Prepara i parametri obbligatori per la creazione
    const createParams: DepartmentCreateParams = {
      description: formValues.description,
      descriptionLabel: formValues.descriptionLabel,
      descriptionReceipt: formValues.descriptionReceipt,
      idTax: formValues.idTax,
      color: formValues.color,
      idSalesPoint: salesPointId,
      salesType: formValues.salesType,
    };

    // Aggiungi i parametri opzionali solo se presenti
    if (
      formValues.amountLimit !== null &&
      formValues.amountLimit !== undefined &&
      formValues.amountLimit !== ''
    ) {
      createParams.amountLimit = formValues.amountLimit;
    }

    if (formValues.externalId && formValues.externalId.trim() !== '') {
      createParams.externalId = formValues.externalId;
    }

    // Debug: stampa la richiesta
    console.log('Creating new department:', JSON.stringify(createParams));

    this.creatingDepartment.set(true);

    this.departmentService
      .createDepartment(project.CCApiKey, createParams)
      .pipe(finalize(() => this.creatingDepartment.set(false)))
      .subscribe({
        next: (newDepartment) => {
          // Trova la tassa corrispondente per visualizzarla nella tabella
          const taxInfo = this.taxes()?.find(
            (tax) => tax.id === newDepartment.idTax
          );
          if (taxInfo) {
            newDepartment.tax = taxInfo;
          }

          // Aggiorna l'elenco con il nuovo dipartimento
          const currentDepartments = this.departments() || [];
          this.departments.set([...currentDepartments, newDepartment]);
          this.filteredDepartments.set([...currentDepartments, newDepartment]);

          this.toastService.showSuccess('Dipartimento creato con successo');
          this.closeCreateDialog();
        },
        error: (err) => {
          console.error('Error creating department:', err);
          console.error('Request body:', JSON.stringify(createParams));
          this.toastService.showError(
            err.message || 'Errore durante la creazione del dipartimento'
          );
        },
      });
  }

  /**
   * Recupera i dipartimenti da Cassa in Cloud per il progetto selezionato
   */
  fetchDepartments(project: Project): void {
    if (!project.CCApiKey || !project.CCSalesPointId) {
      this.error.set('API Key o ID punto vendita mancante');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Convert CCSalesPointId to number (assuming it's stored as string in the Project model)
    const salesPointId = parseInt(project.CCSalesPointId, 10);

    if (isNaN(salesPointId)) {
      this.error.set('ID punto vendita non valido');
      this.loading.set(false);
      return;
    }

    this.departmentService
      .getDepartmentsBySalesPoint(project.CCApiKey, salesPointId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.departments.set(response.departments);
          this.filteredDepartments.set(response.departments);

          if (response.departments.length === 0) {
            this.toastService.showInfo(
              'Nessun dipartimento trovato per questo punto vendita'
            );
          }
        },
        error: (err) => {
          console.error('Error fetching departments:', err);
          this.error.set(
            err.message || 'Errore durante il recupero dei dipartimenti'
          );
          this.toastService.showError(this.error() || '');
        },
      });
  }

  /**
   * Recupera le tasse da Cassa in Cloud per il progetto selezionato
   */
  fetchTaxes(project: Project): void {
    if (!project.CCApiKey || !project.CCSalesPointId) {
      return;
    }

    this.loadingTaxes.set(true);

    // Convert CCSalesPointId to number
    const salesPointId = parseInt(project.CCSalesPointId, 10);

    if (isNaN(salesPointId)) {
      this.loadingTaxes.set(false);
      return;
    }

    this.taxService
      .getTaxesBySalesPoint(project.CCApiKey, salesPointId)
      .pipe(finalize(() => this.loadingTaxes.set(false)))
      .subscribe({
        next: (response) => {
          this.taxes.set(response.taxes);
        },
        error: (err) => {
          console.error('Error fetching taxes:', err);
        },
      });
  }

  /**
   * Filtra i dipartimenti in base alla query di ricerca
   */
  filterDepartments(query: string): void {
    const departmentsValue = this.departments();

    if (!departmentsValue || !query) {
      this.filteredDepartments.set(departmentsValue);
      return;
    }

    const filtered = departmentsValue.filter((department) =>
      department.description.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredDepartments.set(filtered);
  }

  /**
   * Aggiorna i dati dei dipartimenti
   */
  refreshDepartments(): void {
    const project = this.selectedProject();
    if (project) {
      this.fetchDepartments(project);
      this.fetchTaxes(project);
    }
  }

  /**
   * Mostra i dettagli di un dipartimento (ora apre il dialog di modifica)
   */
  selectDepartment(id: string): void {
    this.openEditDialog(id);
  }

  /**
   * Gestisce la cancellazione di un dipartimento
   */
  async deleteDepartment(event: Event, id: string): Promise<void> {
    event.preventDefault();

    const project = this.selectedProject();
    if (!project || !project.CCApiKey) {
      this.toastService.showError('Dati del progetto mancanti');
      return;
    }

    try {
      // Utilizziamo il ConfirmDialogService personalizzato
      const result = await this.confirmDialogService.confirm().toPromise();
      if (!result) return;

      this.loading.set(true);

      this.departmentService
        .deleteDepartment(project.CCApiKey || '', id)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => {
            // Rimuovi il dipartimento eliminato dall'elenco
            const currentDepartments = this.departments() || [];
            const updatedDepartments = currentDepartments.filter(
              (dept) => dept.id !== id
            );

            this.departments.set(updatedDepartments);
            this.filteredDepartments.set(updatedDepartments);

            this.toastService.showSuccess(
              'Dipartimento eliminato con successo'
            );
          },
          error: (err) => {
            console.error('Error deleting department:', err);
            this.toastService.showError(
              err.message || "Errore durante l'eliminazione del dipartimento"
            );
          },
        });
    } catch (error) {
      console.error('Error during delete confirmation:', error);
    }
  }

  /**
   * Gestisce il cambio di visibilità del dialogo di modifica
   */
  onDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeEditDialog();
    } else {
      this.editDialogVisible.set(true);
    }
  }

  /**
   * Ottiene il nome della tassa dato l'ID
   */
  getTaxName(taxId: string): string {
    const tax = this.taxes()?.find((t) => t.id === taxId);
    return tax ? tax.description : 'N/A';
  }

  /**
   * Ottiene la classe di colore per salesType
   */
  getSalesTypeClass(type: SalesType): string {
    return type === SalesType.GOODS
      ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded'
      : 'bg-green-100 text-green-800 px-2 py-1 rounded';
  }
}
