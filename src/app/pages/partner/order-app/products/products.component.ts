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
import { InputNumberModule } from 'primeng/inputnumber';
// Alternativa
import { InputTextarea } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { FileUploadModule } from 'primeng/fileupload';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { AuthStore } from '../../../../core/store/auth.signal-store';
import { CategoryStore } from '../../../../core/store/category.signal-store';
import { ProductStore } from '../../../../core/store/product.signal-store';
import { Project } from '../../../../core/models/project.model';
import { Category } from '../../../../core/models/category.model';
import { CategoryService as CCCategoryService } from '../../../../core/services/api/cassa-cloud/category.service';
import {
  Product,
  CreateProductDto,
  UpdateProductDto,
  mapCCProductToProduct,
} from '../../../../core/models/product.model';
import { ICCProduct } from '../../../../core/interfaces/cassaincloud.interfaces';
import {
  ProductService as CCProductService,
  ProductChannel as CCProductChannel,
} from '../../../../core/services/api/cassa-cloud/product.service';
import { finalize, map } from 'rxjs/operators';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import { OrderListModule } from 'primeng/orderlist';
import { DragDropModule } from 'primeng/dragdrop';
import { ActivatedRoute } from '@angular/router';
import {
  DepartmentService,
  Department,
  SalesType,
} from '../../../../core/services/api/cassa-cloud/department.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
    DialogModule,
    CheckboxModule,
    DropdownModule,
    TagModule,
    MultiSelectModule,
    TooltipModule,
    OrderListModule,
    DragDropModule,
    FileUploadModule,
  ],
  templateUrl: './products.component.html',
  styles: [
    `
      .progress-bar {
        width: 100%;
        height: 10px;
        background-color: #e9ecef;
        border-radius: 5px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background-color: #3b82f6;
        transition: width 0.3s ease;
      }
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

      .product-card {
        display: flex;
        flex-direction: column;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 1rem;
        margin-bottom: 1rem;
        position: relative;
      }

      .product-card .product-actions {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        display: flex;
        gap: 0.5rem;
      }

      .product-card .product-price {
        font-weight: bold;
        font-size: 1.1rem;
        color: #2563eb;
      }

      .product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
      }

      /* Stile per i dialog responsive */
      ::ng-deep .product-dialog .p-dialog-content {
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

        .product-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProductsComponent implements OnInit {
  // Inject services
  private projectStore = inject(ProjectStore);
  private authStore = inject(AuthStore);
  private categoryStore = inject(CategoryStore);
  private productStore = inject(ProductStore);
  private ccProductService = inject(CCProductService);
  private departmentService = inject(DepartmentService); // Aggiungi servizio dipartimenti
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);
  private formBuilder = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private ccCategoryService = inject(CCCategoryService); // Aggiungi servizio categorie CC

  // State signals
  selectedProject = this.projectStore.selectedProject;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;
  categories = this.categoryStore.categories;
  products = this.productStore.products;
  selectedProduct = this.productStore.selectedProduct;
  loading = signal<boolean>(false);
  departments = signal<Department[]>([]);
  loadingDepartments = signal<boolean>(false);
  ccCategories = signal<any[]>([]);
  filteredCCCategories = signal<any[]>([]);
  filteredProducts = signal<Product[] | null>(null);
  // Aggiungi queste variabili alla classe ProductsComponent
  importingProducts = signal<boolean>(false);
  importProgress = signal<number>(0);
  totalProductsToImport = signal<number>(0);
  // View mode (grid/list)
  viewMode = signal<'grid' | 'list'>('grid');

  // Selected category for filtering
  selectedCategoryId: string | null = null;

  // CC Products state
  ccProducts = signal<ICCProduct[] | null>(null);
  filteredCCProducts = signal<ICCProduct[] | null>(null);
  loadingCCProducts = signal<boolean>(false);
  errorCCProducts = signal<string | null>(null);
  selectedCCProducts = signal<ICCProduct[]>([]);

  // Search
  searchQuery = '';
  searchCCQuery = '';

  // Dialog state
  createDialogVisible = signal<boolean>(false);
  creatingProduct = signal<boolean>(false);
  createForm!: FormGroup;

  // Edit product dialog
  editDialogVisible = signal<boolean>(false);
  editingProduct = signal<Product | null>(null);
  editForm!: FormGroup;
  updatingProduct = signal<boolean>(false);

  // Sync dialog
  syncDialogVisible = signal<boolean>(false);

  // Aggiungi queste proprietà alla classe
  productImage: string | null = null;
  availableAllergens = [
    { id: 'gluten', name: 'Glutine' },
    { id: 'crustaceans', name: 'Crostacei' },
    { id: 'eggs', name: 'Uova' },
    { id: 'fish', name: 'Pesce' },
    { id: 'peanuts', name: 'Arachidi' },
    { id: 'soybeans', name: 'Soia' },
    { id: 'milk', name: 'Latte' },
    { id: 'nuts', name: 'Frutta a guscio' },
    { id: 'celery', name: 'Sedano' },
    { id: 'mustard', name: 'Senape' },
    { id: 'sesame', name: 'Sesamo' },
    { id: 'sulphites', name: 'Solfiti' },
    { id: 'lupin', name: 'Lupini' },
    { id: 'molluscs', name: 'Molluschi' },
  ];

  constructor() {
    // Effect to track project changes
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        // Load local categories first
        this.categoryStore.fetchPartnerCategories();

        // Load products after categories are loaded
        setTimeout(() => {
          this.loadProducts();
        }, 500);
      }
    });

    // Effect to update filteredProducts when products change
    effect(() => {
      const products = this.products();
      this.filteredProducts.set(products);
    });

    // Initialize forms
    this.initCreateForm();
    this.initEditForm();
  }

  ngOnInit(): void {
    // Subscribe to route params to get category ID if specified
    this.route.params.subscribe((params) => {
      if (params['categoryId']) {
        this.selectedCategoryId = params['categoryId'];
        // Load products for this category
        this.loadProductsByCategory(params['categoryId']);
      }
    });
  }

  /**
   * Ottiene il nome dell'allergene dal suo id
   */
  getAllergenName(allergenId: string): string {
    const allergen = this.availableAllergens.find((a) => a.id === allergenId);
    return allergen ? allergen.name : allergenId;
  }

  /**
   * Metodo per gestire il caricamento di un'immagine
   */
  onImageUpload(event: any): void {
    // Il parametro event ha un formato diverso quando customUpload è true
    const files = event.files;
    if (!files || files.length === 0) {
      console.warn('Nessun file selezionato per il caricamento');
      return;
    }

    const file = files[0];

    // Verifica se il file è una immagine valida
    if (!this.isValidImage(file)) {
      if (event.clear) event.clear();
      return;
    }

    console.log('File selezionato:', file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      console.log(
        'File caricato con successo, dimensione dati:',
        e.target.result.length
      );
      this.productImage = e.target.result;

      // Con customUpload, dobbiamo gestire la UI noi stessi
      if (event.clear) event.clear();
    };

    reader.onerror = (error) => {
      console.error('Errore durante la lettura del file:', error);
      this.toastService.showError(
        "Errore durante il caricamento dell'immagine"
      );
    };

    reader.readAsDataURL(file);
  }

  /**
   * Verifica se il file è una immagine valida
   */
  private isValidImage(file: File): boolean {
    // Verifica il tipo di file
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.toastService.showError(
        'Formato immagine non supportato. Usa JPG, PNG, GIF o WebP.'
      );
      return false;
    }

    // Verifica la dimensione (max 1MB)
    if (file.size > 1000000) {
      this.toastService.showError(
        "L'immagine è troppo grande. Dimensione massima: 1MB"
      );
      return false;
    }

    return true;
  }

  /**
   * Rimuove l'immagine caricata
   */
  removeImage(): void {
    this.productImage = null;
  }

  /**
   * Carica le categorie da Cassa in Cloud
   */
  loadCCCategories(): void {
    const project = this.selectedProject();
    if (!project || !project.CCApiKey || !project.CCSalesPointId) {
      return;
    }

    // Converti l'ID del punto vendita in numero
    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      return;
    }

    // Carica le categorie da CC
    this.ccCategoryService
      .getCategoriesBySalesPoint(project.CCApiKey, salesPointId)
      .pipe(finalize(() => {}))
      .subscribe({
        next: (response) => {
          console.log('Categorie CC caricate:', response.categories);
          this.ccCategories.set(response.categories);
          this.filteredCCCategories.set(response.categories);
        },
        error: (err) => {
          console.error('Errore caricamento categorie CC:', err);
        },
      });
  }

  /**
   * Loads products based on current selection
   */
  loadProducts(): void {
    const categoryId = this.selectedCategoryId;
    if (categoryId) {
      this.loadProductsByCategory(categoryId);
    } else {
      // Modificare in products.component.ts
      this.productStore.fetchPartnerProducts();
    }

    // If project has CC connection, load CC products
    const project = this.selectedProject();
    if (
      project &&
      project.CCConnection &&
      project.CCApiKey &&
      project.CCSalesPointId
    ) {
      this.fetchCCProducts(project);
    } else {
      this.ccProducts.set(null);
      this.filteredCCProducts.set(null);
    }
  }

  /**
   * Loads products based on current selection
   */
  loadOnlyLocalProducts(): void {
    const categoryId = this.selectedCategoryId;
    if (categoryId) {
      this.loadProductsByCategory(categoryId);
    } else {
      // Modificare in products.component.ts
      this.productStore.fetchPartnerProducts();
    }
  }

  /**
   * Loads products for a specific category
   */
  loadProductsByCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
    this.productStore.fetchPartnerProductsByCategory({ categoryId });

    // Resetta la ricerca quando cambi categoria
    if (this.searchQuery) {
      this.searchQuery = '';
      this.filterProducts('');
    }
  }

  /**
   * Initializes the create product form
   */
  initCreateForm(): void {
    this.createForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      departmentId: [''], // Dipartimento per CC
      allergens: [[]], // Array di allergeni
      calories: [0],
      sortOrder: [0],
      isActive: [true],
      CCConnection: [false],
      additionalData: this.formBuilder.group({
        isVegetarian: [false],
        isVegan: [false],
        isGlutenFree: [false],
        isLactoseFree: [false],
        ingredients: [[]],
        tags: [[]],
      }),
    });

    // Aggiungiamo un listener per mostrare/nascondere il campo dipartimento
    this.createForm.get('CCConnection')?.valueChanges.subscribe((value) => {
      if (value) {
        this.createForm
          .get('departmentId')
          ?.setValidators([Validators.required]);
        // Se CC abilitato, carica i dipartimenti se non già presenti
        if (this.departments().length === 0) {
          this.loadDepartments();
        }
      } else {
        this.createForm.get('departmentId')?.clearValidators();
      }
      this.createForm.get('departmentId')?.updateValueAndValidity();
    });
  }

  /**
   * Carica i dipartimenti da Cassa in Cloud
   */
  loadDepartments(): void {
    const project = this.selectedProject();
    if (!project || !project.CCApiKey || !project.CCSalesPointId) {
      return;
    }

    this.loadingDepartments.set(true);

    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      this.loadingDepartments.set(false);
      return;
    }

    // Verifica se i dipartimenti sono già stati caricati
    if (this.departments().length > 0) {
      this.loadingDepartments.set(false);
      return;
    }

    this.departmentService
      .getDepartmentsBySalesPoint(project.CCApiKey, salesPointId)
      .pipe(finalize(() => this.loadingDepartments.set(false)))
      .subscribe({
        next: (response) => {
          console.log('Dipartimenti caricati:', response.departments.length);
          this.departments.set(response.departments);
        },
        error: (err) => {
          console.error('Error fetching departments:', err);
          this.toastService.showError(
            'Errore nel caricamento dei dipartimenti'
          );
        },
      });
  }

  /**
   * Initializes the edit product form
   */
  initEditForm(): void {
    this.editForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      departmentId: [''], // Campo per dipartimento CC
      allergens: [[]],
      calories: [0],
      sortOrder: [0],
      isActive: [true],
      CCConnection: [false],
      updateCC: [false], // Nuovo campo per aggiornare su CC
      additionalData: this.formBuilder.group({
        isVegetarian: [false],
        isVegan: [false],
        isGlutenFree: [false],
        isLactoseFree: [false],
        ingredients: [[]],
        tags: [[]],
      }),
    });

    // Aggiungiamo un ascoltatore per il CCConnection per gestire il campo departmentId
    this.editForm.get('CCConnection')?.valueChanges.subscribe((value) => {
      if (value) {
        this.editForm.get('departmentId')?.setValidators([Validators.required]);
        // Se CC abilitato, carica i dipartimenti se non già presenti
        if (this.departments().length === 0) {
          this.loadDepartments();
        }
      } else {
        this.editForm.get('departmentId')?.clearValidators();
      }
      this.editForm.get('departmentId')?.updateValueAndValidity();
    });
  }
  /**
   * Fetches products from Cassa in Cloud, handling pagination automatically
   */
  fetchCCProducts(project: Project): void {
    if (!project.CCApiKey || !project.CCSalesPointId) {
      this.errorCCProducts.set('API Key o ID punto vendita mancante');
      return;
    }

    this.loadingCCProducts.set(true);
    this.errorCCProducts.set(null);

    // Carica le categorie CC se non sono già state caricate
    if (this.ccCategories().length === 0) {
      this.loadCCCategories();
    }

    // Converti l'ID del punto vendita in numero
    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      this.errorCCProducts.set('ID punto vendita non valido');
      this.loadingCCProducts.set(false);
      return;
    }

    // Aggiorna la descrizione per filtrare i prodotti se c'è una query di ricerca
    const searchParams: Partial<any> = {};
    if (this.searchCCQuery.trim()) {
      searchParams['description'] = this.searchCCQuery.trim();
    }

    // Utilizziamo il nuovo metodo che gestisce la paginazione automaticamente
    this.ccProductService
      .getAllProductsBySalesPoint(
        project.CCApiKey,
        salesPointId,
        [CCProductChannel.SELFORDER, CCProductChannel.RISTO], // Filtra solo i prodotti pertinenti
        searchParams
      )
      .pipe(finalize(() => this.loadingCCProducts.set(false)))
      .subscribe({
        next: (products) => {
          // Il nuovo metodo restituisce un array di prodotti, non un oggetto ProductsResponse
          console.log(
            `Recuperati ${products.length} prodotti dal punto vendita ${salesPointId}`
          );

          this.ccProducts.set(products);
          this.filteredCCProducts.set(products);

          // Aggiorna la UI per mostrare che ci sono nuovi prodotti
          if (products.length === 0) {
            this.errorCCProducts.set(
              'Nessun prodotto trovato su Cassa in Cloud'
            );
          }
        },
        error: (error) => {
          console.error('Errore nel recupero dei prodotti:', error);
          this.errorCCProducts.set(
            error.message || 'Errore nel recupero dei prodotti'
          );
        },
      });
  }

  /**
   * Refreshes products data
   */
  refreshProducts(): void {
    // Reset search query when refreshing
    this.searchQuery = '';

    // Reload categories first to ensure we have the latest mappings
    this.categoryStore.fetchPartnerCategories();

    // Then load products
    setTimeout(() => {
      this.loadProducts();
    }, 300);
  }

  /**
   * Filters local products based on search query
   */
  filterProducts(query: string): void {
    this.searchQuery = query;

    // Aggiorna prodotti filtrati in base alla query di ricerca
    const allProducts = this.products() || [];

    if (!query || query.trim() === '') {
      // Se non c'è query di ricerca, mostra tutti i prodotti
      this.filteredProducts.set(allProducts);
    } else {
      // Filtra i prodotti in base alla query
      const filtered = allProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          (product.description &&
            product.description.toLowerCase().includes(query.toLowerCase()))
      );
      this.filteredProducts.set(filtered);
    }
  }
  /**
   * Filters CC products based on search query
   */
  filterCCProducts(query: string): void {
    const ccProductsValue = this.ccProducts();
    this.searchCCQuery = query;

    if (!ccProductsValue || !query) {
      this.filteredCCProducts.set(ccProductsValue);
      return;
    }

    const filtered = ccProductsValue.filter((product) =>
      product.description.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredCCProducts.set(filtered);
  }

  /**
   * Opens the create product dialog
   */
  openCreateDialog(): void {
    // Prima verifichiamo se è possibile utilizzare Cassa in Cloud
    const project = this.selectedProject();
    const ccEnabled =
      project?.CCConnection && project?.CCApiKey && project?.CCSalesPointId;

    // Se l'integrazione CC è abilitata, carichiamo i dipartimenti
    if (ccEnabled && this.departments().length === 0) {
      this.loadDepartments();
    }

    // Reset dell'immagine
    this.productImage = null;

    // Reset form
    this.createForm.reset({
      name: '',
      description: '',
      price: 0,
      categoryId: this.selectedCategoryId || '',
      departmentId: '', // Campo dipartimento inizialmente vuoto
      allergens: [],
      calories: 0,
      sortOrder: this.products()?.length || 0,
      isActive: true,
      CCConnection: ccEnabled,
      additionalData: {
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
        isLactoseFree: false,
        ingredients: [],
        tags: [],
      },
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
   * Opens the edit product dialog
   */
  openEditDialog(id: string): void {
    const product = this.products()?.find((p) => p.id === id);
    if (!product) {
      this.toastService.showError('Prodotto non trovato');
      return;
    }

    this.editingProduct.set(product);

    // Carica l'immagine del prodotto se presente
    this.productImage = product.additionalData?.['image'] || null;

    // Carica dipartimenti se il prodotto è collegato a CC
    if (product.CCConnection && this.departments().length === 0) {
      this.loadDepartments();
    }

    // Populate form - corretto l'accesso a additionalData.CCDepartmentId usando la notazione a parentesi quadre
    this.editForm.patchValue({
      name: product.name,
      description: product.description || '',
      price: product.price, // Non dividiamo per 100, il prezzo è già nel formato corretto
      categoryId: product.categoryId,
      departmentId: product.CCProduct?.department.id || '',
      allergens: product.allergens || [],
      calories: product.calories || 0,
      sortOrder: product.sortOrder || 0,
      isActive: product.isActive,
      CCConnection: product.CCConnection || false,
      updateCC: false, // Default a false per sicurezza
      additionalData: {
        isVegetarian: product.additionalData?.['isVegetarian'] || false,
        isVegan: product.additionalData?.['isVegan'] || false,
        isGlutenFree: product.additionalData?.['isGlutenFree'] || false,
        isLactoseFree: product.additionalData?.['isLactoseFree'] || false,
        ingredients: product.additionalData?.['ingredients'] || [],
        tags: product.additionalData?.['tags'] || [],
      },
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Closes the edit dialog
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingProduct.set(null);
    this.editForm.reset();
    this.productImage = null; // Reset dell'immagine
  }

  /**
   * Crea un nuovo prodotto, prima su Cassa in Cloud se necessario, poi localmente
   */
  async createProduct(): Promise<void> {
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
      this.creatingProduct.set(true);

      // Prepara i dati di base del prodotto
      const formValues = this.createForm.value;
      const productData: CreateProductDto = {
        name: formValues.name,
        description: formValues.description || '',
        price: formValues.price,
        categoryId: formValues.categoryId,
        allergens: formValues.allergens || [],
        calories: formValues.calories || 0,
        sortOrder: formValues.sortOrder,
        isActive: formValues.isActive,
        projectId: project.id,
        partnerId: project.partnerId || '',
        CCConnection: formValues.CCConnection && project.CCConnection,
        additionalData: {
          ...formValues.additionalData,
          image: this.productImage || null, // Aggiungi l'immagine se caricata
        },
      };

      // Se l'integrazione con Cassa in Cloud è abilitata, crea prima il prodotto su CC
      if (
        productData.CCConnection &&
        project.CCApiKey &&
        project.CCSalesPointId
      ) {
        // Trova la categoria CC collegata alla categoria locale
        const localCategory = this.categories()?.find(
          (c) => c.id === productData.categoryId
        );

        if (!localCategory || !localCategory.CCCategoryId) {
          this.toastService.showError(
            'La categoria selezionata non ha un collegamento a Cassa in Cloud'
          );
          this.creatingProduct.set(false);
          return;
        }

        // Salva il CCCategoryId dalla categoria locale
        productData.CCCategoryId = localCategory.CCCategoryId;

        // Converte l'ID del punto vendita in numero
        const salesPointId = parseInt(project.CCSalesPointId, 10);
        if (isNaN(salesPointId)) {
          this.toastService.showError('ID punto vendita non valido');
          this.creatingProduct.set(false);
          return;
        }

        // Verifica che sia stato selezionato un dipartimento
        const departmentId = formValues.departmentId;
        if (!departmentId) {
          this.toastService.showError('Seleziona un dipartimento');
          this.creatingProduct.set(false);
          return;
        }

        // Prepara i parametri per la creazione del prodotto su CC
        const ccProductParams = {
          description: productData.name,
          descriptionLabel: productData.name,
          descriptionExtended: productData.description,
          descriptionReceipt: productData.name.substring(0, 32), // Limita la lunghezza della descrizione per lo scontrino
          idCategory: localCategory.CCCategoryId,
          idDepartment: departmentId, // Utilizziamo il dipartimento selezionato
          idSalesPoint: salesPointId,

          // Impostazioni predefinite
          multivariant: false,
          soldByWeight: false,

          // Abilita su tutti i canali per default
          enableForRisto: true,
          enableForSale: true,
          enableForECommerce: true,
          enableForMobileCommerce: true,
          enableForSelfOrderMenu: true,
          enableForKiosk: true,

          // Prezzo: richiede almeno un prezzo base senza modalità di vendita
          prices: [
            {
              value: productData.price,
              idSalesPoint: salesPointId,
            },
          ],
        };

        try {
          // Crea il prodotto su Cassa in Cloud
          const createdCCProduct = await firstValueFrom(
            this.ccProductService.createProduct(
              project.CCApiKey,
              ccProductParams
            )
          );

          if (createdCCProduct) {
            // Carica i dettagli completi del prodotto appena creato
            const ccProductDetails = await firstValueFrom(
              this.ccProductService.getProductById(
                project.CCApiKey,
                createdCCProduct.id
              )
            );

            if (ccProductDetails && ccProductDetails.product) {
              // Collega l'ID del prodotto CC al prodotto locale
              productData.CCProductId = createdCCProduct.id;
              productData.CCSalesPointId = project.CCSalesPointId;

              // Se il prodotto ha varianti, collega anche l'ID della variante
              if (
                ccProductDetails.product.variants &&
                ccProductDetails.product.variants.length > 0
              ) {
                productData.CCProductVariantId =
                  ccProductDetails.product.variants[0].id;
              }

              // Memorizza l'intero oggetto CC per riferimento
              productData.CCProduct = ccProductDetails.product;

              // Memorizza anche l'ID del dipartimento
              productData.additionalData = {
                ...productData.additionalData,
                CCDepartmentId: departmentId,
              };
            }
          }
        } catch (ccError: any) {
          console.error(
            'Errore creazione prodotto su Cassa in Cloud:',
            ccError
          );
          this.toastService.showError(
            `Errore su Cassa in Cloud: ${
              ccError.message || 'Errore sconosciuto'
            }`
          );
          this.creatingProduct.set(false);
          return;
        }
      }

      // Dopo aver gestito l'integrazione CC, crea il prodotto locale
      this.productStore.createProduct({ product: productData });

      // Chiudi il dialog dopo un breve ritardo per consentire l'aggiornamento dello store
      setTimeout(() => {
        this.closeCreateDialog();
        this.refreshProducts(); // Aggiorna l'elenco dei prodotti
      }, 500);

      this.toastService.showSuccess('Prodotto creato con successo');
    } catch (error: any) {
      console.error('Errore durante la creazione del prodotto:', error);
      this.toastService.showError(
        error.message || 'Errore durante la creazione del prodotto'
      );
    } finally {
      this.creatingProduct.set(false);
    }
  }

  /**
   * Updates an existing product
   */
  async updateProduct(): Promise<void> {
    if (this.editForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();
    const product = this.editingProduct();

    if (!project || !product) {
      this.toastService.showError('Dati mancanti');
      return;
    }

    try {
      this.updatingProduct.set(true);

      // Prepare update data
      const formValues = this.editForm.value;

      // Mantieni l'immagine esistente
      const additionalData = {
        ...formValues.additionalData,
        image: this.productImage, // L'immagine modificata o esistente
        CCDepartmentId: formValues.departmentId, // Salva il dipartimento CC
      };

      const updateData: UpdateProductDto = {
        name: formValues.name,
        description: formValues.description,
        price: formValues.price,
        categoryId: formValues.categoryId,
        allergens: formValues.allergens || [],
        calories: formValues.calories || 0,
        sortOrder: formValues.sortOrder,
        isActive: formValues.isActive,
        additionalData: additionalData,
      };

      // Opzione per aggiornare anche su Cassa in Cloud
      const updateCC =
        formValues.updateCC &&
        product.CCConnection &&
        project.CCApiKey &&
        product.CCProductId;

      if (updateCC) {
        try {
          // Prepara i dati per l'aggiornamento su Cassa in Cloud
          const ccUpdateParams: any = {
            description: updateData.name || product.name,
            descriptionLabel: updateData.name || product.name,
            descriptionExtended: updateData.description || product.description,
            idCategory: product.CCCategoryId,
            idDepartment: formValues.departmentId,
          };

          // Aggiungi i prezzi solo se il prezzo è stato specificato
          if (updateData.price !== undefined) {
            ccUpdateParams.prices = [
              {
                value: updateData.price,
                idSalesPoint: parseInt(product.CCSalesPointId || '', 10),
              },
            ];
          }

          // Aggiorna su Cassa in Cloud
          await firstValueFrom(
            this.ccProductService.updateProduct(
              project.CCApiKey!,
              product.CCProductId!,
              ccUpdateParams
            )
          );

          // Aggiorna il prodotto locale con il riferimento al prodotto CC aggiornato
          const updatedCCProduct = await firstValueFrom(
            this.ccProductService.getProductById(
              project.CCApiKey!,
              product.CCProductId!
            )
          );

          if (updatedCCProduct?.product) {
            // Non possiamo assegnare CCProduct direttamente a updateData
            // Aggiorna l'oggetto prodotto originale per mantere la referenza
            const updatedProduct = { ...product };
            updatedProduct.CCProduct = updatedCCProduct.product;
            this.editingProduct.set(updatedProduct);
          }

          this.toastService.showSuccess(
            'Prodotto aggiornato anche su Cassa in Cloud'
          );
        } catch (ccError: any) {
          console.error(
            'Errore aggiornamento prodotto su Cassa in Cloud:',
            ccError
          );
          this.toastService.showError(
            `Errore aggiornamento su Cassa in Cloud: ${
              ccError.message || 'Errore sconosciuto'
            }`
          );
          // Continuiamo comunque con l'aggiornamento locale
        }
      }

      // Update local product
      this.productStore.updateProduct({
        id: product.id!,
        product: updateData,
      });

      // Close dialog after a short delay to allow store update to complete
      setTimeout(() => {
        this.closeEditDialog();
        // Refreshiamo tutta la lista dei prodotti per assicurarci che la UI si aggiorni correttamente
        this.loadOnlyLocalProducts();
      }, 500);

      this.toastService.showSuccess('Prodotto aggiornato con successo');
    } catch (error: any) {
      console.error('Error updating product:', error);
      this.toastService.showError(
        error.message || "Errore durante l'aggiornamento del prodotto"
      );
    } finally {
      this.updatingProduct.set(false);
    }
  }

  /**
   * Elimina un prodotto, con opzione per eliminarlo anche da Cassa in Cloud se connesso
   */
  async deleteProduct(event: Event, id: string): Promise<void> {
    event.preventDefault();

    // Trova il prodotto da eliminare
    const product = this.products()?.find((p) => p.id === id);
    if (!product) {
      this.toastService.showError('Prodotto non trovato');
      return;
    }

    // Controlla se il prodotto è sincronizzato con Cassa in Cloud
    const isCCConnected = product.CCConnection && product.CCProductId;
    let confirmMessage = 'Sei sicuro di voler eliminare questo prodotto?';

    if (isCCConnected) {
      confirmMessage = 'Vuoi eliminare il prodotto anche da Cassa in Cloud?';
    }

    try {
      // Prima conferma - se il prodotto è connesso con CC, chiedi se eliminarlo anche da CC
      const result = await this.confirmDialogService
        .confirm(confirmMessage)
        .toPromise();

      if (!result) {
        // Se l'utente ha annullato quando gli è stato chiesto di eliminare da CC, chiedi se vuole eliminarlo solo localmente
        if (isCCConnected) {
          const localDeleteResult = await this.confirmDialogService
            .confirm('Vuoi eliminare il prodotto solo localmente?')
            .toPromise();

          if (!localDeleteResult) {
            // L'utente ha annullato anche l'eliminazione locale
            return;
          }

          // L'utente vuole eliminare solo localmente
          this.deleteLocalProduct(id);
          return;
        }

        // Per prodotti non CC, se annulla significa che non vuole eliminare
        return;
      }

      // Se arriviamo qui, l'utente ha confermato
      if (isCCConnected && result) {
        // L'utente ha confermato di eliminare anche da CC
        await this.deleteFromCassaCloud(product);

        // Dopo aver eliminato da CC, elimina anche localmente
        this.deleteLocalProduct(id);
        this.toastService.showSuccess(
          'Prodotto eliminato da Cassa in Cloud e localmente'
        );
      } else {
        // Per prodotti non connessi a CC o se l'utente ha scelto di non eliminare da CC
        this.deleteLocalProduct(id);
        this.toastService.showSuccess('Prodotto eliminato localmente');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      this.toastService.showError(
        error.message || "Errore durante l'eliminazione del prodotto"
      );
    }
  }

  /**
   * Elimina un prodotto solo localmente
   */
  private deleteLocalProduct(id: string): void {
    this.loading.set(true);
    try {
      this.productStore.deleteProduct({ id });
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Elimina un prodotto da Cassa in Cloud
   */
  private async deleteFromCassaCloud(product: Product): Promise<void> {
    const project = this.selectedProject();

    if (!project?.CCApiKey || !product.CCProductId) {
      this.toastService.showError(
        'Impossibile eliminare da Cassa in Cloud: credenziali o ID prodotto mancanti'
      );
      return;
    }

    try {
      this.loading.set(true);

      // Effettua la richiesta di eliminazione a Cassa in Cloud
      await firstValueFrom(
        this.ccProductService.deleteProduct(
          project.CCApiKey,
          product.CCProductId
        )
      );

      this.toastService.showSuccess('Prodotto eliminato da Cassa in Cloud');
    } catch (ccError: any) {
      console.error(
        "Errore durante l'eliminazione da Cassa in Cloud:",
        ccError
      );

      // Informa l'utente dell'errore
      this.toastService.showError(
        `Errore nell'eliminazione da Cassa in Cloud: ${
          ccError.message || 'Errore sconosciuto'
        }`
      );

      // Chiedi all'utente se vuole continuare con l'eliminazione locale
      const continueLocal = await this.confirmDialogService
        .confirm("Vuoi procedere con l'eliminazione locale del prodotto?")
        .toPromise();

      if (!continueLocal) {
        throw new Error("Operazione annullata dall'utente");
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Opens the sync dialog
   */
  openSyncDialog(): void {
    // Clear selected products
    this.selectedCCProducts.set([]);

    // Carica le categorie CC all'apertura del dialog
    this.loadCCCategories();

    this.syncDialogVisible.set(true);
  }

  /**
   * Closes the sync dialog
   */
  closeSyncDialog(): void {
    this.syncDialogVisible.set(false);
  }

  /**
   * Sincronizza i prodotti selezionati da Cassa in Cloud ai prodotti locali
   */
  async syncProducts(): Promise<void> {
    const project = this.selectedProject();
    const selectedProducts = this.selectedCCProducts();

    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    if (!selectedProducts || selectedProducts.length === 0) {
      this.toastService.showError('Nessun prodotto selezionato');
      return;
    }

    if (!project.CCSalesPointId) {
      this.toastService.showError('ID punto vendita CassaInCloud mancante');
      return;
    }

    // Verifica che ci siano categorie locali
    const localCategories = this.categories() || [];
    if (localCategories.length === 0) {
      this.toastService.showError('Devi creare prima le categorie locali');
      return;
    }

    try {
      // Inizializziamo le variabili di stato per il progresso
      this.importingProducts.set(true);
      this.importProgress.set(0);
      this.totalProductsToImport.set(0);

      // Crea una mappa per associare rapidamente CCCategoryId alle categorie locali
      const categoriesMap = new Map<string, Category>();
      for (const category of localCategories) {
        if (category.CCCategoryId) {
          categoriesMap.set(category.CCCategoryId, category);
        }
      }

      // Ottieni i prodotti locali esistenti
      const existingProducts = this.products() || [];

      // Crea una mappa dei prodotti esistenti per lookup rapido
      const existingProductsMap = new Map<string, Product>();
      for (const product of existingProducts) {
        if (product.CCProductId) {
          existingProductsMap.set(product.CCProductId, product);
        }
      }

      // Prepara array per gestire prodotti da importare e statistiche
      const productsToImport: Product[] = [];
      const productsToUpdate: Product[] = [];
      const skippedProducts: string[] = [];
      const categoriesMissing: string[] = [];

      // Mappa i prodotti CC nel formato locale
      for (const ccProduct of selectedProducts) {
        // Trova la categoria locale associata a questa categoria CC
        const localCategory = categoriesMap.get(ccProduct.idCategory);

        if (!localCategory) {
          // Se non c'è una categoria locale associata, salta questo prodotto
          categoriesMissing.push(ccProduct.description);
          continue;
        }

        // Verifica se questo prodotto esiste già localmente
        const existingProduct = existingProductsMap.get(ccProduct.id || '');

        if (existingProduct) {
          // Se il prodotto esiste già, verifica se è cambiato in CC
          const existingCCProduct = existingProduct.CCProduct;

          // Confronta i prodotti CC per verificare se ci sono differenze
          const isDifferent = this.isCCProductDifferent(
            existingCCProduct,
            ccProduct
          );

          if (!isDifferent) {
            // Se il prodotto non è cambiato, lo saltiamo
            skippedProducts.push(ccProduct.description);
            continue;
          } else {
            // Se il prodotto è cambiato, lo aggiungiamo all'elenco degli aggiornamenti
            // Mappa il prodotto CC nel formato locale mantenendo l'ID locale
            const updatedProduct = mapCCProductToProduct(
              ccProduct,
              project.id,
              project.partnerId || '',
              localCategory.id!,
              project.CCSalesPointId
            );

            // Mantieni l'ID del prodotto locale esistente
            updatedProduct.id = existingProduct.id;

            // Aggiungi il prodotto all'elenco degli aggiornamenti
            productsToUpdate.push(updatedProduct);
          }
        } else {
          // Se il prodotto non esiste, lo aggiungiamo come nuovo
          const localProduct = mapCCProductToProduct(
            ccProduct,
            project.id,
            project.partnerId || '',
            localCategory.id!,
            project.CCSalesPointId
          );

          // Carica il dipartimento se è configurato
          if (ccProduct.idDepartment) {
            // Salva l'ID del dipartimento nei dati aggiuntivi
            localProduct.additionalData = {
              ...localProduct.additionalData,
              CCDepartmentId: ccProduct.idDepartment,
            };
          }

          productsToImport.push(localProduct);
        }
      }

      // Verifica se ci sono prodotti da importare o aggiornare
      if (productsToImport.length === 0 && productsToUpdate.length === 0) {
        if (categoriesMissing.length > 0) {
          this.toastService.showError(
            `Non ci sono categorie locali associate ai prodotti selezionati. Importa prima le categorie necessarie.`
          );
        } else if (skippedProducts.length > 0) {
          this.toastService.showSuccess(
            `Tutti i prodotti selezionati (${skippedProducts.length}) sono già importati e aggiornati.`
          );
        } else {
          this.toastService.showError(
            'Nessun prodotto valido da importare o aggiornare'
          );
        }
        this.importingProducts.set(false);
        return;
      }

      // Calcola il numero totale di operazioni
      const totalOperations = productsToImport.length + productsToUpdate.length;
      this.totalProductsToImport.set(totalOperations);

      // Contatore per tracciare il progresso
      let currentProgress = 0;

      // Importa i nuovi prodotti uno alla volta, aggiornando il progresso
      if (productsToImport.length > 0) {
        for (let i = 0; i < productsToImport.length; i++) {
          const localProduct = productsToImport[i];

          try {
            // Crea un singolo prodotto alla volta
            await this.createProductIndividually(localProduct);

            // Aggiorna il progresso
            currentProgress++;
            this.importProgress.set(currentProgress);
          } catch (error) {
            console.error(`Errore importando ${localProduct.name}:`, error);
            // Continuiamo con il prodotto successivo anche se questo fallisce
          }
        }
      }

      // Aggiorna i prodotti esistenti uno alla volta
      if (productsToUpdate.length > 0) {
        for (let i = 0; i < productsToUpdate.length; i++) {
          const product = productsToUpdate[i];

          try {
            // Crea l'oggetto di aggiornamento
            const updateData: UpdateProductDto = {
              name: product.name,
              description: product.description,
              price: product.price,
              categoryId: product.categoryId,
              CCProductId: product.CCProductId,
              CCConnection: true,
              additionalData: product.additionalData,
            };

            // Aggiorna un singolo prodotto alla volta
            await this.updateProductIndividually(product.id!, updateData);

            // Aggiorna il progresso
            currentProgress++;
            this.importProgress.set(currentProgress);
          } catch (error) {
            console.error(`Errore aggiornando ${product.name}:`, error);
          }
        }
      }

      // Mostra un messaggio di successo
      let successMessage = '';
      if (productsToImport.length > 0 && productsToUpdate.length > 0) {
        successMessage = `Importazione completata: ${productsToImport.length} nuovi prodotti, ${productsToUpdate.length} prodotti aggiornati`;
      } else if (productsToImport.length > 0) {
        successMessage = `Importazione completata: ${productsToImport.length} nuovi prodotti`;
      } else {
        successMessage = `Aggiornamento completato: ${productsToUpdate.length} prodotti aggiornati`;
      }

      if (skippedProducts.length > 0) {
        successMessage += `, ${skippedProducts.length} prodotti ignorati (già aggiornati)`;
      }

      this.toastService.showSuccess(successMessage);

      // Chiudi il dialog dopo un breve ritardo per consentire all'utente di vedere il completamento
      setTimeout(() => {
        this.closeSyncDialog();
        this.refreshProducts();
      }, 1000);
    } catch (error: any) {
      console.error('Errore durante la sincronizzazione dei prodotti:', error);
      this.toastService.showError(
        error.message || 'Errore durante la sincronizzazione dei prodotti'
      );
    } finally {
      this.importingProducts.set(false);
    }
  }

  /**
   * Crea un singolo prodotto in modo asincrono per poter tracciare il progresso
   */
  private async createProductIndividually(product: Product): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Crea un nuovo prodotto tramite lo store
      const createDto: CreateProductDto = {
        name: product.name,
        description: product.description || '',
        price: product.price,
        categoryId: product.categoryId,
        CCProductId: product.CCProductId,
        CCCategoryId: product.CCCategoryId,
        CCSalesPointId: product.CCSalesPointId,
        CCProductVariantId: product.CCProductVariantId,
        CCProduct: product.CCProduct,
        CCConnection: true,
        isActive: true,
        projectId: product.projectId,
        partnerId: product.partnerId,
        additionalData: product.additionalData,
        allergens: product.allergens,
        calories: product.calories,
        sortOrder: product.sortOrder,
      };

      // Avvia la creazione e passa alla prossima operazione
      this.productStore.createProduct({ product: createDto });

      // Non abbiamo un modo diretto per sapere quando l'operazione è completata
      // Quindi aggiungiamo un breve ritardo per dare tempo allo store di aggiornare lo stato
      setTimeout(() => {
        // Controlla se c'è un errore nello store dopo un breve periodo
        const error = this.productStore.error();
        if (error) {
          console.warn(`Possibile errore per ${product.name}: ${error}`);
          // Risolviamo comunque per non bloccare l'intero processo
        }
        resolve();
      }, 1000); // Attendi 1 secondo prima di procedere al prossimo prodotto
    });
  }

  /**
   * Aggiorna un singolo prodotto in modo asincrono per poter tracciare il progresso
   */
  private async updateProductIndividually(
    productId: string,
    updateData: UpdateProductDto
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Avvia l'aggiornamento
      this.productStore.updateProduct({
        id: productId,
        product: updateData,
      });

      // Anche qui, assumiamo che l'operazione richieda un po' di tempo
      setTimeout(() => {
        // Controlla se c'è un errore nello store dopo un breve periodo
        const error = this.productStore.error();
        if (error) {
          console.warn(
            `Possibile errore per l'aggiornamento di ${productId}: ${error}`
          );
        }
        resolve(); // Risolvi comunque per non bloccare l'intero processo
      }, 1000);
    });
  }
  /**
   * Confronta due prodotti CC per determinare se sono diversi
   * @param product1 Primo prodotto CC
   * @param product2 Secondo prodotto CC
   * @returns true se i prodotti sono diversi, false se sono uguali
   */
  private isCCProductDifferent(
    product1: ICCProduct | undefined,
    product2: ICCProduct
  ): boolean {
    if (!product1) return true;

    // Verifica le proprietà essenziali
    if (product1.description !== product2.description) return true;
    if (product1.descriptionExtended !== product2.descriptionExtended)
      return true;
    if (product1.idCategory !== product2.idCategory) return true;
    if (product1.idDepartment !== product2.idDepartment) return true;

    // Confronta i prezzi
    if (!this.arePricesEqual(product1.prices, product2.prices)) return true;

    // Se arriviamo qui, i prodotti sono considerati uguali
    return false;
  }

  /**
   * Confronta i prezzi di due prodotti CC
   */
  private arePricesEqual(prices1?: any[], prices2?: any[]): boolean {
    if (!prices1 && !prices2) return true;
    if (!prices1 || !prices2) return false;
    if (prices1.length !== prices2.length) return false;

    // Ordina i prezzi per idSalesPoint per un confronto coerente
    const sortedPrices1 = [...prices1].sort(
      (a, b) => a.idSalesPoint - b.idSalesPoint
    );
    const sortedPrices2 = [...prices2].sort(
      (a, b) => a.idSalesPoint - b.idSalesPoint
    );

    // Confronta ogni prezzo
    for (let i = 0; i < sortedPrices1.length; i++) {
      if (sortedPrices1[i].value !== sortedPrices2[i].value) return false;
      if (sortedPrices1[i].idSalesPoint !== sortedPrices2[i].idSalesPoint)
        return false;
    }

    return true;
  }

  /**
   * Updates the sort order of products
   * Riordina sequenzialmente i prodotti ignorando il drag & drop
   */
  updateSortOrder(event: any): void {
    if (!this.filteredProducts() || this.filteredProducts()!.length === 0)
      return;

    console.log('--------- RIORDINAMENTO PRODOTTI ---------');

    // Ottieni l'array corrente dei prodotti
    const products = [...this.filteredProducts()!];

    console.log('Stato originale dei prodotti:');
    products.forEach((product, idx) => {
      console.log(`${idx}. ${product.name}: sortOrder = ${product.sortOrder}`);
    });

    // Aggiorna l'ordinamento in modo sequenziale da 1 a n, ignorando il drag & drop
    const updates = products.map((product, index) => ({
      id: product.id || '',
      sortOrder: index + 1, // Assegna sortOrder sequenziale partendo da 1
    }));

    // Aggiorna i prodotti con i nuovi valori di sortOrder
    const productsWithUpdatedOrder = products.map((product, index) => ({
      ...product,
      sortOrder: index + 1, // Assegna sortOrder sequenziale partendo da 1
    }));

    console.log('\nNuovo ordinamento sequenziale:');
    productsWithUpdatedOrder.forEach((product, idx) => {
      console.log(`${idx}. ${product.name}: sortOrder = ${product.sortOrder}`);
    });

    // Aggiorna la vista immediatamente
    this.filteredProducts.set(productsWithUpdatedOrder);

    // Invia gli aggiornamenti al backend
    this.productStore.updateProductsSortOrder({ updates });

    console.log(
      `\nAggiornamento completato: ${updates.length} prodotti riordinati sequenzialmente`
    );

    this.toastService.showSuccess('Prodotti riordinati sequenzialmente');
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
   * Checks if a CC product is already imported
   */
  isProductImported(ccProductId: string): boolean {
    return (this.products() || []).some(
      (prod) => prod.CCProductId === ccProductId
    );
  }

  /**
   * Gestisce il cambio di selezione dei prodotti da importare
   */
  onSelectionChange(event: ICCProduct[]): void {
    this.selectedCCProducts.set(event);
  }

  /**
   * Gets the tag severity based on product connection
   */
  getProductSeverity(
    product: any
  ):
    | 'success'
    | 'secondary'
    | 'info'
    | 'warn'
    | 'danger'
    | 'contrast'
    | undefined {
    if (product.CCConnection) {
      return 'success';
    } else {
      return 'secondary';
    }
  }

  /**
   * Get category name by ID
   */
  getCategoryName(categoryId: string): string {
    const category = this.categories()?.find((c) => c.id === categoryId);
    return category ? category.name : 'N/D';
  }

  /**
   * Toggle view mode between grid and list
   */
  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }

  /**
   * Formatta il prezzo di un prodotto CC
   */
  formatCCPrice(ccProduct: ICCProduct): string {
    const project = this.selectedProject();
    if (!project || !project.CCSalesPointId) {
      return 'N/D';
    }

    // Estrattoria prezzo semplificata
    if (!ccProduct.prices || ccProduct.prices.length === 0) {
      return 'N/D';
    }

    // Strategia: usa prima prezzo del punto vendita specifico, altrimenti il primo prezzo
    let price: number | undefined;

    // Cerca il prezzo per questo punto vendita
    const salesPointId = parseInt(project.CCSalesPointId, 10);
    const matchingPrice = ccProduct.prices.find(
      (p) => parseInt(p.idSalesPoint.toString(), 10) === salesPointId
    );

    if (matchingPrice) {
      price = matchingPrice.value;
    } else {
      // Usa il primo prezzo come fallback
      price = ccProduct.prices[0].value;
    }

    if (price === undefined) {
      return 'N/D';
    }

    return this.formatPrice(price);
  }

  /**
   * Recupera il nome di una categoria CC dal suo ID
   */
  getCCCategoryName(categoryId: string): string {
    if (!categoryId) {
      return 'Categoria non specificata';
    }

    // Verifica se le categorie sono già state caricate
    if (this.ccCategories().length === 0) {
      // Se stiamo visualizzando i prodotti ma non abbiamo ancora le categorie,
      // caricale in background
      this.loadCCCategories();
      return 'Caricamento...';
    }

    const ccCategory = this.ccCategories()?.find(
      (c: any) => c.id === categoryId
    );
    return ccCategory?.description || `Categoria ${categoryId}`;
  }

  /**
   * Filtra i prodotti CC per categoria
   */
  filterCCProductsByCategory(categoryId: string | null): void {
    const products = this.ccProducts();
    if (!products) {
      return;
    }

    if (!categoryId) {
      // Se nessuna categoria è selezionata, mostra tutti i prodotti
      this.filteredCCProducts.set(products);
      return;
    }

    // Filtra i prodotti per la categoria selezionata
    const filtered = products.filter((p) => p.idCategory === categoryId);
    this.filteredCCProducts.set(filtered);

    console.log(
      `Filtrati ${filtered.length} prodotti per la categoria ${categoryId}`
    );
  }
  /**
   * Filter products by category
   */
  filterByCategory(categoryId: string | null): void {
    if (categoryId === null) {
      this.selectedCategoryId = null;
      // Modificare in products.component.ts
      this.productStore.fetchPartnerProducts();
    } else {
      this.loadProductsByCategory(categoryId);
    }

    // Resetta la ricerca quando cambi categoria
    if (this.searchQuery) {
      this.searchQuery = '';
      this.filterProducts('');
    }
  }
}
