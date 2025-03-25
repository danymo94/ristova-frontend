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

interface MovementProduct {
  rawProductId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  warehouseId?: string;
  notes?: string;
  availableQty?: number; // Quantità disponibile
  exceedsAvailable?: boolean; // Flag per indicare se la quantità supera la disponibilità
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

  warehouseProductBalances = signal<ProductBalance[]>([]);
  availabilitySearchTerm = signal<string>('');
  sourceWarehouseProductBalances = signal<ProductBalance[]>([]); // Per i trasferimenti

  // Aggiungi questo computed signal per filtrare i saldi
  filteredWarehouseBalance = computed(() => {
    const balances = this.warehouseProductBalances();
    const searchTerm = this.availabilitySearchTerm().toLowerCase();

    if (!searchTerm) return balances;

    return balances.filter((balance) => {
      const description = this.getProductDescription(
        balance.rawProductId
      ).toLowerCase();
      return description.includes(searchTerm);
    });
  });

  // Computed signal per filtrare il saldo del magazzino di origine in base al termine di ricerca
  filteredSourceWarehouseBalance = computed(() => {
    const balances = this.sourceWarehouseProductBalances();
    const searchTerm = this.availabilitySearchTerm().toLowerCase();

    if (!searchTerm) return balances;

    return balances.filter((balance) => {
      const description = this.getProductDescription(
        balance.rawProductId
      ).toLowerCase();
      return description.includes(searchTerm);
    });
  });

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
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    const isTransfer = this.movementType() === 'TRANSFER';
    const currentProducts = [...this.selectedProducts()];
    const defaultWarehouseId = this.selectedWarehouseId();

    // Se è un movimento di uscita o trasferimento, verifica disponibilità
    let availableQty = 0;
    let exceedsAvailable = false;

    if (isOutbound || isTransfer) {
      let balances = isTransfer
        ? this.sourceWarehouseProductBalances()
        : this.warehouseProductBalances();

      const balance = balances.find((b) => b.rawProductId === product.id);

      if (balance) {
        availableQty = balance.currentQuantity;
      }

      // Avviso se prodotto non disponibile
      if (availableQty <= 0) {
        this.toastService.showWarn(
          `Attenzione: ${product.description} non è disponibile in magazzino (quantità: ${availableQty})`
        );
        exceedsAvailable = true;
      }
    }

    // Verifica se il prodotto è già stato aggiunto
    const existingProductIndex = currentProducts.findIndex(
      (p) => p.rawProductId === product.id
    );

    if (existingProductIndex >= 0) {
      // Se esiste, incrementa la quantità
      const existingProduct = currentProducts[existingProductIndex];
      const newQuantity = existingProduct.quantity + 1;

      // Verifica disponibilità
      if ((isOutbound || isTransfer) && newQuantity > availableQty) {
        this.toastService.showWarn(
          `Attenzione: La quantità richiesta (${newQuantity}) supera la disponibilità (${availableQty})`
        );
        exceedsAvailable = true;
      }

      currentProducts[existingProductIndex] = {
        ...existingProduct,
        quantity: newQuantity,
        totalPrice: newQuantity * existingProduct.unitPrice,
        availableQty: isOutbound || isTransfer ? availableQty : undefined,
        exceedsAvailable:
          isOutbound || isTransfer ? exceedsAvailable : undefined,
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
        availableQty: isOutbound || isTransfer ? availableQty : undefined,
        exceedsAvailable:
          isOutbound || isTransfer ? exceedsAvailable : undefined,
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

  updateProductQuantity(index: number, quantity: number): void {
    if (quantity < 0) quantity = 0;

    const currentProducts = [...this.selectedProducts()];
    const product = currentProducts[index];
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    const isTransfer = this.movementType() === 'TRANSFER';

    // Verifica disponibilità
    let exceedsAvailable = false;
    if ((isOutbound || isTransfer) && product.availableQty !== undefined) {
      exceedsAvailable = quantity > product.availableQty;

      if (exceedsAvailable) {
        this.toastService.showWarn(
          `Attenzione: La quantità richiesta (${quantity}) supera la disponibilità (${product.availableQty})`
        );
      }
    }

    currentProducts[index] = {
      ...product,
      quantity,
      totalPrice: quantity * product.unitPrice,
      exceedsAvailable: isOutbound || isTransfer ? exceedsAvailable : undefined,
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

        // Verifica che nei movimenti di uscita o trasferimento non ci siano prodotti
        // che superano la disponibilità
        const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
          this.movementType()
        );
        const isTransfer = this.movementType() === 'TRANSFER';

        if (isOutbound || isTransfer) {
          const hasExceedingProducts = products.some((p) => p.exceedsAvailable);
          if (hasExceedingProducts) {
            this.toastService.showError(
              'Impossibile procedere: alcuni prodotti superano la disponibilità in magazzino'
            );
            return false;
          }
        }

        // Se stiamo usando multi-magazzino, verifica che ogni prodotto abbia un magazzino
        if (this.enableMultiWarehouse && !isTransfer) {
          return products.every(
            (p) => p.warehouseId || this.selectedWarehouseId()
          );
        }

        return true;

      case 3: // Riepilogo
        return true;
    }

    return true;
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
        this.toastService.showSuccess(
          `Creati ${successCount} movimenti da fattura`
        );
      } else {
        this.toastService.showSuccess('Movimento creato con successo');
      }
    } else {
      this.toastService.showError(
        'Nessun movimento creato - verifica la selezione di magazzini e prodotti'
      );
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
    const selectedWarehouse = this.warehouses()?.find(
      (w) => w.id === costCenterId
    );
    if (selectedWarehouse?.type !== 'COST_CENTER') {
      this.toastService.showError('Seleziona un centro di costo valido');
      return;
    }

    // Prepara i dati per l'assegnazione della fattura al centro di costo
    const data: CreateMovementFromInvoiceDto = {
      details:
        this.invoiceRawProducts()?.map((p) => ({
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
    this.toastService.showSuccess(
      'Fattura assegnata al centro di costo con successo'
    );
  }

  // Metodo per eliminare effettivamente il movimento
  deleteMovement(): void {
    const projectId = this.selectedProject()?.id;
    const movement = this.selectedMovement();

    if (!projectId || !movement) {
      this.toastService.showError(
        'Dati insufficienti per eliminare il movimento'
      );
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

  // Metodo per ottenere la descrizione di un prodotto
  getProductDescription(rawProductId: string): string {
    const products = this.rawProducts();
    if (!products) return 'Prodotto sconosciuto';

    const product = products.find((p) => p.id === rawProductId);
    return product ? product.description : 'Prodotto sconosciuto';
  }

  // Metodo per caricare i saldi quando viene selezionato un magazzino
  loadWarehouseBalance(warehouseId: string | null): void {
    if (!warehouseId) {
      this.warehouseProductBalances.set([]);
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Carica il saldo del magazzino
    this.stockMovementStore.fetchWarehouseBalance({
      projectId,
      warehouseId,
    });

    // Usa setTimeout per attendere che lo store completi l'operazione
    setTimeout(() => {
      const balance = this.stockMovementStore.warehouseBalance();
      if (balance && balance.warehouseId === warehouseId) {
        this.warehouseProductBalances.set(balance.balance || []);
        this.updateAvailableQuantities();
      }
    }, 500);
  }
  // Metodo per caricare i saldi quando viene selezionato un magazzino di origine
  loadSourceWarehouseBalance(warehouseId: string | null): void {
    if (!warehouseId) {
      this.sourceWarehouseProductBalances.set([]);
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Carica il saldo del magazzino di origine
    this.stockMovementStore.fetchWarehouseBalance({
      projectId,
      warehouseId,
    });

    // Usa setTimeout per attendere che lo store completi l'operazione
    setTimeout(() => {
      const balance = this.stockMovementStore.warehouseBalance();
      if (balance && balance.warehouseId === warehouseId) {
        this.sourceWarehouseProductBalances.set(balance.balance || []);

        if (this.movementType() === 'TRANSFER') {
          this.updateAvailableQuantitiesForTransfer();
        }
      }
    }, 500);
  }
  updateAvailableQuantities(): void {
    // Per movimenti di uscita (non trasferimento)
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    if (!isOutbound || this.movementType() === 'TRANSFER') return;

    const balances = this.warehouseProductBalances();
    if (!balances.length) return;

    // Creiamo una mappa per velocizzare la ricerca dei saldi per prodotto
    const balanceMap = new Map<string, ProductBalance>();
    balances.forEach((balance) => {
      balanceMap.set(balance.rawProductId, balance);
    });

    const currentProducts = [...this.selectedProducts()];
    let updated = false;

    // Ciclo ottimizzato con meno ricerche
    for (let i = 0; i < currentProducts.length; i++) {
      const product = currentProducts[i];
      const specificWarehouseId =
        product.warehouseId || this.selectedWarehouseId();

      if (specificWarehouseId === this.selectedWarehouseId()) {
        // Uso della mappa per trovare il saldo più velocemente
        const balance = balanceMap.get(product.rawProductId);

        if (balance) {
          currentProducts[i] = {
            ...product,
            availableQty: balance.currentQuantity,
            exceedsAvailable: product.quantity > balance.currentQuantity,
          };
          updated = true;
        }
      } else {
        // Carica il saldo specifico del magazzino solo se necessario
        this.loadSpecificWarehouseBalance(product, i);
      }
    }

    if (updated) {
      this.selectedProducts.set(currentProducts);
    }
  }

  // Metodo per aggiornare le quantità disponibili nei prodotti selezionati per trasferimenti
  updateAvailableQuantitiesForTransfer(): void {
    if (this.movementType() !== 'TRANSFER') return;

    const balances = this.sourceWarehouseProductBalances();
    if (!balances.length) return;

    const currentProducts = [...this.selectedProducts()];
    let updated = false;

    for (let i = 0; i < currentProducts.length; i++) {
      const product = currentProducts[i];
      const balance = balances.find(
        (b) => b.rawProductId === product.rawProductId
      );

      if (balance) {
        currentProducts[i] = {
          ...product,
          availableQty: balance.currentQuantity,
          exceedsAvailable: product.quantity > balance.currentQuantity,
        };
        updated = true;
      }
    }

    if (updated) {
      this.selectedProducts.set(currentProducts);
    }
  }

  // Modifica il metodo loadSpecificWarehouseBalance
  loadSpecificWarehouseBalance(product: MovementProduct, index: number): void {
    const warehouseId = product.warehouseId;
    if (!warehouseId) return;

    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Chiamata al servizio per ottenere il saldo del prodotto nel magazzino
    this.stockMovementStore.fetchProductBalance({
      projectId,
      warehouseId,
      rawProductId: product.rawProductId,
    });

    // Usa setTimeout per attendere che lo store venga aggiornato
    setTimeout(() => {
      const balances = this.stockMovementStore.productBalances();
      if (!balances) return;

      const balance = balances.find(
        (b) =>
          b.rawProductId === product.rawProductId &&
          b.warehouseId === warehouseId
      );

      if (balance) {
        const currentProducts = [...this.selectedProducts()];
        currentProducts[index] = {
          ...currentProducts[index],
          availableQty: balance.currentQuantity,
          exceedsAvailable:
            currentProducts[index].quantity > balance.currentQuantity,
        };

        this.selectedProducts.set(currentProducts);
      }
    }, 500);
  }
  setWarehouse(warehouseId: string | null): void {
    this.selectedWarehouseId.set(warehouseId);

    // Se è un movimento in uscita e viene selezionato un magazzino, carica i saldi
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    if (isOutbound && warehouseId) {
      this.loadWarehouseBalance(warehouseId);
    }
  }

  // Aggiungi un metodo per gestire la selezione del magazzino di origine
  setSourceWarehouse(warehouseId: string | null): void {
    this.selectedSourceWarehouseId.set(warehouseId);

    // Per i trasferimenti, carica i saldi del magazzino di origine
    if (this.movementType() === 'TRANSFER' && warehouseId) {
      this.loadSourceWarehouseBalance(warehouseId);
    }
  }

  addFromBalance(balance: ProductBalance): void {
    const products = this.rawProducts();
    if (!products) return;

    const product = products.find((p) => p.id === balance.rawProductId);
    if (!product) {
      this.toastService.showError('Prodotto non trovato');
      return;
    }

    // Usa il metodo existente per aggiungere il prodotto
    this.selectProduct(product);
  }

  // Helper per determinare il colspan nella tabella
  getTableColspan(): number {
    const isOutboundOrTransfer = [
      'SALE',
      'WASTE',
      'INTERNAL_USE',
      'TRANSFER',
    ].includes(this.movementType());
    const hasMultiWarehouse =
      this.enableMultiWarehouse && this.movementType() !== 'TRANSFER';

    let colspan = 2; // Base (prodotto + quantità)

    if (isOutboundOrTransfer) colspan++; // Colonna disponibilità
    if (hasMultiWarehouse) colspan++; // Colonna magazzino

    return colspan;
  }

  // Metodo per verificare disponibilità quando si cambia magazzino per un prodotto
  checkAvailabilityForWarehouse(
    productIndex: number,
    warehouseId: string
  ): void {
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    if (!isOutbound) return;

    const projectId = this.selectedProject()?.id;
    if (!projectId || !warehouseId) return;

    // Ottieni il prodotto corrente
    const currentProducts = [...this.selectedProducts()];
    const product = currentProducts[productIndex];

    // Mostra indicatore di caricamento
    this.toastService.showInfo(`Verifica disponibilità in corso...`);

    // Chiama il servizio per ottenere il saldo del prodotto nel magazzino selezionato
    this.stockMovementStore.fetchProductBalance({
      projectId,
      warehouseId,
      rawProductId: product.rawProductId,
    });

    // Attendi che lo store venga aggiornato
    setTimeout(() => {
      const balances = this.stockMovementStore.productBalances();
      if (!balances) return;

      const balance = balances.find(
        (b) =>
          b.rawProductId === product.rawProductId &&
          b.warehouseId === warehouseId
      );

      if (balance) {
        const availableQty = balance.currentQuantity;
        const exceedsAvailable = product.quantity > availableQty;

        // Aggiorna il prodotto con la disponibilità
        currentProducts[productIndex] = {
          ...product,
          availableQty,
          exceedsAvailable,
        };

        this.selectedProducts.set(currentProducts);

        // Mostra avviso se la quantità supera la disponibilità
        if (exceedsAvailable) {
          this.toastService.showWarn(
            `Attenzione: La quantità richiesta (${product.quantity}) supera la disponibilità (${availableQty})`
          );
        }
      }
    }, 500);
  }

  // Helper per verificare se ci sono problemi di disponibilità
  hasAvailabilityIssues(): boolean {
    return this.selectedProducts().some((p) => p.exceedsAvailable);
  }

  // Metodo per aggiungere un prodotto dalla tabella di disponibilità del magazzino di origine
  addFromSourceBalance(balance: ProductBalance): void {
    const products = this.rawProducts();
    if (!products) return;

    const product = products.find((p) => p.id === balance.rawProductId);
    if (!product) {
      this.toastService.showError('Prodotto non trovato');
      return;
    }

    // Usa il metodo existente per aggiungere il prodotto
    this.selectProduct(product);
  }
}
