import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { BadgeModule } from 'primeng/badge';
import { TabViewModule } from 'primeng/tabview';
import { StepsModule } from 'primeng/steps';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';

// Core imports
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { WarehouseStore } from '../../../../core/store/warehouse.signal-store';
import { StockMovementStore } from '../../../../core/store/stock-movement.signal-store';
import { EInvoiceStore } from '../../../../core/store/einvoice.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import {
  WarehouseType,
  Warehouse,
} from '../../../../core/models/warehouse.model';
import { EInvoice } from '../../../../core/models/einvoice.model';
import {
  RawProduct,
  InvoiceRawProduct,
} from '../../../../core/models/rawproduct.model';
import {
  StockMovement,
  MovementType,
  MovementStatus,
  InboundMovementDto,
  OutboundMovementDto,
  TransferMovementDto,
  CreateMovementFromInvoiceDto,
  StockMovementDetail,
  ProductBalance,
} from '../../../../core/models/stock-movement.model';
import { MenuItem } from 'primeng/api';

// Aggiorniamo l'interfaccia MovementProduct
interface MovementProduct {
  rawProductId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  warehouseId?: string; // Aggiungiamo magazzino specifico per prodotto
  notes?: string;
}

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    CalendarModule,
    TooltipModule,
    TagModule,
    CardModule,
    BadgeModule,
    TabViewModule,
    StepsModule,
    AutoCompleteModule,
    CheckboxModule,
    RadioButtonModule,
    ProgressBarModule,
    ToastModule,
  ],
  templateUrl: './stock-movements.component.html',
})
export class StockMovementsComponent implements OnInit, OnDestroy {
  // Dependency injection
  private projectStore = inject(ProjectStore);
  private warehouseStore = inject(WarehouseStore);
  private stockMovementStore = inject(StockMovementStore);
  private einvoiceStore = inject(EInvoiceStore);
  private rawProductStore = inject(RawProductStore);
  private toastService = inject(ToastService);

  // Signals
  selectedProject = this.projectStore.selectedProject;
  warehouses = this.warehouseStore.warehouses;
  movements = this.stockMovementStore.movements;
  selectedMovement = this.stockMovementStore.selectedMovement;
  movementDetails = this.stockMovementStore.movementDetails;
  warehouseBalance = this.stockMovementStore.warehouseBalance;
  invoices = this.einvoiceStore.invoices;
  rawProducts = this.rawProductStore.rawProducts;
  invoiceRawProducts = this.rawProductStore.invoiceRawProducts;

  enableMultiWarehouse = true;


  // Loading states
  loading = computed(
    () =>
      this.stockMovementStore.loading() ||
      this.warehouseStore.loading() ||
      this.einvoiceStore.loading() ||
      this.rawProductStore.loading()
  );

  // Filtri e stato locale
  viewMode = signal<'list' | 'grid'>('list');
  searchQuery = signal<string>('');
  filterType = signal<MovementType | 'ALL'>('ALL');
  filterWarehouse = signal<string | null>(null);

  // Dialog controls
  moveDialogVisible = signal<boolean>(false);
  moveDialogStep = signal<number>(0);
  detailsDialogVisible = signal<boolean>(false);
  deleteDialogVisible = signal<boolean>(false);

  // Stato del nuovo movimento
  movementCreationType = signal<'manual' | 'fromInvoice' | 'costCenter'>(
    'manual'
  );
  movementType = signal<MovementType>('PURCHASE');
  selectedWarehouseId = signal<string | null>(null);
  selectedSourceWarehouseId = signal<string | null>(null);
  selectedTargetWarehouseId = signal<string | null>(null);
  selectedInvoiceId = signal<string | null>(null);
  movementDate = signal<Date>(new Date());
  movementReference = signal<string>('');
  movementNotes = signal<string>('');

  // Prodotti del movimento
  selectedProducts = signal<MovementProduct[]>([]);

  // Dati per la ricerca autocomplete
  filteredProducts: RawProduct[] = [];
  currentSearchTerm: string = '';

  // Dati per selezione di prodotti da fattura
  invoiceProductsSelection: Record<string, boolean> = {};

  // Menu dei passi per la creazione di un movimento
  steps: MenuItem[] = [
    { label: 'Tipo Movimento' },
    { label: 'Selezione Magazzino' },
    { label: 'Prodotti' },
    { label: 'Conferma' },
  ];

  // Tipi di movimento disponibili
  movementTypes: { label: string; value: MovementType; icon: string }[] = [
    { label: 'Acquisto', value: 'PURCHASE', icon: 'pi pi-shopping-cart' },
    { label: 'Vendita', value: 'SALE', icon: 'pi pi-money-bill' },
    { label: 'Rettifica inventario', value: 'INVENTORY', icon: 'pi pi-sync' },
    { label: 'Trasferimento', value: 'TRANSFER', icon: 'pi pi-arrows-h' },
    { label: 'Scarico per sprechi', value: 'WASTE', icon: 'pi pi-trash' },
    { label: 'Uso interno', value: 'INTERNAL_USE', icon: 'pi pi-home' },
    { label: 'Reso a fornitore', value: 'RETURN', icon: 'pi pi-reply' },
    { label: 'Spesa (centro di costo)', value: 'EXPENSE', icon: 'pi pi-euro' },
  ];

  // Cleanup
  private destroy$ = new Subject<void>();

  constructor() {
    // Monitor project changes
    effect(() => {
      const project = this.selectedProject();
      if (project?.id) {
        this.loadData(project.id);
      }
    });
  }

  ngOnInit(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(projectId: string): void {
    // Carica i movimenti di stock
    this.stockMovementStore.fetchProjectMovements({ projectId });

    // Carica i magazzini/centri di costo
    this.warehouseStore.fetchProjectWarehouses({ projectId });

    // Carica le fatture
    this.einvoiceStore.fetchProjectInvoices({ projectId });

    // Carica i prodotti grezzi
    this.rawProductStore.fetchProjectRawProducts({ projectId });
  }

  refreshData(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  // Gestione filtri e ricerca
  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.applyFilters();
  }

  filterByType(type: MovementType | 'ALL'): void {
    this.filterType.set(type);
    this.applyFilters();
  }

  filterByWarehouse(warehouseId: string | null): void {
    this.filterWarehouse.set(warehouseId);
    this.applyFilters();
  }

  applyFilters(): void {
    // La logica di filtro sarebbe applicata qui se necessario
    // Per ora solo un placeholder per future implementazioni
  }

  // Formattazione e utility
  getMovementTypeName(type: MovementType): string {
    const found = this.movementTypes.find((t) => t.value === type);
    return found ? found.label : type;
  }

  getMovementTypeIcon(type: MovementType): string {
    const found = this.movementTypes.find((t) => t.value === type);
    return found ? found.icon : 'pi pi-question';
  }

  getWarehouseName(warehouseId: string): string {
    const warehouseList = this.warehouses();
    if (!warehouseList) return 'N/A';

    const warehouse = warehouseList.find((w) => w.id === warehouseId);
    return warehouse ? warehouse.name : 'N/A';
  }

  getStatusSeverity(status: MovementStatus): 'success' | 'warn' | 'danger' {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'draft':
        return 'warn';
      case 'cancelled':
        return 'danger';
      default:
        return 'warn';
    }
  }

  getStatusLabel(status: MovementStatus): string {
    switch (status) {
      case 'confirmed':
        return 'Confermato';
      case 'draft':
        return 'Bozza';
      case 'cancelled':
        return 'Annullato';
      default:
        return status;
    }
  }

  // Dialog handlers
  openMoveDialog(): void {
    // Reset dei valori del form
    this.movementCreationType.set('manual');
    this.movementType.set('PURCHASE');
    this.selectedWarehouseId.set(null);
    this.selectedSourceWarehouseId.set(null);
    this.selectedTargetWarehouseId.set(null);
    this.selectedInvoiceId.set(null);
    this.movementDate.set(new Date());
    this.movementReference.set('');
    this.movementNotes.set('');
    this.selectedProducts.set([]);
    this.invoiceProductsSelection = {};

    // Apri il dialog al primo step
    this.moveDialogStep.set(0);
    this.moveDialogVisible.set(true);
  }

  openDetailsDialog(movement: StockMovement): void {
    this.stockMovementStore.selectMovement(movement);
    this.detailsDialogVisible.set(true);
  }

  openDeleteDialog(movement: StockMovement): void {
    this.stockMovementStore.selectMovement(movement);
    this.deleteDialogVisible.set(true);
  }

  // Gestione steps del wizard
  nextStep(): void {
    if (this.validateCurrentStep()) {
      this.moveDialogStep.set(this.moveDialogStep() + 1);
    }
  }

  prevStep(): void {
    if (this.moveDialogStep() > 0) {
      this.moveDialogStep.set(this.moveDialogStep() - 1);
    }
  }

  // Ricerca prodotti
  searchProducts(event: any): void {
    this.currentSearchTerm = event.query.toLowerCase();

    const rawProductsList = this.rawProducts();
    if (!rawProductsList) {
      this.filteredProducts = [];
      return;
    }

    // Filtra per nome o codice prodotto
    this.filteredProducts = rawProductsList
      .filter(
        (product) =>
          product.description.toLowerCase().includes(this.currentSearchTerm) ||
          product.productCode.toLowerCase().includes(this.currentSearchTerm)
      )
      .slice(0, 10); // Limita a 10 risultati
  }

  selectProduct(product: RawProduct): void {
    const currentProducts = [...this.selectedProducts()];
    // Usa il magazzino selezionato come default
    const defaultWarehouseId = this.selectedWarehouseId();
  
    // Verifica se il prodotto è già stato aggiunto
    const existingProductIndex = currentProducts.findIndex(
      (p) => p.rawProductId === product.id
    );
  
    if (existingProductIndex >= 0) {
      // Se esiste, incrementa la quantità
      const existingProduct = currentProducts[existingProductIndex];
      currentProducts[existingProductIndex] = {
        ...existingProduct,
        quantity: existingProduct.quantity + 1,
        totalPrice: (existingProduct.quantity + 1) * existingProduct.unitPrice,
      };
    } else {
      // Se non esiste, aggiungi il prodotto
      const averagePrice = this.calculateAveragePrice(product);
  
      currentProducts.push({
        rawProductId: product.id,
        description: product.description,
        quantity: 1,
        unitPrice: averagePrice,
        totalPrice: averagePrice,
        warehouseId: defaultWarehouseId || undefined,
        notes: '',
      });
    }
  
    this.selectedProducts.set(currentProducts);
  }

  // Rimuove un prodotto dall'elenco
  removeProduct(index: number): void {
    const currentProducts = [...this.selectedProducts()];
    currentProducts.splice(index, 1);
    this.selectedProducts.set(currentProducts);
  }

  // Aggiorna quantità di un prodotto
  updateProductQuantity(index: number, quantity: number): void {
    const currentProducts = [...this.selectedProducts()];
    const product = currentProducts[index];

    currentProducts[index] = {
      ...product,
      quantity,
      totalPrice: quantity * product.unitPrice,
    };

    this.selectedProducts.set(currentProducts);
  }

  // Aggiorna prezzo unitario di un prodotto
  updateProductPrice(index: number, unitPrice: number): void {
    const currentProducts = [...this.selectedProducts()];
    const product = currentProducts[index];

    currentProducts[index] = {
      ...product,
      unitPrice,
      totalPrice: product.quantity * unitPrice,
    };

    this.selectedProducts.set(currentProducts);
  }

  // Calcola il prezzo medio di un prodotto
  calculateAveragePrice(product: RawProduct): number {
    if (!product.purchaseHistory || product.purchaseHistory.length === 0) {
      return 0;
    }

    const totalPrice = product.purchaseHistory.reduce(
      (sum, history) => sum + history.unitPrice,
      0
    );
    return totalPrice / product.purchaseHistory.length;
  }

  // Seleziona o deseleziona tutti i prodotti di una fattura
// Modifica il metodo toggleAllInvoiceProducts
toggleAllInvoiceProducts(checked: boolean): void {
  const invoiceProducts = this.invoiceRawProducts();
  if (!invoiceProducts) return;

  const newSelection: Record<string, boolean> = {};

  for (const product of invoiceProducts) {
    newSelection[product.productId] = checked;
  }

  this.invoiceProductsSelection = newSelection;
  
  // Non aggiungiamo più automaticamente i prodotti
  // Se l'utente vuole aggiungerli, dovrà cliccare sul pulsante dedicato
}

// Modifica il metodo toggleInvoiceProduct
toggleInvoiceProduct(productId: string, checked: boolean): void {
  this.invoiceProductsSelection[productId] = checked;
  
  // Non aggiungiamo/rimuoviamo più automaticamente i prodotti
  // L'utente dovrà usare il pulsante "Aggiungi selezionati"
}

// Modifica il metodo addSelectedInvoiceProducts
addSelectedInvoiceProducts(): void {
  const invoiceProducts = this.invoiceRawProducts();
  if (!invoiceProducts) return;

  // Mantieni i prodotti già selezionati
  const currentProducts = [...this.selectedProducts()];
  const defaultWarehouseId = this.selectedWarehouseId();
  
  // Mappa dei prodotti già selezionati per ID
  const existingProductsMap = new Map<string, number>();
  currentProducts.forEach((p, index) => {
    existingProductsMap.set(p.rawProductId, index);
  });

  // Aggiungi o aggiorna i prodotti selezionati
  for (const product of invoiceProducts) {
    if (this.invoiceProductsSelection[product.productId]) {
      // Se il prodotto è già nella lista
      if (existingProductsMap.has(product.productId)) {
        // Aggiorna il prodotto esistente (mantieni i valori modificati manualmente)
        const index = existingProductsMap.get(product.productId)!;
        // Non sovrascriviamo quantità e prezzi se già impostati dall'utente
      } else {
        // Aggiungi nuovo prodotto
        currentProducts.push({
          rawProductId: product.productId,
          description: product.description,
          quantity: product.totalQuantity,
          unitPrice: product.averageUnitPrice,
          totalPrice: product.totalQuantity * product.averageUnitPrice,
          warehouseId: defaultWarehouseId || undefined,
        });
      }
    }
  }

  this.selectedProducts.set(currentProducts);
}

  // Seleziona una fattura e carica i suoi prodotti
  selectInvoice(invoiceId: string): void {
    this.selectedInvoiceId.set(invoiceId);

    // Carica i prodotti della fattura
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.rawProductStore.fetchInvoiceRawProducts({
        projectId,
        invoiceId,
      });
    }
  }

  // Calcola il totale generale dei prodotti selezionati
  get totalAmount(): number {
    return this.selectedProducts().reduce(
      (sum, product) => sum + product.totalPrice,
      0
    );
  }

  // Calcola la quantità totale dei prodotti selezionati
  get totalQuantity(): number {
    return this.selectedProducts().reduce(
      (sum, product) => sum + product.quantity,
      0
    );
  }

  // Getter per filtri e operazioni
  get physicalWarehouses(): Warehouse[] {
    const allWarehouses = this.warehouses();
    return allWarehouses
      ? allWarehouses.filter((w) => w.type === 'PHYSICAL' && w.isActive)
      : [];
  }

  get costCenters(): Warehouse[] {
    const allWarehouses = this.warehouses();
    return allWarehouses
      ? allWarehouses.filter((w) => w.type === 'COST_CENTER' && w.isActive)
      : [];
  }

  get activeInvoices(): EInvoice[] {
    const allInvoices = this.invoices();
    return allInvoices || [];
  }

  // CRUD Operations
  createMovement(): void {
    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // In base al tipo di creazione selezionato
    switch (this.movementCreationType()) {
      case 'manual':
        this.createManualMovement(projectId);
        break;

      case 'fromInvoice':
        this.createMovementFromInvoice(projectId);
        break;

      case 'costCenter':
        this.assignInvoiceToCostCenter(projectId);
        break;
    }
  }

  createManualMovement(projectId: string): void {
    const movementType = this.movementType();
  
    if (movementType === 'TRANSFER') {
      // Gestione trasferimenti (come prima)
      // ...
    } else {
      // Raggruppa i prodotti per magazzino
      const productsByWarehouse = this.groupProductsByWarehouse();
      
      // Per ogni magazzino, crea un movimento separato
      for (const warehouseId in productsByWarehouse) {
        const warehouseProducts = productsByWarehouse[warehouseId];
        
        // Determina se è un movimento di entrata o uscita
        const isInbound = ['PURCHASE', 'INVENTORY', 'RETURN'].includes(
          movementType
        );
  
        if (isInbound) {
          // Movimento di entrata
          const inboundData: InboundMovementDto = {
            movementType,
            products: warehouseProducts.map((p) => ({
              rawProductId: p.rawProductId,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              notes: p.notes,
            })),
          };
  
          this.stockMovementStore.createInboundMovement({
            projectId,
            warehouseId,
            data: inboundData,
          });
        } else {
          // Movimento di uscita
          const outboundData: OutboundMovementDto = {
            movementType,
            products: warehouseProducts.map((p) => ({
              rawProductId: p.rawProductId,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              notes: p.notes,
            })),
          };
  
          this.stockMovementStore.createOutboundMovement({
            projectId,
            warehouseId,
            data: outboundData,
          });
        }
      }
    }
  
    // Chiudi il dialog
    this.moveDialogVisible.set(false);
  }

  // Nuovo metodo per raggruppare i prodotti per magazzino
private groupProductsByWarehouse(): Record<string, MovementProduct[]> {
  const products = this.selectedProducts();
  const result: Record<string, MovementProduct[]> = {};
  const defaultWarehouseId = this.selectedWarehouseId();
  
  // Raggruppa i prodotti per magazzino
  for (const product of products) {
    // Se il prodotto non ha un magazzino specifico, usa quello predefinito
    const warehouseId = product.warehouseId || defaultWarehouseId;
    
    // Se non c'è un magazzino valido, salta (non dovrebbe mai accadere grazie alla validazione)
    if (!warehouseId) continue;
    
    if (!result[warehouseId]) {
      result[warehouseId] = [];
    }
    
    result[warehouseId].push(product);
  }
  
  return result;
}

// Modifica anche il metodo di validazione per assicurarsi che ogni prodotto abbia un magazzino
validateCurrentStep(): boolean {
  const step = this.moveDialogStep();

  // Validazione in base al passo corrente
  switch (step) {
    case 0: // Tipo di movimento
      return !!this.movementType();

    case 1: // Selezione magazzino
      if (this.movementType() === 'TRANSFER') {
        return (
          !!this.selectedSourceWarehouseId() &&
          !!this.selectedTargetWarehouseId() &&
          this.selectedSourceWarehouseId() !==
            this.selectedTargetWarehouseId()
        );
      } else if (this.movementCreationType() === 'costCenter') {
        return !!this.selectedWarehouseId();
      } else {
        return !!this.selectedWarehouseId();
      }

    case 2: // Selezione prodotti
      // Per l'assegnazione a centro di costo, non richiediamo prodotti selezionati
      if (this.movementCreationType() === 'costCenter') {
        return true;
      }
      
      // Verifica che ci siano prodotti e che ognuno abbia un magazzino assegnato
      const products = this.selectedProducts();
      if (products.length === 0) return false;
      
      // Se stiamo usando multi-magazzino, verifica che ogni prodotto abbia un magazzino
      if (this.enableMultiWarehouse) {
        return products.every(p => p.warehouseId || this.selectedWarehouseId());
      }
      
      return true;

    default:
      return true;
  }
}


createMovementFromInvoice(projectId: string): void {
  const invoiceId = this.selectedInvoiceId();
  
  if (!invoiceId) {
    this.toastService.showError('Seleziona una fattura');
    return;
  }
  
  // Verifica che ci siano prodotti nella tabella editabile
  if (this.selectedProducts().length === 0) {
    this.toastService.showError('Aggiungi almeno un prodotto dalla fattura');
    return;
  }

  // Raggruppa i prodotti per magazzino
  const productsByWarehouse = this.groupProductsByWarehouse();
  let successCount = 0;
  
  // Per ogni magazzino, crea un movimento separato
  for (const warehouseId in productsByWarehouse) {
    const warehouseProducts = productsByWarehouse[warehouseId];
    
    const data: CreateMovementFromInvoiceDto = {
      details: warehouseProducts.map((p) => ({
        rawProductId: p.rawProductId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.totalPrice,
        notes: p.notes,
      })),
    };

    this.stockMovementStore.createMovementFromInvoice({
      projectId,
      invoiceId,
      warehouseId,
      data,
    });
    
    successCount++;
  }

  if (successCount > 0) {
    // Chiudi il dialog
    this.moveDialogVisible.set(false);
    
    if (successCount > 1) {
      this.toastService.showSuccess(`Creati ${successCount} movimenti da fattura`);
    } else {
      this.toastService.showSuccess('Movimento creato con successo');
    }
  } else {
    this.toastService.showError('Nessun movimento creato - verifica la selezione di magazzini e prodotti');
  }
}

  assignInvoiceToCostCenter(projectId: string): void {
    const invoiceId = this.selectedInvoiceId();
    const costCenterId = this.selectedWarehouseId();
  
    if (!invoiceId || !costCenterId) {
      this.toastService.showError('Seleziona fattura e centro di costo');
      return;
    }
  
    // Verifica che sia selezionato un centro di costo e non un magazzino fisico
    const selectedWarehouse = this.warehouses()?.find(w => w.id === costCenterId);
    if (selectedWarehouse?.type !== 'COST_CENTER') {
      this.toastService.showError('Seleziona un centro di costo valido');
      return;
    }
  
    // Prepara i dati per l'assegnazione della fattura al centro di costo
    const data: CreateMovementFromInvoiceDto = {
      details: this.invoiceRawProducts()?.map(p => ({
        rawProductId: p.productId,
        quantity: p.totalQuantity,
        unitPrice: p.averageUnitPrice,
        totalPrice: p.totalPrice,
        notes: 'Assegnato al centro di costo: ' + selectedWarehouse.name,
      })) || [],
    };
  
    // Chiama il servizio per l'assegnazione
    this.stockMovementStore.createMovementFromInvoice({
      projectId,
      invoiceId,
      warehouseId: costCenterId,
      data,
    });
  
    // Chiudi il dialog
    this.moveDialogVisible.set(false);
    this.toastService.showSuccess('Fattura assegnata al centro di costo con successo');
  }

// Metodo per eliminare effettivamente il movimento
deleteMovement(): void {
  const projectId = this.selectedProject()?.id;
  const movement = this.selectedMovement();

  if (!projectId || !movement) {
    this.toastService.showError('Dati insufficienti per eliminare il movimento');
    return;
  }

  // Mostra indicatore di caricamento
  this.deleteDialogVisible.set(false); // Chiudi il dialog di conferma

  // Chiama lo store per eliminare il movimento
  this.stockMovementStore.deleteMovement({
    projectId,
    id: movement.id,
  });
}
  updateMovementStatus(movement: StockMovement, status: MovementStatus): void {
    const projectId = this.selectedProject()?.id;

    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.stockMovementStore.updateMovementStatus({
      projectId,
      id: movement.id,
      status,
    });
  }
  // Aggiungi questo metodo alla classe StockMovementsComponent
getSelectedInvoiceProductCount(): number {
  if (!this.invoiceProductsSelection) return 0;
  return Object.values(this.invoiceProductsSelection).filter(Boolean).length;
}
}
