import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputUppercaseDirective } from '../../../core/directives/uppercase.directive';
import { KeyFilterModule } from 'primeng/keyfilter';
import { ConfirmDialogService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { Partner } from '../../../core/models/user.model';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AuthStore } from '../../../core/store/auth.signal-store';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';

@Component({
  selector: 'app-new-partner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputUppercaseDirective,
    KeyFilterModule,
    ReactiveFormsModule,
    SelectButtonModule,
    TooltipModule,
    DialogModule,
    FileUploadModule,
  ],
  templateUrl: './new-partner.component.html',
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

      /* Stili per il componente partner */
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

      /* Partner grid layout */
      .partner-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
        gap: 1rem;
      }

      .partner-card {
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
      }

      .logo-preview-large {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 2.5rem;
        margin-bottom: 1rem;
      }

      .logo-preview-image {
        width: 120px;
        height: 120px;
        object-fit: cover;
        border-radius: 50%;
      }

      /* Customize file upload */
      ::ng-deep .logo-upload .p-button {
        width: 100%;
      }

      /* Dialog styles */
      ::ng-deep .partner-dialog .p-dialog-content {
        overflow-y: auto;
        max-height: 80vh;
      }
    `,
  ],
})
export class NewPartnerComponent implements OnInit, AfterViewInit {
  @ViewChild('passwordInput') password: ElementRef | undefined;

  formBuilder = inject(FormBuilder);
  confirmDialogService = inject(ConfirmDialogService);
  toastService = inject(ToastService);
  private authStore = inject(AuthStore);

  // Signals from store
  isLoading = this.authStore.loading;
  errorMessage = this.authStore.error;
  partners = this.authStore.partners;

  // Local signals for UI state
  filteredPartners = signal<Partner[] | null>(null);
  editingPartner = signal<Partner | null>(null);
  createDialogVisible = signal<boolean>(false);
  editDialogVisible = signal<boolean>(false);
  viewMode = signal<'grid' | 'list'>('grid');
  showPassword = false;
  isEditing = false;

  // Form variables
  partnerForm!: FormGroup;
  searchQuery = '';
  feeOptions = [
    { label: '%', value: 'percentage' },
    { label: '€', value: 'fixed' },
  ];

  // Logo handling
  logoImage: string | null = null;
  private passwordSubmitted: boolean = false;

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

  constructor() {
    // React to partners changes
    effect(() => {
      this.filteredPartners.set(this.partners());
    });
  }

  ngOnInit() {
    this.generateForm();
    this.loadPartners();
  }

  ngAfterViewInit() {
    if (this.password) {
      this.password.nativeElement.addEventListener('focus', () =>
        this.onPasswordFocus(true)
      );
      this.password.nativeElement.addEventListener('blur', () =>
        this.onPasswordFocus(false)
      );
    }
  }

  /**
   * Carica i partner dallo store
   */
  loadPartners(): void {
    this.authStore.fetchPartners();
  }

  /**
   * Filtra i partner in base alla query di ricerca
   */
  filterPartners($event: string | null): void {
    const query = this.searchQuery;

    if (!query || query.trim() === '') {
      this.filteredPartners.set(this.partners());
      return;
    }

    const partnersData = this.partners() || [];
    const filtered = partnersData.filter(
      (partner) =>
        partner.businessName?.toLowerCase().includes(query.toLowerCase()) ||
        partner.email?.toLowerCase().includes(query.toLowerCase()) ||
        partner.fullName?.toLowerCase().includes(query.toLowerCase()) ||
        partner.vatNumber?.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredPartners.set(filtered);
  }

  /**
   * Cambia tra vista griglia e vista tabella
   */
  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  /**
   * Mostra/nasconde la password
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Apre il dialogo per la creazione di un partner
   */
  openCreateDialog(): void {
    this.isEditing = false;
    this.logoImage = null;
    this.resetForm();
    this.createDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di creazione
   */
  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
  }

  /**
   * Gestisce la visibilità del dialogo di creazione
   */
  onCreateDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeCreateDialog();
    }
  }

  /**
   * Apre il dialogo per la modifica di un partner
   */
  openEditDialog(partner: Partner): void {
    this.isEditing = true;
    this.editingPartner.set(partner);
    this.logoImage = null;

    // Prepara il form di modifica
    this.partnerForm.reset();

    // Aggiungi il controllo ID se necessario
    if (!this.partnerForm.get('id')) {
      this.partnerForm.addControl(
        'id',
        this.formBuilder.control('', [Validators.required])
      );
    }

    this.partnerForm.patchValue({
      id: partner.id,
      fullName: partner.fullName,
      businessName: partner.businessName,
      email: partner.email,
      password: '', // Campo vuoto per la password nella modifica
      phone: partner.phone,
      businessAddress: partner.businessAddress,
      vatNumber: partner.vatNumber,
      fiscalCode: partner.fiscalCode,
      sdiCode: partner.sdiCode,
      pecAddress: partner.pecAddress,
      feeType: partner.feeType || 'percentage',
      feeValue: partner.feeValue,
      role: 'partner',
      website: partner.website || '',
    });

    // Imposta il validatore della password a opzionale per la modifica
    const passwordControl = this.partnerForm.get('password');
    if (passwordControl) {
      passwordControl.clearValidators();
      passwordControl.setValidators([Validators.minLength(6)]);
      passwordControl.updateValueAndValidity();
    }

    this.editDialogVisible.set(true);
  }

  /**
   * Chiude il dialogo di modifica
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingPartner.set(null);
  }

  /**
   * Gestisce la visibilità del dialogo di modifica
   */
  onEditDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeEditDialog();
    }
  }

  /**
   * Verifica se un campo del form ha errori
   */
  formHasError(controlName: string): boolean {
    const control = this.partnerForm.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Seleziona un partner per la modifica (metodo legacy)
   */
  selectPartner(id: string): void {
    const partner = this.partners()?.find((p) => p.id === id);
    if (partner) {
      this.openEditDialog(partner);
    }
  }

  /**
   * Elimina un partner
   */
  async deletePartner(event: MouseEvent, id: string): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const partner = this.partners()?.find((p) => p.id === id);
    if (!partner) return;

    const confirmed = await this.confirmDialogService
      .confirm(
        `Sei sicuro di voler eliminare il partner ${partner.businessName}?`
      )
      .toPromise();

    if (!confirmed) return;

    this.authStore.deletePartner({ id });
  }

  /**
   * Crea un nuovo partner
   */
  async createPartner(): Promise<void> {
    if (this.partnerForm.invalid) {
      this.markFormGroupTouched(this.partnerForm);
      this.toastService.showError('Verifica i campi obbligatori');
      return;
    }

    const confirmed = await this.confirmDialogService
      .confirm('Vuoi creare questo partner?')
      .toPromise();

    if (!confirmed) return;

    const formData = this.partnerForm.value;

    // Aggiungi il logo se presente
    if (this.logoImage) {
      formData.logoUrl = this.logoImage;
    }

    this.authStore.registerPartner({ partnerData: formData });
    this.closeCreateDialog();
  }

  /**
   * Aggiorna un partner esistente
   */
  async updatePartner(): Promise<void> {
    if (this.partnerForm.invalid) {
      this.markFormGroupTouched(this.partnerForm);
      this.toastService.showError('Verifica i campi obbligatori');
      return;
    }

    const confirmed = await this.confirmDialogService
      .confirm('Vuoi salvare le modifiche a questo partner?')
      .toPromise();

    if (!confirmed) return;

    const formData = this.partnerForm.value;

    // Aggiungi il logo se presente
    if (this.logoImage) {
      formData.logoUrl = this.logoImage;
    }

    // Se la password è vuota, rimuovila dalla richiesta
    if (!formData.password) {
      delete formData.password;
    }

    this.authStore.updatePartner({ partnerData: formData });
    this.closeEditDialog();
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
  resetForm(): void {
    // Initialize the form with empty fields
    this.partnerForm = this.formBuilder.group({
      fullName: ['', [Validators.required]],
      businessName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required]],
      businessAddress: ['', [Validators.required]],
      vatNumber: ['', [Validators.required]],
      fiscalCode: ['', [Validators.required]],
      sdiCode: ['', [Validators.required]],
      pecAddress: ['', [Validators.required, Validators.email]],
      feeType: [
        'percentage',
        [Validators.required, Validators.pattern(/^(percentage|fixed)$/)],
      ],
      feeValue: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      role: ['partner', [Validators.required]],
      website: [''],
    });

    this.logoImage = null;
    this.isEditing = false;
    this.passwordSubmitted = false;
  }

  /**
   * Genera il form
   */
  generateForm(): void {
    this.resetForm();
  }

  /**
   * Gestisce il focus sul campo password
   */
  async onPasswordFocus(on: boolean): Promise<void> {
    if (on && !this.passwordSubmitted && this.isEditing) {
      const confirmed = await this.confirmDialogService
        .confirm('Sei sicuro di voler modificare la password?')
        .toPromise();

      if (confirmed) {
        this.passwordSubmitted = true;
        this.password?.nativeElement.focus();
      }
    } else if (!on) {
      this.passwordSubmitted = false;
    }
  }

  /**
   * Ottiene le iniziali dal nome dell'azienda per il logo
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
   * Ottiene un colore coerente per un'azienda specifica
   */
  getRandomColor(name: string): string {
    if (!name) return '#6B7280'; // Gray default

    // Usa un colore memorizzato se già generato per questa azienda
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
   * Gestisce il caricamento del logo
   */
  onLogoUpload(event: any): void {
    const files = event.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Verifica se il file è un'immagine valida
    if (!this.isValidImage(file)) {
      if (event.clear) event.clear();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.logoImage = e.target.result;
      if (event.clear) event.clear();
    };

    reader.onerror = () => {
      this.toastService.showError(
        "Errore durante il caricamento dell'immagine"
      );
      if (event.clear) event.clear();
    };

    reader.readAsDataURL(file);
  }

  /**
   * Rimuove il logo
   */
  removeLogo(): void {
    this.logoImage = null;
  }

  /**
   * Verifica se il file è un'immagine valida
   */
  private isValidImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!validTypes.includes(file.type)) {
      this.toastService.showError(
        'Formato immagine non supportato. Usa JPG, PNG, GIF o WebP.'
      );
      return false;
    }

    if (file.size > 1000000) {
      this.toastService.showError(
        "L'immagine è troppo grande. Dimensione massima: 1MB"
      );
      return false;
    }

    return true;
  }
}
