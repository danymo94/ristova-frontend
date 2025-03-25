import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  effect,
  signal,
  Injector,
  runInInjectionContext,
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
  private injector = inject(Injector);

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

  // Aggiungi queste proprietà alla classe (vicino a balanceCache)
  private balanceCache = new Map<string, ProductBalance[]>();
  private balanceCacheTimestamp = new Map<string, number>();
  private loadingMap = new Map<string, boolean>();
  private warehouseBalanceSubject = new Subject<{
    warehouseId: string;
    balance: ProductBalance[];
  }>();
  private productBalanceSubject = new Subject<{
    productId: string;
    warehouseId: string;
    balance: ProductBalance;
  }>();

  // Aggiungi queste proprietà "loaded$" (vicino agli altri observable)
  private warehouseBalanceLoaded$ = this.warehouseBalanceSubject.asObservable();
  private productBalancesLoaded$ = this.productBalanceSubject.asObservable();

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
    const movementType = this.movementType();
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(movementType);
    const isTransfer = movementType === 'TRANSFER';
    const currentProducts = [...this.selectedProducts()];

    // Usa la mappa locale per la disponibilità
    let availableQty = 0;
    let exceedsAvailable = false;

    if (isOutbound) {
      // Cerca nella mappa locale
      const balance = this.warehouseProductBalances().find(
        (b) => b.rawProductId === product.id
      );
      availableQty = balance ? balance.currentQuantity : 0;
      exceedsAvailable = availableQty <= 0;
    } else if (isTransfer) {
      // Cerca nella mappa locale per il magazzino di origine
      const balance = this.sourceWarehouseProductBalances().find(
        (b) => b.rawProductId === product.id
      );
      availableQty = balance ? balance.currentQuantity : 0;
      exceedsAvailable = availableQty <= 0;
    }

    // Avvisa se non c'è disponibilità
    if ((isOutbound || isTransfer) && availableQty <= 0) {
      this.toastService.showWarn(
        `${product.description} non è disponibile in magazzino (quantità: ${availableQty})`
      );
    }

    // Cerca il prodotto esistente
    const existingIndex = currentProducts.findIndex(
      (p) => p.rawProductId === product.id
    );

    if (existingIndex >= 0) {
      // Aggiorna il prodotto esistente
      const newQuantity = currentProducts[existingIndex].quantity + 1;
      currentProducts[existingIndex] = {
        ...currentProducts[existingIndex],
        quantity: newQuantity,
        totalPrice: newQuantity * currentProducts[existingIndex].unitPrice,
        availableQty: isOutbound || isTransfer ? availableQty : undefined,
        exceedsAvailable:
          isOutbound || isTransfer ? newQuantity > availableQty : undefined,
      };
    } else {
      // Aggiungi nuovo prodotto
      const averagePrice = this.calculateAveragePrice(product);
      currentProducts.push({
        rawProductId: product.id,
        description: product.description,
        quantity: 1,
        unitPrice: averagePrice,
        totalPrice: averagePrice,
        warehouseId: this.selectedWarehouseId() || undefined,
        notes: '',
        availableQty: isOutbound || isTransfer ? availableQty : undefined,
        exceedsAvailable:
          isOutbound || isTransfer ? 1 > availableQty : undefined,
      });
    }

    this.selectedProducts.set(currentProducts);
  }

  // Metodi di supporto
  private getProductAvailability(
    productId: string,
    isTransfer: boolean
  ): { quantity: number } {
    const balances = isTransfer
      ? this.sourceWarehouseProductBalances()
      : this.warehouseProductBalances();

    const balance = balances.find((b) => b.rawProductId === productId);
    return { quantity: balance ? balance.currentQuantity : 0 };
  }

  private addNewProduct(
    products: MovementProduct[],
    rawProduct: RawProduct,
    warehouseId: string | null,
    availableQty: number,
    checkAvailability: boolean,
    exceedsAvailable: boolean
  ): void {
    const averagePrice = this.calculateAveragePrice(rawProduct);

    products.push({
      rawProductId: rawProduct.id,
      description: rawProduct.description,
      quantity: 1,
      unitPrice: averagePrice,
      totalPrice: averagePrice,
      warehouseId: warehouseId || undefined,
      notes: '',
      availableQty: checkAvailability ? availableQty : undefined,
      exceedsAvailable: checkAvailability ? exceedsAvailable : undefined,
    });
  }

  // Rimuove un prodotto dall'elenco
  removeProduct(index: number): void {
    const currentProducts = [...this.selectedProducts()];
    currentProducts.splice(index, 1);
    this.selectedProducts.set(currentProducts);
  }

  /**
   * Aggiorna la disponibilità dei prodotti in base al tipo di movimento (uscita o trasferimento)
   */
  updateProductAvailability(): void {
    const movementType = this.movementType();
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(movementType);
    const isTransfer = movementType === 'TRANSFER';

    if (!isOutbound && !isTransfer) return;

    // Seleziona la fonte dei dati di bilancio in base al tipo di movimento
    const balances = isTransfer
      ? this.sourceWarehouseProductBalances()
      : this.warehouseProductBalances();

    if (!balances || !balances.length) return;

    // Crea una mappa per accesso rapido al bilancio
    const balanceMap = new Map<string, number>();
    balances.forEach((balance) => {
      balanceMap.set(balance.rawProductId, balance.currentQuantity);
    });

    const currentProducts = [...this.selectedProducts()];
    if (!currentProducts.length) return;

    let updated = false;

    // Aggiorna tutti i prodotti
    for (let i = 0; i < currentProducts.length; i++) {
      const product = currentProducts[i];

      // Per movimenti standard, considera solo i prodotti del magazzino attivo
      if (!isTransfer) {
        const warehouseId = product.warehouseId || this.selectedWarehouseId();
        if (warehouseId !== this.selectedWarehouseId()) continue;
      }

      const availableQty = balanceMap.get(product.rawProductId) || 0;

      // Aggiorna solo se c'è un cambiamento
      if (product.availableQty !== availableQty) {
        currentProducts[i] = {
          ...product,
          availableQty,
          exceedsAvailable: product.quantity > availableQty,
        };
        updated = true;
      }
    }

    if (updated) {
      this.selectedProducts.set(currentProducts);
    }
  }

  updateProductQuantity(index: number, quantity: number): void {
    console.log(
      `⏱️ updateProductQuantity START - index: ${index}, quantity: ${quantity}`
    );

    if (quantity < 0) quantity = 0;

    try {
      const currentProducts = [...this.selectedProducts()];
      if (index >= currentProducts.length) {
        console.log('❌ updateProductQuantity - Indice fuori range');
        return;
      }

      // Se la quantità non è cambiata, usciamo subito
      if (currentProducts[index].quantity === quantity) {
        console.log('⚠️ updateProductQuantity - Quantità invariata, esco');
        return;
      }

      const product = currentProducts[index];

      // Determina il tipo di movimento
      const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
        this.movementType()
      );
      const isTransfer = this.movementType() === 'TRANSFER';

      // Applica la logica di controllo disponibilità SOLO per movimenti di uscita o trasferimento
      if (isOutbound || isTransfer) {
        const availableQty = product.availableQty || 0;

        console.log(`📊 Disponibilità attuale: ${availableQty}`);

        // Se la quantità eccede la disponibilità
        if (quantity > availableQty) {
          console.log(
            `⚠️ Quantità eccede disponibilità: ${quantity} > ${availableQty}`
          );

          // Limita la quantità alla disponibilità
          quantity = availableQty;

          // Mostra avviso all'utente
          setTimeout(() => {
            this.toastService.showWarn(
              `Attenzione: La quantità è stata limitata alla disponibilità (${availableQty})`
            );
          }, 0);
        }
      }

      // Crea un nuovo oggetto per il prodotto aggiornato
      const updatedProduct = {
        ...product,
        quantity,
        totalPrice: quantity * (product.unitPrice || 0),
      };

      // Sostituisci il prodotto nell'array
      currentProducts[index] = updatedProduct;

      console.log(
        `🔄 Prima di set - selectedProducts length: ${currentProducts.length}`
      );
      this.selectedProducts.set(currentProducts);
      console.log(
        `✅ Dopo set - selectedProducts length: ${
          this.selectedProducts().length
        }`
      );
      console.log('⏱️ updateProductQuantity END');
    } catch (error) {
      console.error('❌ ERRORE in updateProductQuantity:', error);
    }
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

  // Metodo helper per aggiornare un prodotto con il suo saldo
  private updateProductWithBalance(
    index: number,
    balance: ProductBalance
  ): void {
    const currentProducts = [...this.selectedProducts()];
    if (index >= currentProducts.length) return;

    currentProducts[index] = {
      ...currentProducts[index],
      availableQty: balance.currentQuantity,
      exceedsAvailable:
        currentProducts[index].quantity > balance.currentQuantity,
    };

    this.selectedProducts.set(currentProducts);
  }

  // Metodo helper per recuperare un saldo dalla cache
  private getBalanceFromCache(
    warehouseId: string,
    productId: string
  ): ProductBalance | null {
    for (const [key, balances] of this.balanceCache.entries()) {
      if (key.includes(warehouseId)) {
        const balance = balances.find((b) => b.rawProductId === productId);
        if (balance) return balance;
      }
    }
    return null;
  }

  // Metodo helper per aggiungere un saldo alla cache
  private addBalanceToCache(
    warehouseId: string,
    balance: ProductBalance
  ): void {
    const cacheKey = `${this.selectedProject()?.id}_${warehouseId}`;

    let balances = this.balanceCache.get(cacheKey) || [];
    const existingIndex = balances.findIndex(
      (b) => b.rawProductId === balance.rawProductId
    );

    if (existingIndex >= 0) {
      balances[existingIndex] = balance;
    } else {
      balances = [...balances, balance];
    }

    this.balanceCache.set(cacheKey, balances);
    this.balanceCacheTimestamp.set(cacheKey, Date.now());
  }

  /**
   * Imposta il magazzino e carica il relativo bilancio
   */
  setWarehouse(warehouseId: string | null): void {
    this.selectedWarehouseId.set(warehouseId);

    if (!warehouseId) {
      this.warehouseProductBalances.set([]);
      return;
    }

    // Carica il bilancio una sola volta
    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    this.toastService.showInfo('Caricamento disponibilità prodotti...');
    this.loadWarehouseData(projectId, warehouseId, false);
  }

  /**
   * Imposta il magazzino di origine per i trasferimenti e carica il relativo bilancio
   */
  setSourceWarehouse(warehouseId: string | null): void {
    this.selectedSourceWarehouseId.set(warehouseId);

    if (!warehouseId || this.movementType() !== 'TRANSFER') {
      this.sourceWarehouseProductBalances.set([]);
      return;
    }

    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    this.toastService.showInfo('Caricamento disponibilità prodotti...');
    this.loadWarehouseData(projectId, warehouseId, true);
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

  /**
   * Metodo unificato per caricare i dati di magazzino senza effect
   */
  private loadWarehouseData(
    projectId: string,
    warehouseId: string,
    isSourceWarehouse: boolean
  ): void {
    // Controllo cache
    const cacheKey = `${projectId}_${warehouseId}`;
    const cachedData = this.balanceCache.get(cacheKey);
    const cacheTimestamp = this.balanceCacheTimestamp.get(cacheKey);
    const isCacheValid = cacheTimestamp && Date.now() - cacheTimestamp < 300000; // 5 min cache

    if (cachedData && isCacheValid) {
      // Usa dati dalla cache
      if (isSourceWarehouse) {
        this.sourceWarehouseProductBalances.set(cachedData);
      } else {
        this.warehouseProductBalances.set(cachedData);
      }

      // Aggiorna disponibilità
      this.updateProductAvailability();

      return;
    }

    // Mostra loading
    const loadingKey = `loading_${warehouseId}`;
    this.loadingMap.set(loadingKey, true);

    // Carica da API
    this.stockMovementStore.fetchWarehouseBalance({
      projectId,
      warehouseId,
    });

    // Usa setTimeout invece di effect
    this.checkBalanceLoading(projectId, warehouseId, isSourceWarehouse);
  }

  /**
   * Verifica periodicamente lo stato di caricamento del bilancio
   */
  private checkBalanceLoading(
    projectId: string,
    warehouseId: string,
    isSourceWarehouse: boolean,
    attempts = 0
  ): void {
    if (attempts > 30) {
      // Max 15 secondi di attesa (30 * 500ms)
      this.toastService.showError('Timeout nel caricamento disponibilità');
      this.loadingMap.set(`loading_${warehouseId}`, false);
      return;
    }

    const isLoading = this.stockMovementStore.loading();

    if (!isLoading) {
      const balance = this.stockMovementStore.warehouseBalance();

      if (balance && balance.warehouseId === warehouseId) {
        // Salva in cache
        const balanceData = balance.balance || [];
        this.balanceCache.set(`${projectId}_${warehouseId}`, balanceData);
        this.balanceCacheTimestamp.set(
          `${projectId}_${warehouseId}`,
          Date.now()
        );

        // Aggiorna stato
        if (isSourceWarehouse) {
          this.sourceWarehouseProductBalances.set(balanceData);
        } else {
          this.warehouseProductBalances.set(balanceData);
        }

        // Aggiorna disponibilità

        // Notifica completamento
        this.warehouseBalanceSubject.next({
          warehouseId,
          balance: balanceData,
        });

        // Rimuovi loading
        this.loadingMap.set(`loading_${warehouseId}`, false);
      } else {
        // Riprova dopo un breve delay
        setTimeout(() => {
          this.checkBalanceLoading(
            projectId,
            warehouseId,
            isSourceWarehouse,
            attempts + 1
          );
        }, 500);
      }
    } else {
      // Ancora in caricamento, verifica di nuovo dopo un po'
      setTimeout(() => {
        this.checkBalanceLoading(
          projectId,
          warehouseId,
          isSourceWarehouse,
          attempts + 1
        );
      }, 500);
    }
  }

  // 3. SOSTITUISCI checkAvailabilityForWarehouse con una versione senza effect

  /**
   * Controlla la disponibilità di un prodotto nel magazzino specifico
   */
  checkAvailabilityForWarehouse(
    productIndex: number,
    warehouseId: string
  ): void {
    const isOutbound = ['SALE', 'WASTE', 'INTERNAL_USE'].includes(
      this.movementType()
    );
    if (!isOutbound) return;

    const currentProducts = [...this.selectedProducts()];
    if (productIndex >= currentProducts.length) return;

    // Imposta disponibilità a zero temporaneamente
    currentProducts[productIndex] = {
      ...currentProducts[productIndex],
      warehouseId,
      availableQty: 0,
      exceedsAvailable: currentProducts[productIndex].quantity > 0,
    };

    this.selectedProducts.set(currentProducts);
    this.toastService.showInfo('Controllo disponibilità in corso...');

    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Controlla se è in cache
    const cacheKey = `${projectId}_${warehouseId}`;
    const cachedData = this.balanceCache.get(cacheKey);
    const cacheTimestamp = this.balanceCacheTimestamp.get(cacheKey);
    const isCacheValid = cacheTimestamp && Date.now() - cacheTimestamp < 300000;

    if (cachedData && isCacheValid) {
      // Cerca il prodotto nella cache
      const rawProductId = currentProducts[productIndex].rawProductId;
      const productBalance = cachedData.find(
        (b) => b.rawProductId === rawProductId
      );

      if (productBalance) {
        this.updateSpecificProductAvailability(
          productIndex,
          productBalance.currentQuantity
        );
      } else {
        this.toastService.showWarn(
          'Prodotto non disponibile nel magazzino selezionato'
        );
      }

      return;
    }

    // Carica da API
    this.stockMovementStore.fetchWarehouseBalance({
      projectId,
      warehouseId,
    });

    // Usa setTimeout invece di effect
    setTimeout(() => {
      this.checkProductAvailability(productIndex, warehouseId, projectId);
    }, 500);
  }

  /**
   * Controlla periodicamente la disponibilità di un prodotto specifico
   */
  private checkProductAvailability(
    productIndex: number,
    warehouseId: string,
    projectId: string,
    attempts = 0
  ): void {
    if (attempts > 20) {
      this.toastService.showError('Timeout nel controllo disponibilità');
      return;
    }

    const isLoading = this.stockMovementStore.loading();

    if (!isLoading) {
      const balance = this.stockMovementStore.warehouseBalance();

      if (balance && balance.warehouseId === warehouseId) {
        // Salva in cache
        const balanceData = balance.balance || [];
        this.balanceCache.set(`${projectId}_${warehouseId}`, balanceData);
        this.balanceCacheTimestamp.set(
          `${projectId}_${warehouseId}`,
          Date.now()
        );

        // Cerca il prodotto specifico
        const products = this.selectedProducts();
        if (productIndex >= products.length) return;

        const rawProductId = products[productIndex].rawProductId;
        const productBalance = balanceData.find(
          (b) => b.rawProductId === rawProductId
        );

        if (productBalance) {
          this.updateSpecificProductAvailability(
            productIndex,
            productBalance.currentQuantity
          );
        } else {
          this.toastService.showWarn(
            'Prodotto non disponibile nel magazzino selezionato'
          );
        }
      } else {
        // Riprova dopo un po'
        setTimeout(() => {
          this.checkProductAvailability(
            productIndex,
            warehouseId,
            projectId,
            attempts + 1
          );
        }, 500);
      }
    } else {
      // Ancora in caricamento
      setTimeout(() => {
        this.checkProductAvailability(
          productIndex,
          warehouseId,
          projectId,
          attempts + 1
        );
      }, 500);
    }
  }

  /**
   * Aggiorna la disponibilità di un prodotto specifico
   */
  private updateSpecificProductAvailability(
    index: number,
    availableQty: number
  ): void {
    const products = [...this.selectedProducts()];
    if (index >= products.length) return;

    const exceedsAvailable = products[index].quantity > availableQty;

    products[index] = {
      ...products[index],
      availableQty,
      exceedsAvailable,
    };

    this.selectedProducts.set(products);

    if (exceedsAvailable) {
      setTimeout(() => {
        this.toastService.showWarn(
          `Attenzione: Quantità richiesta (${products[index].quantity}) supera la disponibilità (${availableQty})`
        );
      }, 0);
    }
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

  // Nuovo metodo per caricare il saldo del prodotto solo quando necessario
  private loadProductBalanceFromAPI(
    productIndex: number,
    warehouseId: string,
    rawProductId: string
  ): void {
    const projectId = this.selectedProject()?.id;
    if (!projectId) return;

    // Imposta uno stato di caricamento per questo prodotto specifico
    const loadingKey = `loading_product_${warehouseId}_${rawProductId}`;
    if (this.loadingMap.get(loadingKey)) return; // Evita chiamate multiple per lo stesso prodotto
    this.loadingMap.set(loadingKey, true);

    // Chiamata API (solo una volta)
    this.stockMovementStore.fetchProductBalance({
      projectId,
      warehouseId,
      rawProductId,
    });

    // Usa l'observable già esistente invece di un nuovo effect
    const subscription = this.productBalancesLoaded$.subscribe((data) => {
      if (data.productId === rawProductId && data.warehouseId === warehouseId) {
        // Aggiorna il prodotto con la disponibilità
        this.updateProductQuantityWithBalance(
          productIndex,
          this.selectedProducts()[productIndex].quantity,
          data.balance
        );

        // Fine caricamento
        this.loadingMap.set(loadingKey, false);

        // Pulizia
        subscription.unsubscribe();
      }
    });
  }

  // Nuovo metodo per gestire il caso in cui il prodotto non è disponibile
  private handleProductNotAvailable(
    productIndex: number,
    warehouseId: string
  ): void {
    const currentProducts = [...this.selectedProducts()];
    if (productIndex >= currentProducts.length) return;

    // Imposta il prodotto come non disponibile con quantità zero
    currentProducts[productIndex] = {
      ...currentProducts[productIndex],
      availableQty: 0,
      exceedsAvailable: currentProducts[productIndex].quantity > 0,
    };

    this.selectedProducts.set(currentProducts);

    this.toastService.showWarn(
      `Prodotto non disponibile nel magazzino selezionato`
    );
  }

  private updateProductQuantityWithBalance(
    index: number,
    quantity: number,
    balance: ProductBalance
  ): void {
    try {
      const currentProducts = [...this.selectedProducts()];
      if (index >= currentProducts.length) return;

      // Proteggiamo contro valori undefined
      const availableQty = balance?.currentQuantity ?? 0;
      const exceedsAvailable = quantity > availableQty;

      currentProducts[index] = {
        ...currentProducts[index],
        availableQty,
        exceedsAvailable,
      };

      this.selectedProducts.set(currentProducts);

      // Mostra avviso se necessario
      if (exceedsAvailable) {
        this.toastService.showWarn(
          `Attenzione: La quantità richiesta (${quantity}) supera la disponibilità (${availableQty})`
        );
      }
    } catch (error) {
      console.error('Errore in updateProductQuantityWithBalance:', error);
    }
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
