import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

import { CustomerStore } from '../../../../core/store/customer.signal-store';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateCustomerCreditDto,
} from '../../../../core/models/customer.model';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    CalendarModule,
    CheckboxModule,
    TooltipModule,
    TagModule,
  ],
  templateUrl: './customers.component.html',
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

      /* Responsive dialog styling */
      ::ng-deep .customer-dialog .p-dialog-content,
      ::ng-deep .credit-dialog .p-dialog-content {
        overflow-y: auto;
        max-height: 75vh;
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
      }

      /* Stili per i tag di stato */
      ::ng-deep .p-tag.p-tag-success {
        background-color: #22c55e;
      }

      ::ng-deep .p-tag.p-tag-danger {
        background-color: #ef4444;
      }

      /* Stile per le icone nei bottoni delle azioni */
      .p-button-text.p-button-rounded {
        width: 2.5rem;
        height: 2.5rem;
      }

      /* Migliora la visibilità delle righe della tabella */
      ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
        background-color: #f1f5f9;
      }

      /* Stili per i form */
      .field label {
        font-weight: 500;
      }

      ::ng-deep .p-inputtext:enabled:focus {
        box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(59, 130, 246, 0.25);
      }

      /* Stile per la visualizzazione del credito */
      .text-primary-600 {
        color: #2563eb;
      }
    `,
  ],
})
export class CustomersComponent implements OnInit {
  private customerStore = inject(CustomerStore);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  // Segnali dallo store
  customers = this.customerStore.customers;
  selectedCustomer = this.customerStore.selectedCustomer;
  loading = this.customerStore.loading;
  selectedProject = this.projectStore.selectedProject;

  // Segnali locali per la UI
  filteredCustomers = signal<Customer[] | null>(null);
  createDialogVisible = signal<boolean>(false);
  editDialogVisible = signal<boolean>(false);
  creditDialogVisible = signal<boolean>(false);

  // Forms
  createForm!: FormGroup;
  editForm!: FormGroup;
  creditForm!: FormGroup;

  // Filtri
  searchQuery = '';

  constructor() {
    // Effetto per aggiornare i clienti filtrati quando cambiano i clienti
    effect(() => {
      const allCustomers = this.customers();
      this.filteredCustomers.set(allCustomers);
    });

    // Inizializza i form
    this.initForms();
  }

  ngOnInit(): void {
    // Carica i clienti se c'è un progetto selezionato
    if (this.selectedProject()) {
      this.loadCustomers();
    }
  }

  /**
   * Inizializza i form
   */
  initForms(): void {
    // Form per la creazione di un nuovo cliente
    this.createForm = this.fb.group({
      name: ['', [Validators.required]],
      mail: ['', [Validators.required, Validators.email]],
      phone: [''],
      additionalData: this.fb.group({
        birthdate: [null],
        notes: [''],
        marketingConsent: [false],
      }),
    });

    // Form per la modifica di un cliente
    this.editForm = this.fb.group({
      name: ['', [Validators.required]],
      phone: [''],
      address: [''],
      additionalData: this.fb.group({
        notes: [''],
        birthdate: [null],
        marketingConsent: [false],
        dietaryRestrictions: [[]],
      }),
    });

    // Form per l'aggiornamento del credito
    this.creditForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
    });
  }

  /**
   * Carica i clienti dal backend
   */
  loadCustomers(): void {
    this.customerStore.fetchPartnerCustomers();
  }

  /**
   * Filtra i clienti in base alla query di ricerca
   */
  filterCustomers(query: string): void {
    this.searchQuery = query;

    const allCustomers = this.customers();
    if (!allCustomers) return;

    if (!query || query.trim() === '') {
      this.filteredCustomers.set(allCustomers);
    } else {
      const filtered = allCustomers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query.toLowerCase()) ||
          customer.mail.toLowerCase().includes(query.toLowerCase()) ||
          (customer.phone && customer.phone.includes(query))
      );
      this.filteredCustomers.set(filtered);
    }
  }

  /**
   * Formatta la data per la visualizzazione
   */
  formatDate(dateString?: string): string {
    if (!dateString) return 'N/D';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      return 'Data non valida';
    }
  }

  /**
   * Apre il dialog per la creazione di un cliente
   */
  openCreateDialog(): void {
    this.createForm.reset({
      name: '',
      mail: '',
      phone: '',
      additionalData: {
        birthdate: null,
        notes: '',
        marketingConsent: false,
      },
    });
    this.createDialogVisible.set(true);
  }

  /**
   * Gestisce la chiusura del dialog di creazione
   */
  onCreateDialogHide(): void {
    this.createDialogVisible.set(false);
  }

  /**
   * Crea un nuovo cliente
   */
  createCustomer(): void {
    if (this.createForm.invalid) {
      this.toastService.showError(
        'Compila correttamente tutti i campi obbligatori'
      );
      return;
    }

    const formValue = this.createForm.value;
    const customerData: CreateCustomerDto = {
      name: formValue.name,
      mail: formValue.mail,
      phone: formValue.phone,
      additionalData: formValue.additionalData,
    };

    // Converte la data di nascita nel formato corretto se presente
    if (formValue.additionalData?.birthdate) {
      const date = new Date(formValue.additionalData.birthdate);
      customerData.additionalData!.birthdate = date.toISOString().split('T')[0];
    }

    this.customerStore.createCustomer({ customer: customerData });
    this.createDialogVisible.set(false);
  }

  /**
   * Apre il dialog per la modifica di un cliente
   */
  openEditDialog(customer: Customer): void {
    this.customerStore.selectCustomer(customer);

    // Prepara la data di nascita se presente
    let birthdate = null;
    if (customer.additionalData?.birthdate) {
      birthdate = new Date(customer.additionalData.birthdate);
    }

    this.editForm.patchValue({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      additionalData: {
        notes: customer.additionalData?.notes || '',
        birthdate: birthdate,
        marketingConsent: customer.additionalData?.marketingConsent || false,
        dietaryRestrictions: customer.additionalData?.dietaryRestrictions || [],
      },
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Gestisce la chiusura del dialog di modifica
   */
  onEditDialogHide(): void {
    this.editDialogVisible.set(false);
    this.customerStore.clearSelectedCustomer();
  }

  /**
   * Aggiorna un cliente esistente
   */
  updateCustomer(): void {
    if (this.editForm.invalid) {
      this.toastService.showError(
        'Compila correttamente tutti i campi obbligatori'
      );
      return;
    }

    const customer = this.selectedCustomer();
    if (!customer) {
      this.toastService.showError('Nessun cliente selezionato');
      return;
    }

    const formValue = this.editForm.value;
    const customerData: UpdateCustomerDto = {
      name: formValue.name,
      phone: formValue.phone,
      address: formValue.address,
      additionalData: formValue.additionalData,
    };

    // Converte la data di nascita nel formato corretto se presente
    if (formValue.additionalData?.birthdate) {
      const date = new Date(formValue.additionalData.birthdate);
      customerData.additionalData!.birthdate = date.toISOString().split('T')[0];
    }

    this.customerStore.updateCustomer({
      id: customer.id!,
      customer: customerData,
    });

    this.editDialogVisible.set(false);
  }

  /**
   * Apre il dialog per l'aggiornamento del credito
   */
  openCreditDialog(customer: Customer): void {
    this.customerStore.selectCustomer(customer);
    this.creditForm.reset({
      amount: 0,
    });
    this.creditDialogVisible.set(true);
  }

  /**
   * Gestisce la chiusura del dialog del credito
   */
  onCreditDialogHide(): void {
    this.creditDialogVisible.set(false);
    this.customerStore.clearSelectedCustomer();
  }

  /**
   * Aggiorna il credito di un cliente
   */
  updateCustomerCredit(): void {
    if (this.creditForm.invalid) {
      this.toastService.showError('Inserisci un importo valido');
      return;
    }

    const customer = this.selectedCustomer();
    if (!customer) {
      this.toastService.showError('Nessun cliente selezionato');
      return;
    }

    const formValue = this.creditForm.value;
    const creditData: UpdateCustomerCreditDto = {
      amount: formValue.amount,
    };

    this.customerStore.updateCustomerCredit({
      id: customer.id!,
      creditData,
    });

    this.creditDialogVisible.set(false);
  }

  /**
   * Conferma ed elimina un cliente
   */
  confirmDelete(customer: Customer): void {
    this.confirmDialogService
      .confirm(`Sei sicuro di voler disattivare il cliente ${customer.name}?`)
      .subscribe((confirmed) => {
        if (confirmed) {
          this.customerStore.deleteCustomer({ id: customer.id! });
        }
      });
  }

  /**
   * Formatta il credito come valuta
   */
  formatCredit(credit: number): string {
    return credit.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    });
  }
}
