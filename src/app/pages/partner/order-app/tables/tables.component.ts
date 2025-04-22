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
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { AuthStore } from '../../../../core/store/auth.signal-store';
import { TableStore } from '../../../../core/store/table.signal-store';
import { Project } from '../../../../core/models/project.model';
import {
  Table,
  CreateTableDto,
  UpdateTableDto,
  mapCCTableToTable,
} from '../../../../core/models/table.model';
import { ICCRestaurantTable } from '../../../../core/interfaces/cassaincloud.interfaces';
import { CCTableService } from '../../../../core/services/api/cassa-cloud/table.service';
import { finalize } from 'rxjs/operators';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import { firstValueFrom, Observable } from 'rxjs';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-tables',
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
    TagModule,
    MultiSelectModule,
    TooltipModule,
  ],
  templateUrl: './tables.component.html',
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
      .sync-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background-color: #4caf50;
        color: white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .table-card {
        display: flex;
        flex-direction: column;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 1rem;
        margin-bottom: 1rem;
        position: relative;
      }

      .table-card .table-actions {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        display: flex;
        gap: 0.5rem;
      }

      .table-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }
      .qr-code-container {
        display: flex;
        justify-content: center;
        width: 100%;
        margin-bottom: 0.5rem;
      }

      .qr-code-image {
        max-width: 100%;
        height: auto;
        border-radius: 15px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .qr-code-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 280px;
        height: 320px;
        border: 1px solid #e5e7eb;
        border-radius: 15px;
        background-color: #f9fafb;
      }

      /* Stile per i dialog responsive */
      ::ng-deep .table-dialog .p-dialog-content {
        overflow-y: auto;
        max-height: 75vh;
      }

      ::ng-deep .sync-dialog .p-dialog-content {
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

        .table-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TablesComponent implements OnInit {
  // Inject services
  private projectStore = inject(ProjectStore);
  private authStore = inject(AuthStore);
  private tableStore = inject(TableStore);
  private ccTableService = inject(CCTableService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);
  private formBuilder = inject(FormBuilder);

  // State signals
  selectedProject = this.projectStore.selectedProject;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;
  tables = this.tableStore.tables;
  selectedTable = this.tableStore.selectedTable;
  loading = signal<boolean>(false);

  // View mode (grid/list)
  viewMode = signal<'grid' | 'list'>('grid');

  // Filtered tables
  filteredTables = signal<Table[] | null>(null);

  // CC Tables state
  ccTables = signal<ICCRestaurantTable[] | null>(null);
  filteredCCTables = signal<ICCRestaurantTable[] | null>(null);
  loadingCCTables = signal<boolean>(false);
  errorCCTables = signal<string | null>(null);
  selectedCCTables = signal<ICCRestaurantTable[]>([]);
  baseQrUrl = signal<string>('https://v2.bistronetower.com/');
  tableQrCodes = signal<Map<string, string>>(new Map());
  generatingQrCodes = signal<boolean>(false);
  exportingQrCodes = signal<boolean>(false);
  exportingPdf = signal<boolean>(false);

  // Search
  searchQuery = '';
  searchCCQuery = '';

  // Dialog state
  createDialogVisible = signal<boolean>(false);
  creatingTable = signal<boolean>(false);
  createForm!: FormGroup;

  // Edit table dialog
  editDialogVisible = signal<boolean>(false);
  editingTable = signal<Table | null>(null);
  editForm!: FormGroup;
  updatingTable = signal<boolean>(false);

  // Sync dialog
  syncDialogVisible = signal<boolean>(false);

  // Aggiungiamo stati per la sincronizzazione
  importProgress = signal<number>(0);
  totalTablesToImport = signal<number>(0);
  importingTables = signal<boolean>(false);

  constructor() {
    // Effect to track project changes
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        // Load tables
        setTimeout(() => {
          this.loadTables();
        }, 300);
      }
    });

    // Effect to update filteredTables when tables change
    effect(() => {
      const tables = this.tables();
      this.filteredTables.set(tables);
    });

    // Aggiungi qui l'effect che era in ngOnInit
    effect(() => {
      const tables = this.tables();
      if (tables && tables.length > 0) {
        this.generateQrCodesForTables();
      }
    });

    // Initialize forms
    this.initCreateForm();
    this.initEditForm();
  }

  ngOnInit(): void {}

  /**
   * Initializes the create table form
   */
  initCreateForm(): void {
    this.createForm = this.formBuilder.group({
      name: ['', Validators.required],
      TConnection: [false],
      TSalesPointId: [''],
      TTableId: [''],
    });
  }

  /**
   * Initializes the edit table form
   */
  initEditForm(): void {
    this.editForm = this.formBuilder.group({
      name: ['', Validators.required],
      TConnection: [false],
      TSalesPointId: [''],
      TTableId: [''],
    });
  }

  /**
   * Loads tables from both local DB and Cassa in Cloud if configured
   */
  loadTables(): void {
    // Load local tables
    this.tableStore.fetchPartnerTables();

    // If project has CC connection, load CC tables
    const project = this.selectedProject();
    if (
      project &&
      project.CCConnection &&
      project.CCApiKey &&
      project.CCSalesPointId
    ) {
      this.fetchCCTables(project);
    } else {
      this.ccTables.set(null);
      this.filteredCCTables.set(null);
    }
  }

  /**
   * Fetches tables from Cassa in Cloud
   */
  fetchCCTables(project: Project): void {
    if (!project.CCApiKey || !project.CCSalesPointId) {
      this.errorCCTables.set('API Key o ID punto vendita mancante');
      return;
    }

    this.loadingCCTables.set(true);
    this.errorCCTables.set(null);

    // Converti l'ID del punto vendita in numero
    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      this.errorCCTables.set('ID punto vendita non valido');
      this.loadingCCTables.set(false);
      return;
    }

    // Chiama getAllTables con l'API key come primo parametro e l'ID punto vendita come array nel secondo parametro
    this.ccTableService
      .getAllTables(
        project.CCApiKey, // Primo parametro: API key come stringa
        [salesPointId], // Secondo parametro: array con l'ID del punto vendita
        {
          // Terzo parametro: parametri aggiuntivi opzionali
          name: this.searchCCQuery || undefined,
        }
      )
      .pipe(finalize(() => this.loadingCCTables.set(false)))
      .subscribe({
        next: (tables) => {
          console.log(
            `Recuperati ${tables.length} tavoli dal punto vendita ${salesPointId}`
          );
          this.ccTables.set(tables);
          this.filteredCCTables.set(tables);

          if (tables.length === 0) {
            this.errorCCTables.set('Nessun tavolo trovato su Cassa in Cloud');
          }
        },
        error: (error) => {
          console.error('Errore nel recupero dei tavoli:', error);
          this.errorCCTables.set(
            error.message || 'Errore nel recupero dei tavoli'
          );
        },
      });
  }

  /**
   * Refreshes tables data
   */
  refreshTables(): void {
    // Reset search query when refreshing
    this.searchQuery = '';

    // Reload tables
    this.loadTables();
  }

  /**
   * Filters local tables based on search query
   */
  filterTables(query: string): void {
    this.searchQuery = query;

    // Aggiorna tavoli filtrati in base alla query di ricerca
    const allTables = this.tables() || [];

    if (!query || query.trim() === '') {
      // Se non c'è query di ricerca, mostra tutti i tavoli
      this.filteredTables.set(allTables);
    } else {
      // Filtra i tavoli in base alla query
      const filtered = allTables.filter((table) =>
        table.name.toLowerCase().includes(query.toLowerCase())
      );
      this.filteredTables.set(filtered);
    }
  }

  /**
   * Filters CC tables based on search query
   */
  filterCCTables(query: string): void {
    const ccTablesValue = this.ccTables();
    this.searchCCQuery = query;

    if (!ccTablesValue || !query) {
      this.filteredCCTables.set(ccTablesValue);
      return;
    }

    const filtered = ccTablesValue.filter((table) =>
      table.name.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredCCTables.set(filtered);
  }

  /**
   * Opens the create table dialog
   */
  openCreateDialog(): void {
    // Reset form
    this.createForm.reset({
      name: '',
      TConnection: false,
      TSalesPointId: '',
      TTableId: '',
    });

    this.createDialogVisible.set(true);
  }

  /**
   * Closes the create dialog
   */
  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset();
  }

  /**
   * Creates a new table
   */
  createTable(): void {
    if (this.createForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();
    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    try {
      this.creatingTable.set(true);

      // Prepare table data
      const formValues = this.createForm.value;
      const tableData: CreateTableDto = {
        name: formValues.name,
        projectId: project.id,
        partnerId: project.partnerId || '',
        TConnection: formValues.TConnection,
        TSalesPointId: formValues.TSalesPointId,
        TTableId: formValues.TTableId,
      };

      // Create local table
      this.tableStore.createTable({ table: tableData });

      // Close dialog after a short delay
      setTimeout(() => {
        this.closeCreateDialog();
        this.refreshTables();
      }, 500);

      this.toastService.showSuccess('Tavolo creato con successo');
    } catch (error: any) {
      console.error('Errore durante la creazione del tavolo:', error);
      this.toastService.showError(
        error.message || 'Errore durante la creazione del tavolo'
      );
    } finally {
      this.creatingTable.set(false);
    }
  }

  /**
   * Opens the edit table dialog
   */
  openEditDialog(id: string): void {
    const table = this.tables()?.find((t) => t.id === id);
    if (!table) {
      this.toastService.showError('Tavolo non trovato');
      return;
    }

    this.editingTable.set(table);

    // Populate form
    this.editForm.patchValue({
      name: table.name,
      TConnection: table.TConnection || false,
      TSalesPointId: table.TSalesPointId || '',
      TTableId: table.TTableId || '',
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Closes the edit dialog
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingTable.set(null);
    this.editForm.reset();
  }

  /**
   * Updates an existing table
   */
  updateTable(): void {
    if (this.editForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const table = this.editingTable();
    if (!table || !table.id) {
      this.toastService.showError('Dati del tavolo mancanti');
      return;
    }

    try {
      this.updatingTable.set(true);

      // Prepare update data
      const formValues = this.editForm.value;
      const updateData: UpdateTableDto = {
        name: formValues.name,
        TConnection: formValues.TConnection,
        TSalesPointId: formValues.TSalesPointId,
        TTableId: formValues.TTableId,
      };

      // Update table
      this.tableStore.updateTable({
        id: table.id,
        table: updateData,
      });

      // Close dialog after a short delay
      setTimeout(() => {
        this.closeEditDialog();
      }, 500);

      this.toastService.showSuccess('Tavolo aggiornato con successo');
    } catch (error: any) {
      console.error('Error updating table:', error);
      this.toastService.showError(
        error.message || "Errore durante l'aggiornamento del tavolo"
      );
    } finally {
      this.updatingTable.set(false);
    }
  }

  /**
   * Deletes a table
   */
  async deleteTable(event: Event, id: string): Promise<void> {
    event.preventDefault();

    // Find the table to delete
    const table = this.tables()?.find((t) => t.id === id);
    if (!table) {
      this.toastService.showError('Tavolo non trovato');
      return;
    }

    // Confirm deletion
    const confirmed = await this.confirmDialogService
      .confirm('Sei sicuro di voler eliminare questo tavolo?')
      .toPromise();

    if (!confirmed) {
      return;
    }

    try {
      this.loading.set(true);

      // Delete table
      this.tableStore.deleteTable({ id });

      this.toastService.showSuccess('Tavolo eliminato con successo');
    } catch (error: any) {
      console.error('Error deleting table:', error);
      this.toastService.showError(
        error.message || "Errore durante l'eliminazione del tavolo"
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Opens the sync dialog
   */
  openSyncDialog(): void {
    // Clear selected tables
    this.selectedCCTables.set([]);
    this.syncDialogVisible.set(true);
  }

  /**
   * Closes the sync dialog
   */
  closeSyncDialog(): void {
    this.syncDialogVisible.set(false);
  }

  /**
   * Synchronizes selected tables from Cassa in Cloud to local DB
   */
  async syncTables(): Promise<void> {
    const project = this.selectedProject();
    const selectedTables = this.selectedCCTables();

    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    if (!selectedTables || selectedTables.length === 0) {
      this.toastService.showError('Nessun tavolo selezionato');
      return;
    }

    if (!project.CCSalesPointId) {
      this.toastService.showError('ID punto vendita CassaInCloud mancante');
      return;
    }

    try {
      // Settiamo lo stato di importazione
      this.importingTables.set(true);
      this.totalTablesToImport.set(selectedTables.length);
      this.importProgress.set(0);

      // Array per tracciare i tavoli importati con successo
      const successfullyImported: Table[] = [];
      const existingTables = this.tables() || [];

      // Mappa dei tavoli esistenti per verificare duplicati
      const existingTablesByCCId = new Map<string, Table>();
      existingTables.forEach((table) => {
        if (table.CCTableId) {
          existingTablesByCCId.set(table.CCTableId, table);
        }
      });

      // Importa un tavolo alla volta
      for (let i = 0; i < selectedTables.length; i++) {
        const ccTable = selectedTables[i];

        // Aggiorna il progresso
        this.importProgress.set(i);

        // Verifica se il tavolo esiste già
        const existingTable = existingTablesByCCId.get(ccTable.id || '');

        // Mappa il tavolo CC al formato locale
        const tableData = mapCCTableToTable(
          ccTable,
          project.id,
          project.partnerId || '',
          project.CCSalesPointId
        );

        try {
          let importedTable: Table;

          if (existingTable) {
            // Aggiorna il tavolo esistente
            const updateDto: UpdateTableDto = {
              name: tableData.name,
              CCTableName: tableData.CCTableName,
              CCSalesPointId: tableData.CCSalesPointId,
            };

            importedTable = await firstValueFrom(
              this.updateTable$({ id: existingTable.id!, table: updateDto })
            );

            console.log(
              `Tavolo ${ccTable.name} (${ccTable.id}) aggiornato con successo`
            );
          } else {
            // Crea un nuovo tavolo
            const createDto: CreateTableDto = {
              name: tableData.name,
              projectId: tableData.projectId,
              partnerId: tableData.partnerId,
              CCTableId: tableData.CCTableId,
              CCTableName: tableData.CCTableName,
              CCSalesPointId: tableData.CCSalesPointId,
            };

            importedTable = await firstValueFrom(
              this.createTable$({ table: createDto })
            );

            console.log(
              `Tavolo ${ccTable.name} (${ccTable.id}) creato con successo`
            );
          }

          // Aggiungi alla lista dei tavoli importati con successo
          successfullyImported.push(importedTable);
        } catch (error) {
          console.error(
            `Errore durante l'importazione del tavolo ${ccTable.name} (${ccTable.id}):`,
            error
          );
          // Continuiamo con gli altri tavoli anche se questo fallisce
        }

        // Breve pausa per evitare sovraccarichi
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Aggiorna il progresso finale
      this.importProgress.set(selectedTables.length);

      // Chiudi il dialog dopo il completamento
      setTimeout(() => {
        this.closeSyncDialog();
        this.refreshTables();
      }, 1000);

      this.toastService.showSuccess(
        `${successfullyImported.length} tavoli sincronizzati con successo`
      );
    } catch (error: any) {
      console.error('Errore durante la sincronizzazione dei tavoli:', error);
      this.toastService.showError(
        error.message || 'Errore durante la sincronizzazione dei tavoli'
      );
    } finally {
      this.importingTables.set(false);
    }
  }

  /**
   * Modifica dello Store signal per creare un Observable da usare nelle Promise
   */
  createTable$({ table }: { table: CreateTableDto }): Observable<Table> {
    return new Observable<Table>((observer) => {
      try {
        this.tableStore.createTable({ table });
        // Attendiamo l'aggiornamento dello state
        setTimeout(() => {
          // Assumiamo che il tavolo sia stato creato e sia l'ultimo dell'array
          const tables = this.tables();
          if (tables && tables.length > 0) {
            // Otteniamo l'ultimo tavolo creato
            const createdTable = tables[tables.length - 1];
            observer.next(createdTable);
            observer.complete();
          } else {
            observer.error(new Error('Tavolo non creato'));
          }
        }, 500);
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Modifica dello Store signal per creare un Observable da usare nelle Promise
   */
  updateTable$({
    id,
    table,
  }: {
    id: string;
    table: UpdateTableDto;
  }): Observable<Table> {
    return new Observable<Table>((observer) => {
      try {
        this.tableStore.updateTable({ id, table });
        // Attendiamo l'aggiornamento dello state
        setTimeout(() => {
          const updatedTable = this.tableStore.getTableById(id);
          if (updatedTable) {
            observer.next(updatedTable);
            observer.complete();
          } else {
            observer.error(new Error('Tavolo non aggiornato'));
          }
        }, 500);
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Handles selection change for CC tables
   */
  onSelectionChange(event: ICCRestaurantTable[]): void {
    this.selectedCCTables.set(event);
  }

  /**
   * Verifica se il progetto ha la connessione a Cassa in Cloud attiva
   */
  hasCCConnection(): boolean {
    const project = this.selectedProject();
    return !!project?.CCConnection;
  }

  /**
   * Gets the tag severity based on table connection
   */
  getTableSeverity(
    table: Table
  ):
    | 'success'
    | 'secondary'
    | 'info'
    | 'warn'
    | 'danger'
    | 'contrast'
    | undefined {
    if (table.CCTableId) {
      return 'success';
    } else if (table.TConnection) {
      return 'info';
    } else {
      return 'secondary';
    }
  }

  /**
   * Checks if a CC table is already imported
   */
  isTableImported(ccTableId: string): boolean {
    return (this.tables() || []).some((table) => table.CCTableId === ccTableId);
  }

  /**
   * Toggle view mode between grid and list
   */
  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  /**
   * Handles dialog visibility changes
   */
  onDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeEditDialog();
    }
  }

  /**
   * Handles create dialog visibility changes
   */
  onCreateDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeCreateDialog();
    }
  }

  /**
   * Handles sync dialog visibility changes
   */
  onSyncDialogVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      this.closeSyncDialog();
    }
  }

  /**
   * Aggiorna l'URL base per i QR code
   */
  updateBaseQrUrl(newBaseUrl: string): void {
    // Assicurati che l'URL finisca con uno slash
    let formattedUrl = newBaseUrl || 'https://v2.bistronetower.com/';

    if (formattedUrl && !formattedUrl.endsWith('/')) {
      formattedUrl += '/';
    }

    this.baseQrUrl.set(formattedUrl);

    // Rigenera tutti i QR code quando cambia l'URL base
    this.generateQrCodesForTables();
  }

  /**
   * Genera un QR code per un singolo tavolo con bordo e intestazione
   */
  async generateQrCode(tableId: string, projectId: string): Promise<string> {
    try {
      const url = `${this.baseQrUrl()}${projectId}/${tableId}`;
      const table = this.tables()?.find((t) => t.id === tableId);

      // Prima generiamo il QR code base
      const qrDataUrl = await QRCode.toDataURL(url, {
        margin: 0, // Rimuoviamo il margine perché lo aggiungeremo noi
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      // Ora creiamo un canvas per personalizzare il QR code
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Impossibile creare il contesto canvas');
      }

      // Dimensioni e stile
      const padding = 25; // Aumentato il padding
      const radius = 15; // Raggio degli angoli arrotondati
      const headerHeight = 45; // Leggermente aumentata l'altezza dell'intestazione
      const width = 300; // Aumentata la larghezza totale per avere più margini
      const height = 340; // Aumentata l'altezza totale

      canvas.width = width;
      canvas.height = height;

      // Sfondo bianco con bordi arrotondati
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill();

      // Bordo grigio chiaro - più spesso
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2; // Spessore del bordo impostato a 2
      ctx.stroke();

      // Disegna l'intestazione
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TAVOLO', width / 2, padding + 5);

      // Nome del tavolo
      ctx.font = 'bold 18px Arial';
      ctx.fillText(table?.name || 'N/A', width / 2, padding + 30);

      // Carica l'immagine del QR code
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () =>
          reject(new Error('Errore nel caricamento del QR code'));
        qrImg.src = qrDataUrl;
      });

      // Disegna il QR code
      const qrSize = 200;
      const qrX = (width - qrSize) / 2;
      const qrY = headerHeight + padding + 5; // Aggiustato leggermente verso l'alto
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Troncamento URL se necessario
      const maxUrlLength = 40; // Massima lunghezza URL da visualizzare
      let displayUrl = url;

      if (url.length > maxUrlLength) {
        // Tronchiamo l'URL mantenendo l'inizio e la fine
        const start = url.substring(0, Math.floor(maxUrlLength / 2) - 3);
        const end = url.substring(url.length - Math.floor(maxUrlLength / 2));
        displayUrl = `${start}...${end}`;
      }

      // Aggiungi l'URL sotto il QR code con dimensione più piccola
      ctx.fillStyle = '#777777';
      ctx.font = '11px Arial'; // Ridotta la dimensione del font
      ctx.fillText(displayUrl, width / 2, height - padding - 5);

      // Converti il canvas in data URL
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Errore nella generazione del QR code:', err);
      throw new Error('Impossibile generare il QR code');
    }
  }

  /**
   * Genera QR code per tutti i tavoli
   */
  async generateQrCodesForTables(): Promise<void> {
    this.generatingQrCodes.set(true);

    const project = this.selectedProject();
    if (!project || !project.id) {
      this.toastService.showError('Nessun progetto selezionato');
      this.generatingQrCodes.set(false);
      return;
    }

    const tables = this.tables();
    if (!tables || tables.length === 0) {
      this.generatingQrCodes.set(false);
      return;
    }

    try {
      const qrMap = new Map<string, string>();

      // Genera QR code per ogni tavolo
      for (const table of tables) {
        if (table.id) {
          const qrCode = await this.generateQrCode(table.id, project.id);
          qrMap.set(table.id, qrCode);
        }
      }

      this.tableQrCodes.set(qrMap);
    } catch (error) {
      console.error('Errore durante la generazione dei QR code:', error);
      this.toastService.showError('Errore durante la generazione dei QR code');
    } finally {
      this.generatingQrCodes.set(false);
    }
  }

  /**
   * Esporta tutti i QR code come file ZIP
   */
  async exportQrCodesAsZip(): Promise<void> {
    this.exportingQrCodes.set(true);

    const project = this.selectedProject();
    if (!project || !project.id) {
      this.toastService.showError('Nessun progetto selezionato');
      this.exportingQrCodes.set(false);
      return;
    }

    const qrCodes = this.tableQrCodes();
    if (!qrCodes || qrCodes.size === 0) {
      this.toastService.showWarn('Nessun QR code da esportare');
      this.exportingQrCodes.set(false);
      return;
    }

    try {
      const zip = new JSZip();
      const folder = zip.folder(
        `QR_Codes_${project.name.replace(/\s+/g, '_')}`
      );

      if (!folder) {
        throw new Error('Impossibile creare la cartella ZIP');
      }

      // Ottieni tutti i tavoli
      const tables = this.tables() || [];

      // Aggiungi ogni QR code al file ZIP
      for (const table of tables) {
        if (table.id && qrCodes.has(table.id)) {
          const qrCodeDataUrl = qrCodes.get(table.id)!;
          // Converti il data URL in blob
          const imageData = qrCodeDataUrl.replace('data:image/png;base64,', '');
          folder.file(`${table.name.replace(/\s+/g, '_')}_QR.png`, imageData, {
            base64: true,
          });
        }
      }

      // Genera il file ZIP
      const content = await zip.generateAsync({ type: 'blob' });

      // Salva il file
      const fileName = `QR_Codes_${project.name.replace(/\s+/g, '_')}_${
        new Date().toISOString().split('T')[0]
      }.zip`;
      saveAs(content, fileName);

      this.toastService.showSuccess('QR code esportati con successo');
    } catch (error) {
      console.error("Errore durante l'esportazione dei QR code:", error);
      this.toastService.showError("Errore durante l'esportazione dei QR code");
    } finally {
      this.exportingQrCodes.set(false);
    }
  }


/**
 * Esporta tutti i QR code come file PDF con più QR code per pagina
 */
async exportQrCodesAsPdf(): Promise<void> {
  this.exportingPdf.set(true);

  const project = this.selectedProject();
  if (!project || !project.id) {
    this.toastService.showError('Nessun progetto selezionato');
    this.exportingPdf.set(false);
    return;
  }

  const qrCodes = this.tableQrCodes();
  if (!qrCodes || qrCodes.size === 0) {
    this.toastService.showWarn('Nessun QR code da esportare');
    this.exportingPdf.set(false);
    return;
  }

  try {
    // Crea un nuovo documento PDF in formato A4
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Configurazione griglia
    const qrPerRow = 3; // QR code per riga
    const qrWidth = 50;  // Larghezza di ogni QR code in mm
    const qrHeight = 60; // Altezza di ogni QR code in mm
    const marginX = (pageWidth - (qrPerRow * qrWidth)) / (qrPerRow + 1); // Margine orizzontale
    const marginY = 20; // Margine verticale superiore
    const spacingY = 10; // Spazio verticale tra QR code
    
    // Recupera tutti i tavoli con QR code validi
    const tables = this.tables() || [];
    const tablesWithQr = tables.filter(table => table.id && qrCodes.has(table.id));
    
    // Aggiungi intestazione al PDF
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`QR Code Tavoli - ${project.name}`, pageWidth / 2, 10, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, pageWidth / 2, 15, { align: 'center' });
    
    let currentRow = 0;
    let currentCol = 0;
    let yPosition = marginY;
    
    // Aggiungi ogni QR code al PDF
    for (let i = 0; i < tablesWithQr.length; i++) {
      const table = tablesWithQr[i];
      const qrCodeDataUrl = qrCodes.get(table.id!)!;
      
      // Calcola la posizione per questo QR code
      const xPosition = marginX + (currentCol * (qrWidth + marginX));
      
      // Se siamo alla fine della pagina, crea una nuova pagina
      if (yPosition + qrHeight > pageHeight - 10) {
        pdf.addPage();
        yPosition = marginY;
        currentRow = 0;
      }
      
      // Aggiungi il QR code al PDF
      pdf.addImage(qrCodeDataUrl, 'PNG', xPosition, yPosition, qrWidth, qrHeight);
      
      // Prepara per il prossimo QR code
      currentCol++;
      
      if (currentCol >= qrPerRow) {
        currentCol = 0;
        currentRow++;
        yPosition += qrHeight + spacingY;
      }
    }
    
    // Salva il file PDF
    const fileName = `QR_Codes_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    this.toastService.showSuccess('QR code esportati come PDF con successo');
  } catch (error) {
    console.error("Errore durante l'esportazione dei QR code come PDF:", error);
    this.toastService.showError("Errore durante l'esportazione dei QR code come PDF");
  } finally {
    this.exportingPdf.set(false);
  }
}

  /**
   * Ottiene un QR code per un tavolo specifico
   */
  getQrCodeForTable(tableId: string): string | undefined {
    return this.tableQrCodes().get(tableId);
  }

  /**
   * Genera l'URL per il QR code di un tavolo
   */
  getTableQrUrl(tableId: string): string {
    const projectId = this.selectedProject()?.id;
    if (!projectId) return '';
    return `${this.baseQrUrl()}${projectId}/${tableId}`;
  }

  /**
   * Scarica un singolo QR code
   */
  downloadQrCode(table: Table): void {
    if (!table || !table.id) {
      this.toastService.showWarn('ID tavolo mancante');
      return;
    }

    const qrCode = this.getQrCodeForTable(table.id);
    if (!qrCode) {
      this.toastService.showWarn('QR code non disponibile');
      return;
    }

    // Crea un elemento a temporaneo per scaricare l'immagine
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `${table.name.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
