import { TagModule } from 'primeng/tag';
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';

// PrimeNG Components
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

// Services e Store
import { DailyClosingStore } from '../../../core/store/daily-closing.signal-store';
import { ProjectStore } from '../../../core/store/project.signal-store';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm.service';

// Models
import {
  DailyClosing,
  ClosingExportOptions,
} from '../../../core/models/daily-closing.model';

@Component({
  selector: 'app-daily-closings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    DialogModule,
    TooltipModule,
    InputNumberModule,
    TextareaModule,
    BadgeModule,
    CardModule,
    ConfirmDialogModule,
    TagModule
  ],
  templateUrl: './daily-closings.component.html',
})
export class DailyClosingsComponent implements OnInit {
  // Injections
  public dailyClosingStore = inject(DailyClosingStore);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  // Store signals
  selectedProject = this.projectStore.selectedProject;
  closings = this.dailyClosingStore.closings;
  filteredClosings = this.dailyClosingStore.filteredClosings;
  selectedClosing = this.dailyClosingStore.selectedClosing;
  loading = this.dailyClosingStore.loading;
  error = this.dailyClosingStore.error;
  createDialogVisible = this.dailyClosingStore.createDialogVisible;
  editDialogVisible = this.dailyClosingStore.editDialogVisible;
  exportDialogVisible = this.dailyClosingStore.exportDialogVisible;
  currentMonth = this.dailyClosingStore.currentMonth;
  currentYear = this.dailyClosingStore.currentYear;
  searchQuery = signal<string>('');
  hasClosingsInCurrentMonth = this.dailyClosingStore.hasClosingsInCurrentMonth;

  // Form per la creazione/modifica
  closingForm!: FormGroup;

  // Opzioni per i dropdown
  monthOptions = [
    { label: 'Gennaio', value: 1 },
    { label: 'Febbraio', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Aprile', value: 4 },
    { label: 'Maggio', value: 5 },
    { label: 'Giugno', value: 6 },
    { label: 'Luglio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Settembre', value: 9 },
    { label: 'Ottobre', value: 10 },
    { label: 'Novembre', value: 11 },
    { label: 'Dicembre', value: 12 },
  ];

  yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { label: year.toString(), value: year };
  });

  constructor() {
    // Inizializza il form
    this.initForm();

    // Effect per impostare il form quando viene selezionata una chiusura
    effect(() => {
      const currentProject = this.selectedProject();
      if (currentProject) {
        this.loadClosings();
      }
      const closing = this.selectedClosing();
      if (closing) {
        this.patchForm(closing);
      }
    });
  }

  ngOnInit(): void {
    // Carica le chiusure al caricamento del componente
  }

  /**
   * Inizializza il form per la creazione/modifica
   */
  initForm(): void {
    this.closingForm = this.fb.group({
      date: [new Date(), Validators.required],
      eTickets: [0, [Validators.required, Validators.min(0)]],
      paperTickets: [0, [Validators.required, Validators.min(0)]],
      charges: [0, [Validators.required, Validators.min(0)]],
      cash: [0, [Validators.required, Validators.min(0)]],
      creditCard: [0, [Validators.required, Validators.min(0)]],
      debitCard: [0, [Validators.required, Validators.min(0)]],
      invoices: [0, [Validators.required, Validators.min(0)]],
      deferredInvoices: [0, [Validators.required, Validators.min(0)]],
      other: [0, [Validators.required, Validators.min(0)]],
      operatorName: ['', Validators.required],
      notes: [''],
    });
  }

  /**
   * Popola il form con i dati della chiusura selezionata
   */
  patchForm(closing: DailyClosing): void {
    // Se la data è una stringa, convertiamola in oggetto Date
    const closingDate =
      closing.date instanceof Date ? closing.date : new Date(closing.date);

    this.closingForm.patchValue({
      date: closingDate,
      eTickets: closing.eTickets,
      paperTickets: closing.paperTickets,
      charges: closing.charges,
      cash: closing.cash,
      creditCard: closing.creditCard,
      debitCard: closing.debitCard,
      invoices: closing.invoices,
      deferredInvoices: closing.deferredInvoices,
      other: closing.other,
      operatorName: closing.operatorName,
      notes: closing.notes,
    });
  }

  /**
   * Carica le chiusure dal server
   */
  loadClosings(): void {
    const project = this.selectedProject();
    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.dailyClosingStore.loadClosings(project.id);
    this.filterByMonth(this.currentMonth(), this.currentYear());
  }

  /**
   * Filtra le chiusure per mese e anno
   */
  filterByMonth(month: number, year: number): void {
    this.dailyClosingStore.filterByMonth(month, year);
  }

  /**
   * Filtra le chiusure per testo di ricerca
   */
  filterClosings(query: string): void {
    this.searchQuery.set(query);
    this.dailyClosingStore.filterBySearchText(query);
  }

  /**
   * Resetta i filtri
   */
  resetFilters(): void {
    this.searchQuery.set('');
    this.dailyClosingStore.resetFilters();
  }

  /**
   * Verifica se c'è un filtro di ricerca attivo
   */
  hasActiveSearch(): boolean {
    return this.searchQuery() !== '';
  }

  /**
   * Apre il dialog per creare una nuova chiusura
   */
  openCreateDialog(): void {
    // Reset del form
    this.initForm();
    this.dailyClosingStore.openCreateDialog();
  }

  /**
   * Apre il dialog per modificare una chiusura
   */
  openEditDialog(id: string): void {
    this.dailyClosingStore.openEditDialog(id);
  }

  /**
   * Crea una nuova chiusura
   */
  createClosing(): void {
    if (this.closingForm.invalid) {
      this.toastService.showError('Il form contiene errori. Verifica i campi.');
      return;
    }

    const formValue = this.closingForm.value;
    const project = this.selectedProject();
    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Validazione aggiuntiva per i campi obbligatori
    if (!formValue.date) {
      this.toastService.showError('La data è un campo obbligatorio');
      return;
    }

    if (!formValue.operatorName || formValue.operatorName.trim() === '') {
      this.toastService.showError(
        "Il nome dell'operatore è un campo obbligatorio"
      );
      return;
    }

    // Assicuriamoci che la data sia un oggetto Date valido
    const dateValue =
      formValue.date instanceof Date
        ? formValue.date
        : typeof formValue.date === 'string'
        ? new Date(formValue.date)
        : new Date();

    // Crea l'oggetto chiusura con data validata
    const closing: DailyClosing = {
      ...formValue,
      date: dateValue,
      projectId: project.id,
    };

    this.dailyClosingStore.createClosing(closing);
  }

  /**
   * Aggiorna una chiusura esistente
   */
  updateClosing(): void {
    if (this.closingForm.invalid) {
      this.toastService.showError('Il form contiene errori. Verifica i campi.');
      return;
    }

    const formValue = this.closingForm.value;
    const selectedClosing = this.selectedClosing();

    if (!selectedClosing || !selectedClosing.id) {
      this.toastService.showError('Nessuna chiusura selezionata');
      return;
    }

    // Aggiorna la chiusura tramite il servizio markAsSent
    // Nota: questo metodo non aggiorna effettivamente i dati della chiusura
    // ma imposta lo stato "isSent" a true.
    this.dailyClosingStore.markAsSent(selectedClosing.id);
    this.dailyClosingStore.closeEditDialog();
  }

  /**
   * Elimina una chiusura
   */
  deleteClosing(id: string): void {
    this.confirmDialogService.confirm(
      'Sei sicuro di voler eliminare questa chiusura?'
    );
  }

  /**
   * Segna una chiusura come inviata
   */
  markAsSent(id: string): void {
    this.confirmDialogService.confirm(
      'Vuoi segnare questa chiusura come inviata?'
    );
  }

  /**
   * Apre il dialog per esportare le chiusure
   */
  openExportDialog(): void {
    this.dailyClosingStore.openExportDialog();
  }

  /**
   * Esporta le chiusure in Excel
   */
  exportToExcel(): void {
    const project = this.selectedProject();
    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    const options: ClosingExportOptions = {
      month: this.currentMonth(),
      year: this.currentYear(),
      projectId: project.id,
    };

    this.dailyClosingStore.exportToExcel(options);
  }

  /**
   * Calcola il totale per una chiusura
   */
  calculateTotal(closing: DailyClosing): number {
    return this.dailyClosingStore.calculateTotal(closing);
  }

  /**
   * Calcola il totale complessivo per tutte le chiusure filtrate
   */
  calculateTotalForFilteredClosings(): number {
    const closings = this.getFilteredClosings();
    if (!closings || closings.length === 0) return 0;

    return closings.reduce(
      (sum, closing) => sum + this.calculateTotal(closing),
      0
    );
  }

  /**
   * Ottiene le chiusure filtrate con l'eventuale ricerca applicata
   */
  getFilteredClosings(): DailyClosing[] {
    const closings = this.filteredClosings();
    if (!closings) return [];

    const query = this.searchQuery();
    if (!query) return closings;

    // Filtra per testo di ricerca
    const searchText = query.toLowerCase();
    return closings.filter(
      (closing) =>
        closing.operatorName?.toLowerCase().includes(searchText) ||
        closing.notes?.toLowerCase().includes(searchText)
    );
  }

  /**
   * Formatta una data per la visualizzazione
   */
  formatDate(date: Date | string): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('it-IT');
  }

  /**
   * Formatta una data includendo l'ora per la visualizzazione
   */
  formatDateTime(date: Date | string): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Determina se una chiusura è stata inviata (per mostrare l'icona di stato)
   */
  isSent(closing: DailyClosing): boolean {
    return closing.isSent === true;
  }
}
