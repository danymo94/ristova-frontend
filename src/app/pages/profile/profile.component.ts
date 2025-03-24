import {
  Component,
  OnInit,
  effect,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { KeyFilterModule } from 'primeng/keyfilter';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { InputUppercaseDirective } from '../../core/directives/uppercase.directive';
import { ConfirmDialogService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';

// Importa solo l'AuthStore, ora contiene tutte le funzionalità necessarie
import { AuthStore } from '../../core/store/auth.signal-store';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToggleButtonModule,
    ButtonModule,
    InputTextModule,
    KeyFilterModule,
    CardModule,
    TooltipModule,
    InputUppercaseDirective,
  ],
  templateUrl: './profile.component.html',
  styles: [
    `
      .profile-section {
        margin-bottom: 2rem;
      }

      .form-container {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        padding: 2rem;
      }

      .section-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
      }

      /* Password field styles */
      .password-field {
        position: relative;
      }

      .password-toggle {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        z-index: 10;
      }

      /* Form field styles */
      .field-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: #374151;
      }

      .field-error {
        font-size: 0.75rem;
        color: #ef4444;
        margin-top: 0.25rem;
      }

      .required-field::after {
        content: '*';
        color: #ef4444;
        margin-left: 4px;
      }

      /* Button styles */
      .submit-button {
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class ProfileComponent implements OnInit, AfterViewInit {
  @ViewChild('passwordInput') password: ElementRef | undefined;

  // Inject AuthStore
  private authStore = inject(AuthStore);
  formBuilder = inject(FormBuilder);
  confirmDialogService = inject(ConfirmDialogService);
  toastService = inject(ToastService);

  form!: FormGroup;
  passwordSubmitted = false;
  showPassword = false;

  // Use signals from AuthStore
  isLoading = this.authStore.loading;
  errorMessage = this.authStore.error;
  user = this.authStore.user;

  constructor() {
    // Effect to update form when user data changes
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        this.patchFormWithUserData(currentUser);
      }
    });
  }

  ngOnInit() {
    this.generateForm();
    this.loadUserData();
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
   * Load user data using the AuthStore fetchProfile method
   */
  loadUserData() {
    // Chiamare fetchProfile senza argomenti poiché accetta void
    this.authStore.fetchProfile();
  }

  /**
   * Populate form with user data
   */
  patchFormWithUserData(userData: any) {
    if (!userData) return;

    this.form.patchValue({
      id: userData.id,
      fullName: userData.fullName,
      businessName: userData.businessName,
      email: userData.email,
      // Non impostare la password
      phone: userData.phone,
      businessAddress: userData.businessAddress,
      vatNumber: userData.vatNumber,
      fiscalCode: userData.fiscalCode,
      sdiCode: userData.sdiCode,
      pecAddress: userData.pecAddress,
      website: userData.website || '',
    });

    // Rimuovi il validatore required dalla password per l'aggiornamento
    const passwordControl = this.form.get('password');
    if (passwordControl) {
      passwordControl.clearValidators();
      passwordControl.setValidators([Validators.minLength(6)]);
      passwordControl.updateValueAndValidity();
    }
  }

  generateForm() {
    // Inizializza il form con campi vuoti
    this.form = this.formBuilder.group({
      id: [''],
      fullName: ['', [Validators.required]],
      businessName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]], // Non obbligatorio per gli aggiornamenti
      phone: ['', [Validators.required]],
      businessAddress: ['', [Validators.required]],
      vatNumber: ['', [Validators.required]],
      fiscalCode: ['', [Validators.required]],
      sdiCode: ['', [Validators.required]],
      pecAddress: ['', [Validators.required, Validators.email]],
      website: [''],
    });
  }

  /**
   * Check if a form field has errors
   */
  formHasError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Handle form submission for profile update
   */
  async onSubmit() {
    if (this.form.invalid) {
      this.markFormGroupTouched(this.form);
      this.toastService.showError('Verifica i campi obbligatori');
      return;
    }

    try {
      const confirmed = await this.confirmDialogService
        .confirm('Sei sicuro di voler aggiornare il tuo profilo?')
        .toPromise();
      if (!confirmed) return;

      const formData = this.form.value;

      // Rimuovi la password se vuota
      if (!formData.password) {
        delete formData.password;
      }

      // Usa il metodo updateProfile dell'AuthStore
      this.authStore.updateProfile({ userData: formData });
    } catch (error) {
      console.error('Error during form submission:', error);
    }
  }

  /**
   * Handle focus on password field
   */
  async onPasswordFocus(on: boolean) {
    if (on && !this.passwordSubmitted) {
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
   * Toggle password visibility
   */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Mark all form fields as touched to show errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}
