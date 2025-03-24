import {
  AfterViewInit,
  Component,
  effect,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { KeyFilterModule } from 'primeng/keyfilter';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { CalendarModule } from 'primeng/calendar';
import { FileUploadModule } from 'primeng/fileupload';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { Project } from '../../core/models/project.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Partner } from '../../core/models/user.model';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm.service';
import {
  SalesPointService,
  SalesPoint,
} from '../../core/services/api/cassa-cloud/sales-point.service';
import { finalize } from 'rxjs/operators';
import { AuthStore } from '../../core/store/auth.signal-store';
import { ProjectStore } from '../../core/store/project.signal-store';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    KeyFilterModule,
    ReactiveFormsModule,
    TableModule,
    FormsModule,
    DropdownModule,
    ToggleButtonModule,
    InputGroupModule,
    InputGroupAddonModule,
    ButtonModule,
    CalendarModule,
    FileUploadModule,
    AutoCompleteModule,
    CheckboxModule,
    DialogModule,
    TagModule,
    TooltipModule,
    SelectButtonModule,
  ],
  templateUrl: './projects.component.html',
  styles: [
    `
      /* Stile per le icone nei bottoni delle azioni */
      .p-button-text.p-button-rounded {
        width: 2.5rem;
        height: 2.5rem;
      }

      /* Migliora la visibilità delle righe della tabella */
      ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
        background-color: #f1f5f9;
      }

      /* Stili per il componente project */
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

      /* Project grid layout */
      .project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
        gap: 1rem;
      }

      .project-card {
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        padding: 1.25rem;
        height: 100%;
      }

      /* Logo preview styles */
      .logo-preview {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 1.25rem;
        object-fit: cover;
      }

      .logo-preview-small {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 0.875rem;
        object-fit: cover;
      }

      .logo-preview-large {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 2.5rem;
        margin-bottom: 1rem;
      }

      /* Cover image styles */
      .cover-preview {
        width: 100px;
        height: 60px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f3f4f6;
        object-fit: cover;
      }

      /* Connection badges */
      .connection-badge {
        background-color: #3182ce;
        color: white;
        font-size: 0.75rem;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 9999px;
      }

      .connection-badge-small {
        background-color: #3182ce;
        color: white;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 1px 5px;
        border-radius: 9999px;
        display: inline-block;
      }

      .tf-badge {
        background-color: #805ad5;
      }

      /* Dialog styles */
      ::ng-deep .project-dialog .p-dialog-content {
        overflow-y: auto;
        max-height: 80vh;
      }

      @media screen and (max-width: 576px) {
        ::ng-deep .p-dialog {
          margin: 0.5rem;
        }

        ::ng-deep .p-dialog .p-dialog-header {
          padding: 1rem;
        }

        ::ng-deep .p-dialog .p-dialog-footer {
          padding: 1rem;
        }

        ::ng-deep .p-dialog .p-dialog-content {
          max-height: 65vh;
        }

        .project-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProjectsComponent implements OnInit, AfterViewInit, OnDestroy {
  private formBuilder = inject(FormBuilder);
  private confirmDialogService = inject(ConfirmDialogService);
  private toastService = inject(ToastService);
  private salesPointService = inject(SalesPointService);
  private authStore = inject(AuthStore);
  private projectStore = inject(ProjectStore);
  private destroy$ = new Subject<void>();

  // Signals dal ProjectStore
  projects = this.projectStore.projects;
  selectedProject = this.projectStore.selectedProject;
  isLoading = this.projectStore.loading;
  errorMessage = this.projectStore.error;

  // Signal derivato per la ricerca
  filteredProjects = signal<Project[] | null>(null);

  // UI state signals
  viewMode = signal<'grid' | 'list'>('grid');
  createDialogVisible = signal<boolean>(false);
  editDialogVisible = signal<boolean>(false);
  editingProject = signal<Project | null>(null);

  // AuthStore signals
  role = this.authStore.role;
  partners = this.authStore.partners;

  searchQuery = '';
  isEditing = false;
  projectForm!: FormGroup;

  // Component variables
  CCsalesPoints: SalesPoint[] = [];
  isLoadingSalesPoints = false;
  salesPointError: string | null = null;
  logoPath = '';
  coverImagePath = '';
  addressSuggestions: any[] = [];
  zipcodeSuggestions: any[] = [];

  // Color map for consistent logo colors
  private logoColorMap = new Map<string, string>();
  private colors = [
    '#4F46E5', // Indigo
    '#0891B2', // Cyan
    '#059669', // Emerald
    '#D97706', // Amber
    '#DC2626', // Red
    '#7C3AED', // Violet
    '#2563EB', // Blue
    '#C026D3', // Fuchsia
    '#0D9488', // Teal
    '#EA580C', // Orange
    '#4338CA', // Indigo deep
    '#0369A1', // Sky
    '#16A34A', // Green
  ];

  // Days of the week in Italian
  daysOfWeek = [
    { label: 'Lunedì', value: 'Monday' },
    { label: 'Martedì', value: 'Tuesday' },
    { label: 'Mercoledì', value: 'Wednesday' },
    { label: 'Giovedì', value: 'Thursday' },
    { label: 'Venerdì', value: 'Friday' },
    { label: 'Sabato', value: 'Saturday' },
    { label: 'Domenica', value: 'Sunday' },
  ];

  constructor() {
    // Effect per monitorare i progetti e aggiornare i segnali derivati
    effect(() => {
      const projectsValue = this.projects();
      this.filteredProjects.set(projectsValue);
    });

    // Effect per gestire il progetto selezionato
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        this.isEditing = true;
        this.patchProjectForm(project);
      }
    });
  }

  ngOnInit() {
    this.generateForm();
    this.loadProjects();
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cambia tra vista griglia e vista tabella
   */
  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  /**
   * Carica i progetti in base al ruolo
   */
  loadProjects(): void {
    const userRole = this.role();

    if (userRole === 'admin') {
      // Per l'admin, carica sia i partner che i progetti
      this.authStore.fetchPartners();
      this.projectStore.fetchAdminProjects();
    } else {
      // Per i partner, carica solo i propri progetti
      this.projectStore.fetchPartnerProjects();
    }
  }

  /**
   * Verifica se un campo del form ha errori
   */
  formHasError(controlName: string): boolean {
    // Supporta nested form controls con dot notation
    if (controlName.includes('.')) {
      const parts = controlName.split('.');
      const parentControl = this.projectForm.get(parts[0]);
      if (parentControl && parentControl instanceof FormGroup) {
        const childControl = parentControl.get(parts[1]);
        return childControl
          ? childControl.invalid && childControl.touched
          : false;
      }
      return false;
    }

    const control = this.projectForm.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Genera il form per la creazione/modifica di un progetto
   */
  generateForm(): void {
    this.projectForm = this.formBuilder.group({
      partnerId: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
      logo: [''],
      coverImage: [''],
      isActive: [true, Validators.required],
      address: this.formBuilder.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        zipcode: ['', [Validators.required, Validators.pattern(/^[0-9]{5,}$/)]],
        country: ['', Validators.required],
      }),
      mail: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s]{8,}$/)]],
      openingHours: this.formBuilder.array([]),
      CCConnection: [false],
      TConnection: [false],
      CCApiKey: [''],
      TApiKey: [''],
      CCSalesPointId: [''],
      TSalesPointId: [''],
      additionalData: this.formBuilder.group({
        stripeApiKey: [''],
        orderApp: [true],
        kambusaApp: [true],
        workersApp: [true],
        enoApp: [true],
        bookingApp: [true],
        productionApp: [true],
      }),
    });
  }

  /**
   * Aggiungi un orario di apertura al FormArray
   */
  addOpeningHour(
    day: string = '',
    startTime: string = '',
    endTime: string = ''
  ): void {
    const openingHoursArray = this.projectForm.get('openingHours') as FormArray;
    const openingHourGroup = this.formBuilder.group({
      day: [day, Validators.required],
      startTime: [startTime, Validators.required],
      endTime: [endTime, Validators.required],
    });
    openingHoursArray.push(openingHourGroup);
  }

  /**
   * Getter per accedere facilmente al FormArray degli orari di apertura
   */
  get OpeningHours(): FormArray {
    return this.projectForm.get('openingHours') as FormArray;
  }

  /**
   * Rimuove un orario di apertura specifico
   */
  removeOpeningHour(index: number): void {
    const openingHoursArray = this.projectForm.get('openingHours') as FormArray;
    openingHoursArray.removeAt(index);
  }

  /**
   * Gestisce il caricamento di un'immagine (logo o copertina)
   */
  onSelectedImage(event: any, control: string) {
    const fileReader = new FileReader();
    const file = event.files[0];
    fileReader.readAsDataURL(file);
    fileReader.onload = () => {
      const base64 = fileReader.result as string;
      if (control === 'logo') {
        this.logoPath = file.name;
      } else if (control === 'coverImage') {
        this.coverImagePath = file.name;
      }
      this.projectForm.patchValue({ [control]: base64 });
    };
    fileReader.onerror = (error) => {
      console.error('Error reading file', error);
    };
  }

  /**
   * Rimuove un'immagine selezionata
   */
  removeSelectedImage(control: string) {
    this.projectForm.patchValue({ [control]: '' });
    if (control === 'logo') {
      this.logoPath = '';
    } else if (control === 'coverImage') {
      this.coverImagePath = '';
    }
  }

  /**
   * Recupera i punti vendita da Cassa in Cloud
   */
  getCCsalesPoints(): void {
    const apiKey = this.projectForm.get('CCApiKey')?.value;
    const isConnectionEnabled = this.projectForm.get('CCConnection')?.value;

    if (!isConnectionEnabled || !apiKey) {
      this.toastService.showError(
        'Per favore abilita la connessione e inserisci un API key valida'
      );
      return;
    }

    this.isLoadingSalesPoints = true;
    this.salesPointError = null;

    this.salesPointService
      .getSalesPoints(apiKey, true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingSalesPoints = false))
      )
      .subscribe({
        next: (response) => {
          if (response.salesPoint && response.salesPoint.length > 0) {
            this.CCsalesPoints = response.salesPoint;
            this.toastService.showSuccess(
              `Caricati ${response.totalCount} punti vendita`
            );
          } else {
            this.toastService.showWarn(
              'Nessun punto vendita trovato per questa API key'
            );
            this.CCsalesPoints = [];
          }
        },
        error: (error) => {
          console.error('Error fetching sales points:', error);
          this.salesPointError =
            error.message || 'Errore durante il recupero dei punti vendita';
          this.toastService.showError(
            this.salesPointError ||
              'Errore durante il recupero dei punti vendita'
          );
          this.CCsalesPoints = [];
        },
      });
  }

  /**
   * Gestisce l'autocompletamento dell'indirizzo
   */
  onAddressInput(event: any) {
    // Simula il recupero dei suggerimenti (sostituire con chiamata API reale)
    const query = event.query;
    setTimeout(() => {
      this.addressSuggestions = [
        query + ' Via Roma',
        query + ' Via Milano',
        query + ' Corso Italia',
      ];
    }, 300);
  }

  /**
   * Gestisce l'autocompletamento del CAP
   */
  onZipcodeInput(event: any) {
    // Simula il recupero dei suggerimenti (sostituire con chiamata API reale)
    const query = event.query;
    setTimeout(() => {
      this.zipcodeSuggestions = ['20100', '20121', '20122', '20123'].filter(
        (zip) => zip.startsWith(query)
      );
    }, 300);
  }

  /**
   * Imposta i dati del progetto in base al punto vendita selezionato
   */
  setProjectBySalesPoint(event: {
    originalEvent: any;
    value: SalesPoint;
  }): void {
    const salesPoint = event.value;
    if (!salesPoint) return;

    // Aggiorna il form con i dati del punto vendita selezionato
    this.projectForm.patchValue({
      CCSalesPointId: salesPoint.id,
      name: salesPoint.name || salesPoint.description || '',
      address: {
        street: salesPoint.street || '',
        city: salesPoint.city || '',
        zipcode: salesPoint.zipcode || '',
        country: salesPoint.country || '',
      },
      mail: salesPoint.email || '',
      phone: salesPoint.phoneNumber || '',
    });

    // Se disponibili, imposta anche le immagini
    if (salesPoint.logoSmall) {
      this.projectForm.patchValue({ logo: salesPoint.logoSmall });
      this.logoPath = 'logo_from_cc.jpg';
    }

    if (salesPoint.logoBig || salesPoint.img) {
      this.projectForm.patchValue({
        coverImage: salesPoint.logoBig || salesPoint.img,
      });
      this.coverImagePath = 'cover_from_cc.jpg';
    }

    this.toastService.showSuccess(
      'Dati del punto vendita importati con successo'
    );
  }

  /**
   * Filtra i progetti in base alla query di ricerca
   */
  filterPartners($event: any) {
    if (!this.searchQuery || this.searchQuery.length === 0) {
      this.filteredProjects.set(this.projects());
      return;
    }

    const projectsValue = this.projects() || [];
    const filtered = projectsValue.filter(
      (project) =>
        project.name &&
        project.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    this.filteredProjects.set(filtered);
  }

  /**
   * Ottiene le iniziali dal nome per il logo
   */
  getInitials(name: string): string {
    if (!name) return '?';

    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /**
   * Ottiene un colore coerente per un progetto specifico
   */
  getRandomColor(name: string): string {
    if (!name) return '#6B7280'; // Gray default

    // Usa un colore memorizzato se già generato per questo progetto
    if (this.logoColorMap.has(name)) {
      return this.logoColorMap.get(name)!;
    }

    // Genera un nuovo colore e lo memorizza
    const index = this.logoColorMap.size % this.colors.length;
    const color = this.colors[index];
    this.logoColorMap.set(name, color);

    return color;
  }

  /**
   * Apre il dialog per la creazione di un progetto
   */
  openCreateDialog(): void {
    this.isEditing = false;
    this.logoPath = '';
    this.coverImagePath = '';
    this.resetForm();
    this.createDialogVisible.set(true);
  }

  /**
   * Chiude il dialog di creazione
   */
  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
  }

  /**
   * Gestisce la visibilità del dialog di creazione
   */
  onCreateDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeCreateDialog();
    }
  }

  /**
   * Apre il dialog per la modifica di un progetto
   */
  openEditDialog(project: Project): void {
    this.isEditing = true;
    this.editingProject.set(project);

    // Resetta i path delle immagini
    this.logoPath = '';
    this.coverImagePath = '';

    // Imposta i path delle immagini se presenti
    if (project.logo) {
      this.logoPath = 'logo_exists.jpg';
    }

    if (project.coverImage) {
      this.coverImagePath = 'cover_exists.jpg';
    }

    this.patchProjectForm(project);
    this.editDialogVisible.set(true);
  }

  /**
   * Chiude il dialog di modifica
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingProject.set(null);
    this.projectStore.clearSelectedProject();
  }

  /**
   * Gestisce la visibilità del dialog di modifica
   */
  onEditDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeEditDialog();
    }
  }

  /**
   * Seleziona un progetto per l'editing (legacy method)
   */
  selectProject(id: string) {
    this.projectStore.getProject({ id });
  }

  /**
   * Popola il form con i dati del progetto selezionato
   */
  patchProjectForm(project: Project) {
    try {
      // Add id control if not exists
      if (!this.projectForm.get('id')) {
        this.projectForm.addControl(
          'id',
          this.formBuilder.control(project.id, [Validators.required])
        );
      }

      // Patch form values
      this.projectForm.patchValue(project);

      // Assicura che additionalData sia inizializzato anche se è undefined nel progetto
      if (!project.additionalData) {
        this.projectForm.patchValue({
          additionalData: {
            stripeApiKey: '',
            orderApp: true,
            kambusaApp: true,
            workersApp: true,
            enoApp: true,
            bookingApp: true,
            productionApp: true,
          },
        });
      }

      // Handle opening hours
      const openingHoursArray = this.projectForm.get(
        'openingHours'
      ) as FormArray;
      openingHoursArray.clear();

      if (project.openingHours && Array.isArray(project.openingHours)) {
        project.openingHours.forEach((oh) => {
          this.addOpeningHour(oh.day, oh.startTime, oh.endTime);
        });
      }

      // Set form control values for image paths
      if (project.logo) {
        this.logoPath = 'logo_uploaded.jpg';
      } else {
        this.logoPath = '';
      }

      if (project.coverImage) {
        this.coverImagePath = 'cover_uploaded.jpg';
      } else {
        this.coverImagePath = '';
      }
    } catch (e) {
      console.error('Error patching project form:', e);
    }
  }

  /**
   * Elimina un progetto
   */
  async deleteProject($event: any, id: string) {
    try {
      const result = await this.confirmDialogService
        .confirm('Sei sicuro di voler eliminare questo progetto?')
        .toPromise();
      if (!result) return;

      this.projectStore.deleteProject({ id });
    } catch (error) {
      console.error('Error during delete:', error);
    }
  }

  /**
   * Aggiorna un progetto esistente
   */
  async updateProject() {
    try {
      if (this.projectForm.invalid) {
        this.markFormGroupTouched(this.projectForm);
        this.toastService.showError('Verifica i campi obbligatori');
        return;
      }

      const result = await this.confirmDialogService
        .confirm('Vuoi salvare le modifiche a questo progetto?')
        .toPromise();
      if (!result) return;

      const projectData = this.projectForm.value;
      const id = projectData.id;

      this.projectStore.updateProject({ id, project: projectData });
      this.closeEditDialog();
    } catch (error) {
      console.error('Error during update:', error);
    }
  }

  /**
   * Crea un nuovo progetto
   */
  async createProject() {
    try {
      if (this.projectForm.invalid) {
        this.markFormGroupTouched(this.projectForm);
        this.toastService.showError('Verifica i campi obbligatori');
        return;
      }

      const result = await this.confirmDialogService
        .confirm('Vuoi creare questo progetto?')
        .toPromise();
      if (!result) return;

      const projectData = this.projectForm.value;
      this.projectStore.createProject({ project: projectData });
      this.closeCreateDialog();
    } catch (error) {
      console.error('Error during creation:', error);
    }
  }

  /**
   * Marca tutti i campi del form come touched per mostrare gli errori
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }

  /**
   * Resetta il form
   */
  resetForm() {
    if (this.projectForm.get('id')) {
      this.projectForm.removeControl('id');
    }

    this.projectForm.reset({
      isActive: true,
      CCConnection: false,
      TConnection: false,
      additionalData: {
        orderApp: true,
        kambusaApp: true,
        workersApp: true,
        enoApp: true,
        bookingApp: true,
        productionApp: true,
      },
    });

    const openingHoursArray = this.projectForm.get('openingHours') as FormArray;
    openingHoursArray.clear();

    this.logoPath = '';
    this.coverImagePath = '';
    this.isEditing = false;
  }
}
