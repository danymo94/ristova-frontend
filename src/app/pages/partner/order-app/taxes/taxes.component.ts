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
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { AuthStore } from '../../../../core/store/auth.signal-store';
import {
  TaxService,
  Tax,
  NaturaIvaEsente,
  TaxUpdateParams,
  TaxCreateParams,
} from '../../../../core/services/api/cassa-cloud/tax.service';
import { Project } from '../../../../core/models/project.model';
import { finalize } from 'rxjs/operators';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';

@Component({
  selector: 'app-taxes',
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
  ],
  templateUrl: './taxes.component.html',
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
    `,
  ],
})
export class TaxesComponent implements OnInit {
  // Inject services
  private projectStore = inject(ProjectStore);
  private authStore = inject(AuthStore);
  private taxService = inject(TaxService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);

  // State signals
  selectedProject = this.projectStore.selectedProject;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;

  // Component state
  taxes = signal<Tax[] | null>(null);
  filteredTaxes = signal<Tax[] | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  searchQuery = '';

  // State per la gestione del dialogo di modifica
  editDialogVisible = signal<boolean>(false);
  editingTax = signal<Tax | null>(null);
  editForm!: FormGroup;
  updatingTax = signal<boolean>(false);

  // State per la gestione del dialogo di creazione
  createDialogVisible = signal<boolean>(false);
  creatingTax = signal<boolean>(false);
  createForm!: FormGroup;

  // Opzioni per natura IVA
  naturaTaxOptions = [
    { label: 'Escluso Art. 15', value: NaturaIvaEsente.N1 },
    { label: 'Non soggetto', value: NaturaIvaEsente.N2 },
    { label: 'Non imponibile', value: NaturaIvaEsente.N3 },
    { label: 'Esente', value: NaturaIvaEsente.N4 },
    { label: 'Regime del margine', value: NaturaIvaEsente.N5 },
    { label: 'Inversione contabile', value: NaturaIvaEsente.N6 },
  ];

  constructor(private fb: FormBuilder) {
    // Effect to track project changes and fetch taxes when appropriate
    effect(() => {
      const project = this.selectedProject();
      if (
        project &&
        project.CCConnection &&
        project.CCApiKey &&
        project.CCSalesPointId
      ) {
        this.fetchTaxes(project);
      } else {
        this.taxes.set(null);
        this.filteredTaxes.set(null);
      }
    });

    // Inizializza il form di modifica
    this.initEditForm();

    // Inizializza il form di creazione
    this.initCreateForm();
  }

  ngOnInit(): void {
    // Initialize component if needed
  }

  /**
   * Inizializza il form per la modifica delle tasse
   */
  initEditForm(): void {
    this.editForm = this.fb.group({
      description: ['', Validators.required],
      externalId: [''],
      rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]], // Aggiungiamo il campo rate con validazione
      nature: [null],
      noFiscalPrint: [false],
      noFiscalPrintOnMixedReceipt: [false],
      ventilazione: [false],
      atecoCode: [''],
    });

    // Aggiungi validatore condizionale per atecoCode quando ventilazione è true
    this.editForm.get('ventilazione')?.valueChanges.subscribe((isEnabled) => {
      const atecoCodeControl = this.editForm.get('atecoCode');
      if (isEnabled) {
        atecoCodeControl?.setValidators([Validators.required]);
      } else {
        atecoCodeControl?.clearValidators();
      }
      atecoCodeControl?.updateValueAndValidity();
    });
  }

  /**
   * Inizializza il form per la creazione di una nuova tassa
   */
  initCreateForm(): void {
    this.createForm = this.fb.group({
      description: ['', Validators.required],
      rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      externalId: [''],
      nature: [null],
      noFiscalPrint: [false],
      noFiscalPrintOnMixedReceipt: [false],
      ventilazione: [false],
      atecoCode: [''],
    });

    // Aggiungi validatore condizionale per atecoCode quando ventilazione è true
    this.createForm.get('ventilazione')?.valueChanges.subscribe((isEnabled) => {
      const atecoCodeControl = this.createForm.get('atecoCode');
      if (isEnabled) {
        atecoCodeControl?.setValidators([Validators.required]);
      } else {
        atecoCodeControl?.clearValidators();
      }
      atecoCodeControl?.updateValueAndValidity();
    });

    // Aggiungi validatore condizionale per nature quando rate è zero
    this.createForm.get('rate')?.valueChanges.subscribe((value) => {
      const natureControl = this.createForm.get('nature');
      if (value === 0) {
        natureControl?.setValidators([Validators.required]);
      } else {
        natureControl?.clearValidators();
      }
      natureControl?.updateValueAndValidity();
    });
  }

  /**
   * Apre il dialogo di modifica per una tassa specifica
   */
  openEditDialog(id: string): void {
    const tax = this.taxes()?.find((t) => t.id === id);
    if (!tax) {
      this.toastService.showError('Tassa non trovata');
      return;
    }

    this.editingTax.set(tax);

    // Popola il form con i dati della tassa
    this.editForm.patchValue({
      description: tax.description,
      externalId: tax.externalId || '',
      rate: tax.rate, // Aggiungiamo il valore dell'aliquota
      nature: tax.nature || null,
      noFiscalPrint: tax.noFiscalPrint || false,
      noFiscalPrintOnMixedReceipt: tax.noFiscalPrintOnMixedReceipt || false,
      ventilazione: tax.ventilazione || false,
      atecoCode: tax.atecoCode || '',
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di modifica
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingTax.set(null);
    this.editForm.reset();
  }

  /**
   * Salva le modifiche alla tassa
   */
  saveTaxChanges(): void {
    if (this.editForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();
    const taxToEdit = this.editingTax();

    if (!project || !project.CCApiKey || !taxToEdit) {
      this.toastService.showError("Dati mancanti per l'aggiornamento");
      return;
    }

    // Ottieni i valori dal form
    const formValues = this.editForm.value;

    // Crea un oggetto pulito rimuovendo i campi vuoti o null
    const updateParams: TaxUpdateParams = {};

    // Aggiungi solo i campi con valori effettivi
    if (formValues.description)
      updateParams.description = formValues.description;
    if (formValues.externalId && formValues.externalId.trim() !== '')
      updateParams.externalId = formValues.externalId;
    if (formValues.rate !== null && formValues.rate !== undefined)
      updateParams.rate = formValues.rate;
    if (formValues.nature) updateParams.nature = formValues.nature;

    // Per i campi booleani, includi sempre perché possono essere false intenzionalmente
    updateParams.noFiscalPrint = formValues.noFiscalPrint;
    updateParams.noFiscalPrintOnMixedReceipt =
      formValues.noFiscalPrintOnMixedReceipt;
    updateParams.ventilazione = formValues.ventilazione;

    // Aggiungi atecoCode solo se ventilazione è true e il campo non è vuoto
    if (
      formValues.ventilazione &&
      formValues.atecoCode &&
      formValues.atecoCode.trim() !== ''
    ) {
      updateParams.atecoCode = formValues.atecoCode;
    }

    // Debug: stampa la richiesta che verrà inviata
    console.log('Sending tax update:', JSON.stringify(updateParams));

    this.updatingTax.set(true);

    this.taxService
      .updateTax(project.CCApiKey, taxToEdit.id, updateParams)
      .pipe(finalize(() => this.updatingTax.set(false)))
      .subscribe({
        next: (updatedTaxOrVoid) => {
          // Aggiorna la tassa nell'elenco
          const currentTaxes = this.taxes() || [];

          // Se la risposta è void (204 No Content), costruiamo un oggetto tax aggiornato
          // basato sui valori del form
          const updatedTax = (updatedTaxOrVoid as Tax) || {
            ...taxToEdit,
            ...updateParams,
          };

          const updatedTaxes = currentTaxes.map((t) =>
            t.id === taxToEdit.id ? updatedTax : t
          );

          this.taxes.set(updatedTaxes);
          this.filteredTaxes.set(updatedTaxes);

          this.toastService.showSuccess('Tassa aggiornata con successo');
          this.closeEditDialog();
        },
        error: (err) => {
          console.error('Error updating tax:', err);
          console.error('Request body:', JSON.stringify(updateParams));
          this.toastService.showError(
            err.message || "Errore durante l'aggiornamento della tassa"
          );
        },
      });
  }

  /**
   * Apre il dialogo di creazione di una nuova tassa
   */
  openCreateDialog(): void {
    this.createForm.reset({
      rate: 0,
      noFiscalPrint: false,
      noFiscalPrintOnMixedReceipt: false,
      ventilazione: false,
    });
    this.createDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di creazione
   */
  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset();
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
   * Crea una nuova tassa
   */
  createTax(): void {
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

    // Crea un oggetto pulito rimuovendo i campi vuoti o null
    const createParams: Partial<TaxCreateParams> = {
      idSalesPoint: salesPointId, // Campo obbligatorio
      description: formValues.description, // Campo obbligatorio
      rate: formValues.rate, // Campo obbligatorio
    };

    // Aggiungi solo i campi con valori effettivi
    if (formValues.externalId && formValues.externalId.trim() !== '')
      createParams.externalId = formValues.externalId;
    if (formValues.nature) createParams.nature = formValues.nature;

    // Per i campi booleani, includi sempre perché possono essere false intenzionalmente
    createParams.noFiscalPrint = formValues.noFiscalPrint;
    createParams.noFiscalPrintOnMixedReceipt =
      formValues.noFiscalPrintOnMixedReceipt;
    createParams.ventilazione = formValues.ventilazione;

    // Aggiungi atecoCode solo se ventilazione è true e il campo non è vuoto
    if (
      formValues.ventilazione &&
      formValues.atecoCode &&
      formValues.atecoCode.trim() !== ''
    ) {
      createParams.atecoCode = formValues.atecoCode;
    }

    // Debug: stampa la richiesta
    console.log('Creating new tax:', JSON.stringify(createParams));

    this.creatingTax.set(true);

    this.taxService
      .createTax(project.CCApiKey, createParams as TaxCreateParams)
      .pipe(finalize(() => this.creatingTax.set(false)))
      .subscribe({
        next: (newTax) => {
          // Aggiorna l'elenco con la nuova tassa
          const currentTaxes = this.taxes() || [];
          this.taxes.set([...currentTaxes, newTax]);
          this.filteredTaxes.set([...currentTaxes, newTax]);

          this.toastService.showSuccess('Tassa creata con successo');
          this.closeCreateDialog();
        },
        error: (err) => {
          console.error('Error creating tax:', err);
          console.error('Request body:', JSON.stringify(createParams));
          this.toastService.showError(
            err.message || 'Errore durante la creazione della tassa'
          );
        },
      });
  }

  /**
   * Fetches taxes from Cassa in Cloud for the selected project
   */
  fetchTaxes(project: Project): void {
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

    this.taxService
      .getTaxesBySalesPoint(project.CCApiKey, salesPointId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.taxes.set(response.taxes);
          this.filteredTaxes.set(response.taxes);

          if (response.taxes.length === 0) {
            this.toastService.showInfo(
              'Nessuna tassa trovata per questo punto vendita'
            );
          }
        },
        error: (err) => {
          console.error('Error fetching taxes:', err);
          this.error.set(
            err.message || 'Errore durante il recupero delle tasse'
          );
          this.toastService.showError(this.error() || '');
        },
      });
  }

  /**
   * Filters taxes based on search query
   */
  filterTaxes(query: string): void {
    const taxesValue = this.taxes();

    if (!taxesValue || !query) {
      this.filteredTaxes.set(taxesValue);
      return;
    }

    const filtered = taxesValue.filter((tax) =>
      tax.description.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredTaxes.set(filtered);
  }

  /**
   * Refreshes taxes data
   */
  refreshTaxes(): void {
    const project = this.selectedProject();
    if (project) {
      this.fetchTaxes(project);
    }
  }

  /**
   * Mostra i dettagli di una tassa (ora apre il dialog di modifica)
   */
  selectTax(id: string): void {
    this.openEditDialog(id);
  }

  /**
   * Gestisce la cancellazione di una tassa
   */
  async deleteTax(event: Event, id: string): Promise<void> {
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

      this.taxService
        .deleteTax(project.CCApiKey || '', id)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => {
            // Rimuovi la tassa eliminata dall'elenco
            const currentTaxes = this.taxes() || [];
            const updatedTaxes = currentTaxes.filter((tax) => tax.id !== id);

            this.taxes.set(updatedTaxes);
            this.filteredTaxes.set(updatedTaxes);

            this.toastService.showSuccess('Tassa eliminata con successo');
          },
          error: (err) => {
            console.error('Error deleting tax:', err);
            this.toastService.showError(
              err.message || "Errore durante l'eliminazione della tassa"
            );
          },
        });
    } catch (error) {
      console.error('Error during delete confirmation:', error);
    }
  }

  /**
   * Gestisce il cambio di visibilità del dialogo
   */
  onDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeEditDialog();
    } else {
      this.editDialogVisible.set(true);
    }
  }
}
