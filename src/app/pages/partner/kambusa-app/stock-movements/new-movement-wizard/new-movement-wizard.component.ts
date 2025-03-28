import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessagesModule } from 'primeng/messages';
import { MessageModule } from 'primeng/message';

import { StockMovementStore } from '../../../../../core/store/stock-movement.signal-store';
import { RawProductStore } from '../../../../../core/store/rawproduct.signal-store';
import { WarehouseStore } from '../../../../../core/store/warehouse.signal-store';
import { ProjectStore } from '../../../../../core/store/project.signal-store';
import { ToastService } from '../../../../../core/services/toast.service';

import {
  Warehouse,
  WarehouseType,
} from '../../../../../core/models/warehouse.model';
import {
  StockMovement,
  StockMovementType,
  InboundMovementDto,
  OutboundMovementDto,
  TransferMovementDto,
  InventoryCheckDto,
} from '../../../../../core/models/stock-movement.model';
import { RawProduct } from '../../../../../core/models/rawproduct.model';

interface WizardStep {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-new-movement-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    StepsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    InputNumberModule,
    TextareaModule,
    TableModule,
    AutoCompleteModule,
    TooltipModule,
    CardModule,
    DividerModule,
    MessagesModule,
    MessageModule,
  ],
  templateUrl: './new-movement-wizard.component.html',
})
export class NewMovementWizardComponent implements OnInit, OnDestroy {
  @Input() warehouse: Warehouse | null = null;
  @Input() warehouseType: WarehouseType = 'PHYSICAL';

  @Output() movementCreated = new EventEmitter<StockMovement>();
  @Output() cancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private stockMovementStore = inject(StockMovementStore);
  private rawProductStore = inject(RawProductStore);
  private warehouseStore = inject(WarehouseStore);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);

  // Stato del wizard
  currentStep = 0;
  steps: WizardStep[] = [
    { label: 'Tipo', icon: 'pi pi-tag' },
    { label: 'Dettagli', icon: 'pi pi-file' },
    { label: 'Prodotti', icon: 'pi pi-list' },
    { label: 'Conferma', icon: 'pi pi-check' },
  ];

  // Opzioni per i tipi di movimento
  movementTypes = [
    {
      label: 'Carico Prodotti',
      value: StockMovementType.PURCHASE,
      icon: 'pi pi-plus-circle',
      description: 'Aggiungi nuovi prodotti al magazzino',
      color: 'bg-green-100',
    },
    {
      label: 'Scarico Prodotti',
      value: StockMovementType.INTERNAL_USE,
      icon: 'pi pi-minus-circle',
      description: 'Rimuovi prodotti dal magazzino per utilizzo interno',
      color: 'bg-blue-100',
    },
    {
      label: 'Trasferimento',
      value: StockMovementType.TRANSFER,
      icon: 'pi pi-sync',
      description: 'Trasferisci prodotti tra magazzini',
      color: 'bg-orange-100',
    },
    {
      label: 'Rettifica Inventario',
      value: StockMovementType.INVENTORY,
      icon: 'pi pi-check-square',
      description: "Aggiusta le quantità in base all'inventario fisico",
      color: 'bg-purple-100',
    },
    {
      label: 'Spreco',
      value: StockMovementType.WASTE,
      icon: 'pi pi-trash',
      description: 'Registra prodotti persi o scaduti',
      color: 'bg-red-100',
    },
  ];

  // Form groups
  typeForm: FormGroup;
  detailsForm: FormGroup;
  productsForm: FormGroup;

  // Stato dati
  selectedType: StockMovementType | null = null;
  rawProducts: RawProduct[] = [];
  filteredProducts: RawProduct[] = [];
  warehouses: Warehouse[] = [];
  targetWarehouse: Warehouse | null = null;

  // Stato calcolo
  totals = {
    quantity: 0,
    amount: 0,
  };

  // Stato completamento
  submitting = false;
  completed = false;

  constructor() {
    // Inizializzo i form
    this.typeForm = this.fb.group({
      movementType: [null, Validators.required],
    });

    this.detailsForm = this.fb.group({
      movementDate: [new Date(), Validators.required],
      reference: [''],
      notes: [''],
      documentNumber: [''],
      targetWarehouseId: [null], // Solo per trasferimenti
    });

    this.productsForm = this.fb.group({
      products: this.fb.array([]),
    });

    // Effect per monitorare la creazione del movimento
    effect(() => {
      const movement = this.stockMovementStore.selectedMovement();
      const error = this.stockMovementStore.error();

      // Controlla se c'è stato un errore
      if (error && this.submitting) {
        this.submitting = false;
        this.toastService.showError(
          'Errore nella creazione del movimento: ' + error
        );
        return;
      }

      // Verifica se un nuovo movimento è stato creato
      if (movement && this.submitting && !this.completed) {
        this.handleMovementCreated(movement);
      }
    });
  }

  ngOnInit() {
    this.loadData();

    // Aggiungi la prima riga prodotto vuota
    this.addProduct();

    // Subscribe al cambiamento del tipo di movimento
    this.typeForm.get('movementType')?.valueChanges.subscribe((value) => {
      this.selectedType = value;

      // Reset del form prodotti quando cambia il tipo
      while (this.products.length) {
        this.products.removeAt(0);
      }

      this.addProduct();
    });
  }

  ngOnDestroy() {
    // Pulisci lo stato quando il componente viene distrutto
    this.stockMovementStore.clearErrors();
  }

  private loadData() {
    const projectId = this.projectStore.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    // Carica prodotti grezzi
    this.rawProductStore.fetchProjectRawProducts({ projectId });
    setTimeout(() => {
      this.rawProducts = this.rawProductStore.rawProducts() || [];
    }, 500);

    // Carica magazzini per trasferimenti
    if (this.warehouseType === 'PHYSICAL') {
      this.warehouseStore.fetchWarehouses({
        projectId,
      });
      setTimeout(() => {
        this.warehouses = (this.warehouseStore.warehouses() || []).filter(
          (w) => w.id !== this.warehouse?.id
        ); // Filtro il magazzino corrente
      }, 500);
    }
  }

  get products(): FormArray {
    return this.productsForm.get('products') as FormArray;
  }

  addProduct() {
    const product = this.fb.group({
      rawProductId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
      // Per inventario
      expectedQty: [
        {
          value: 0,
          disabled: this.selectedType !== StockMovementType.INVENTORY,
        },
      ],
      actualQty: [
        {
          value: 0,
          disabled: this.selectedType !== StockMovementType.INVENTORY,
        },
      ],
    });

    this.products.push(product);
  }

  removeProduct(index: number) {
    this.products.removeAt(index);
    this.calculateTotals();
  }

  searchProducts(event: any, index: number) {
    const query = event.query.toLowerCase();
    this.filteredProducts = this.rawProducts.filter(
      (product) =>
        product.description.toLowerCase().includes(query) ||
        product.productCode?.toLowerCase().includes(query)
    );
  }

  onProductSelect(event: any, index: number) {
    const product = event;
    if (
      product &&
      product.purchaseHistory &&
      product.purchaseHistory.length > 0
    ) {
      // Precompila il prezzo unitario con l'ultimo prezzo di acquisto
      const lastPurchase =
        product.purchaseHistory[product.purchaseHistory.length - 1];
      this.products.at(index).patchValue({
        unitPrice: lastPurchase.unitPrice,
      });
    }

    // Se è una rettifica inventario, aggiorna la quantità attesa
    if (this.selectedType === StockMovementType.INVENTORY && this.warehouse) {
      const warehouseInventory =
        this.warehouseStore.selectedWarehouseInventory();
      if (warehouseInventory && warehouseInventory.products) {
        const item = warehouseInventory.products.find(
          (i) => i.rawProductId === product.id
        );
        if (item) {
          this.products.at(index).patchValue({
            expectedQty: item.quantity,
            actualQty: item.quantity, // Default, l'utente può cambiare
          });

          // Assicurati che i campi inventory siano abilitati
          this.products.at(index).get('expectedQty')?.enable();
          this.products.at(index).get('actualQty')?.enable();
        }
      }
    }

    this.calculateTotals();
  }

  calculateTotals() {
    let totalQuantity = 0;
    let totalAmount = 0;

    for (let i = 0; i < this.products.length; i++) {
      const product = this.products.at(i).value;
      const quantity = parseFloat(product.quantity) || 0;
      const unitPrice = parseFloat(product.unitPrice) || 0;

      totalQuantity += quantity;
      totalAmount += quantity * unitPrice;
    }

    this.totals = {
      quantity: totalQuantity,
      amount: totalAmount,
    };
  }

  getSelectedTypeInfo() {
    if (!this.selectedType) return null;
    return this.movementTypes.find((t) => t.value === this.selectedType);
  }

  nextStep() {
    if (this.currentStep === 0) {
      if (this.typeForm.invalid) {
        this.toastService.showWarn('Seleziona un tipo di movimento');
        return;
      }
    } else if (this.currentStep === 1) {
      if (this.detailsForm.invalid) {
        this.toastService.showWarn('Compila tutti i campi obbligatori');
        return;
      }

      // Se è un trasferimento, verifica il magazzino di destinazione
      if (this.selectedType === StockMovementType.TRANSFER) {
        if (!this.detailsForm.get('targetWarehouseId')?.value) {
          this.toastService.showWarn('Seleziona un magazzino di destinazione');
          return;
        }
      }
    } else if (this.currentStep === 2) {
      if (this.productsForm.invalid) {
        this.toastService.showWarn('Verifica i dati dei prodotti');
        return;
      }

      if (this.products.length === 0) {
        this.toastService.showWarn('Aggiungi almeno un prodotto');
        return;
      }

      // Calcola totali prima di proseguire
      this.calculateTotals();
    }

    this.currentStep++;
  }

  prevStep() {
    this.currentStep--;
  }

  cancelWizard() {
    this.cancel.emit();
  }

  getProductDisplayFn() {
    return (product: RawProduct) => (product ? product.description : '');
  }

  getWarehouseById(id: string): Warehouse | undefined {
    return this.warehouses.find((w) => w.id === id);
  }

  getMovementTypeLabel(type: StockMovementType): string {
    const typeInfo = this.movementTypes.find((t) => t.value === type);
    return typeInfo ? typeInfo.label : 'Sconosciuto';
  }

  submitMovement() {
    if (this.submitting) return;

    const projectId = this.projectStore.selectedProject()?.id;
    const warehouseId = this.warehouse?.id;

    if (!projectId || !warehouseId) {
      this.toastService.showError('Dati insufficienti per creare il movimento');
      return;
    }

    this.submitting = true;

    const typeValue = this.typeForm.value;
    const detailsValue = this.detailsForm.value;
    const productsValue = this.productsForm.value;

    try {
      // Converte la data in formato ISO string
      const movementDate = detailsValue.movementDate
        ? new Date(detailsValue.movementDate).toISOString()
        : new Date().toISOString();

      // Preparazione dei prodotti comuni a tutti i tipi di movimento
      const products = productsValue.products.map((p: any) => ({
        rawProductId:
          typeof p.rawProductId === 'object'
            ? p.rawProductId.id
            : p.rawProductId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        notes: p.notes,
      }));

      switch (typeValue.movementType) {
        case StockMovementType.PURCHASE:
          this.createInboundMovement({
            data: {
              movementType: StockMovementType.PURCHASE,
              products,
              movementDate,
              reference: detailsValue.reference,
              notes: detailsValue.notes,
              documentNumber: detailsValue.documentNumber,
            },
          });
          break;

        case StockMovementType.INTERNAL_USE:
        case StockMovementType.WASTE:
          this.createOutboundMovement({
            data: {
              movementType: typeValue.movementType,
              products,
              movementDate,
              reference: detailsValue.reference,
              notes: detailsValue.notes,
              documentNumber: detailsValue.documentNumber,
            },
          });
          break;

        case StockMovementType.TRANSFER:
          if (!detailsValue.targetWarehouseId) {
            throw new Error('Magazzino di destinazione non selezionato');
          }

          this.createTransferMovement({
            data: {
              sourceWarehouseId: warehouseId,
              targetWarehouseId: detailsValue.targetWarehouseId,
              products,
              movementDate,
              reference: detailsValue.reference,
              notes: detailsValue.notes,
              documentNumber: detailsValue.documentNumber,
            },
          });
          break;

        case StockMovementType.INVENTORY:
          // Per l'inventario, mappiamo anche le quantità attese e reali
          const inventoryProducts = productsValue.products.map((p: any) => ({
            rawProductId:
              typeof p.rawProductId === 'object'
                ? p.rawProductId.id
                : p.rawProductId,
            expectedQty: p.expectedQty,
            actualQty: p.actualQty,
            unitPrice: p.unitPrice,
            notes: p.notes,
          }));

          this.createInventoryCheck({
            data: {
              products: inventoryProducts,
              movementDate,
              reference: detailsValue.reference,
              notes: detailsValue.notes,
              documentNumber: detailsValue.documentNumber,
            },
          });
          break;

        default:
          throw new Error('Tipo di movimento non supportato');
      }
    } catch (error) {
      this.submitting = false;
      this.toastService.showError(
        'Errore nella creazione del movimento: ' + (error as Error).message
      );
    }
  }

  private createInboundMovement(params: { data: InboundMovementDto }): void {
    const projectId = this.projectStore.selectedProject()?.id;
    const warehouseId = this.warehouse?.id;

    if (!projectId || !warehouseId) {
      this.toastService.showError(
        'Dati mancanti - non è possibile creare il movimento'
      );
      return;
    }

    this.stockMovementStore.createInboundMovement({
      projectId,
      warehouseId,
      data: params.data,
    });
  }

  private createOutboundMovement(params: { data: OutboundMovementDto }): void {
    const projectId = this.projectStore.selectedProject()?.id;
    const warehouseId = this.warehouse?.id;

    if (!projectId || !warehouseId) {
      this.toastService.showError(
        'Dati mancanti - non è possibile creare il movimento'
      );
      return;
    }

    this.stockMovementStore.createOutboundMovement({
      projectId,
      warehouseId,
      data: params.data,
    });
  }

  private createTransferMovement(params: { data: TransferMovementDto }): void {
    const projectId = this.projectStore.selectedProject()?.id;

    if (!projectId) {
      this.toastService.showError('Progetto non selezionato');
      return;
    }

    this.stockMovementStore.createTransferMovement({
      projectId,
      data: params.data,
    });
  }

  private createInventoryCheck(params: { data: InventoryCheckDto }): void {
    const projectId = this.projectStore.selectedProject()?.id;
    const warehouseId = this.warehouse?.id;

    if (!projectId || !warehouseId) {
      this.toastService.showError(
        'Dati mancanti - non è possibile creare il movimento'
      );
      return;
    }

    this.stockMovementStore.createInventoryCheck({
      projectId,
      warehouseId,
      data: params.data,
    });
  }

  private handleMovementCreated(movement: StockMovement): void {
    this.completed = true;
    this.submitting = false;
    this.movementCreated.emit(movement);
  }

  // Helpers per validazione UI
  isProductSelected(index: number): boolean {
    const product = this.products.at(index).get('rawProductId');
    return !!product?.value;
  }

  getRawProductName(product: any): string {
    if (!product) return '';
    return typeof product === 'object'
      ? product.description
      : this.rawProducts.find((p) => p.id === product)?.description ||
          'Prodotto sconosciuto';
  }
}
