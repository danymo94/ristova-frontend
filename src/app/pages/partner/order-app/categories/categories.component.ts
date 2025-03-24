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
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { AuthStore } from '../../../../core/store/auth.signal-store';
import { CategoryStore } from '../../../../core/store/category.signal-store';
import { Project } from '../../../../core/models/project.model';
import { ICCCategory } from '../../../../core/interfaces/cassaincloud.interfaces';
import {
  CategoryService as CCCategoryService,
  ProductChannel as CCProductChannel,
} from '../../../../core/services/api/cassa-cloud/category.service';
import {
  Category,
  CreateCategoryDto,
  mapCCCategoryToCategory,
  mapCategoryToCCCreateParams,
} from '../../../../core/models/category.model';
import { finalize } from 'rxjs/operators';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import { OrderListModule } from 'primeng/orderlist';
import { DragDropModule } from 'primeng/dragdrop';

@Component({
  selector: 'app-categories',
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
    TooltipModule,
    OrderListModule,
    DragDropModule,
    InputNumberModule
  ],
  templateUrl: './categories.component.html',
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
      
      /* Stile per i dialog responsive */
      ::ng-deep .category-dialog .p-dialog-content {
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
      }
    `,
  ],
})
export class CategoriesComponent implements OnInit {
  // Inject services
  private projectStore = inject(ProjectStore);
  private authStore = inject(AuthStore);
  private categoryStore = inject(CategoryStore);
  private ccCategoryService = inject(CCCategoryService);
  private toastService = inject(ToastService);
  private confirmDialogService = inject(ConfirmDialogService);
  private formBuilder = inject(FormBuilder);

  // State signals
  selectedProject = this.projectStore.selectedProject;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;
  categories = this.categoryStore.categories;
  selectedCategory = this.categoryStore.selectedCategory;
  loading = signal<boolean>(false);

  // CC Categories state
  ccCategories = signal<ICCCategory[] | null>(null);
  filteredCCCategories = signal<ICCCategory[] | null>(null);
  loadingCCCategories = signal<boolean>(false);
  errorCCCategories = signal<string | null>(null);
  selectedCCCategories = signal<ICCCategory[]>([]);

  // Search
  searchQuery = '';
  searchCCQuery = '';

  // Dialog state
  createDialogVisible = signal<boolean>(false);
  creatingCategory = signal<boolean>(false);
  createForm!: FormGroup;

  // Edit category dialog
  editDialogVisible = signal<boolean>(false);
  editingCategory = signal<Category | null>(null);
  editForm!: FormGroup;
  updatingCategory = signal<boolean>(false);

  // Sync dialog
  syncDialogVisible = signal<boolean>(false);

  constructor() {
    // Effect to track project changes
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        // Load local categories
        this.categoryStore.fetchPartnerCategories();

        // If project has CC connection, load CC categories
        if (
          project.CCConnection &&
          project.CCApiKey &&
          project.CCSalesPointId
        ) {
          this.fetchCCCategories(project);
        } else {
          this.ccCategories.set(null);
          this.filteredCCCategories.set(null);
        }
      }
    });

    // Initialize forms
    this.initCreateForm();
    this.initEditForm();
  }

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Initializes the create category form
   */
  initCreateForm(): void {
    this.createForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: [''],
      sortOrder: [0],
      isActive: [true],
      CCConnection: [false],
    });
  }

  /**
   * Initializes the edit category form
   */
  initEditForm(): void {
    this.editForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: [''],
      sortOrder: [0],
      isActive: [true],
      CCConnection: [false],
    });
  }

  /**
   * Fetches categories from Cassa in Cloud
   */
  fetchCCCategories(project: Project): void {
    if (!project.CCApiKey || !project.CCSalesPointId) {
      this.errorCCCategories.set('API Key o ID punto vendita mancante');
      return;
    }

    this.loadingCCCategories.set(true);
    this.errorCCCategories.set(null);

    // Convert CCSalesPointId to number
    const salesPointId = parseInt(project.CCSalesPointId, 10);
    if (isNaN(salesPointId)) {
      this.errorCCCategories.set('ID punto vendita non valido');
      this.loadingCCCategories.set(false);
      return;
    }

    // Get categories from Cassa in Cloud with all channels enabled
    const enabledChannels = [
      CCProductChannel.RISTO,
      CCProductChannel.SALE,
      CCProductChannel.ECOMMERCE,
      CCProductChannel.MOBILECOMMERCE,
      CCProductChannel.SELFORDER,
      CCProductChannel.KIOSK,
    ];

    this.ccCategoryService
      .getCategoriesBySalesPoint(
        project.CCApiKey,
        salesPointId,
        enabledChannels
      )
      .pipe(finalize(() => this.loadingCCCategories.set(false)))
      .subscribe({
        next: (response) => {
          this.ccCategories.set(response.categories);
          this.filteredCCCategories.set(response.categories);

          if (response.categories.length === 0) {
            this.toastService.showInfo(
              'Nessuna categoria trovata in Cassa in Cloud'
            );
          }
        },
        error: (err) => {
          console.error('Error fetching CC categories:', err);
          this.errorCCCategories.set(
            err.message ||
              'Errore durante il recupero delle categorie da Cassa in Cloud'
          );
          this.toastService.showError(this.errorCCCategories() || '');
        },
      });
  }

  /**
   * Refreshes categories data
   */
  refreshCategories(): void {
    const project = this.selectedProject();
    if (project) {
      // Reload local categories
      this.categoryStore.fetchPartnerCategories();

      // If connected to CC, reload CC categories
      if (project.CCConnection && project.CCApiKey && project.CCSalesPointId) {
        this.fetchCCCategories(project);
      }
    }
  }

  /**
   * Filters local categories based on search query
   */
  filterCategories(query: string): void {
    // La filtratura locale è gestita nella template dato che abbiamo già i dati in categories()
    this.searchQuery = query;
  }

  /**
   * Filters CC categories based on search query
   */
  filterCCCategories(query: string): void {
    const ccCategoriesValue = this.ccCategories();
    this.searchCCQuery = query;

    if (!ccCategoriesValue || !query) {
      this.filteredCCCategories.set(ccCategoriesValue);
      return;
    }

    const filtered = ccCategoriesValue.filter((category) =>
      category.description.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredCCCategories.set(filtered);
  }

  /**
   * Opens the create category dialog
   */
  openCreateDialog(): void {
    // Reset form
    this.createForm.reset({
      name: '',
      description: '',
      sortOrder: this.categories()?.length || 0,
      isActive: true,
      CCConnection: this.selectedProject()?.CCConnection || false,
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
   * Opens the edit category dialog
   */
  openEditDialog(id: string): void {
    const category = this.categories()?.find((c) => c.id === id);
    if (!category) {
      this.toastService.showError('Categoria non trovata');
      return;
    }

    this.editingCategory.set(category);

    // Populate form
    this.editForm.patchValue({
      name: category.name,
      description: category.description || '',
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
      CCConnection: category.CCConnection || false,
    });

    this.editDialogVisible.set(true);
  }

  /**
   * Closes the edit dialog
   */
  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingCategory.set(null);
    this.editForm.reset();
  }

  /**
   * Creates a new category
   */
  async createCategory(): Promise<void> {
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
      this.creatingCategory.set(true);

      // Prepare category data
      const formValues = this.createForm.value;
      const categoryData: CreateCategoryDto = {
        name: formValues.name,
        description: formValues.description,
        sortOrder: formValues.sortOrder,
        isActive: formValues.isActive,
        projectId: project.id,
        CCConnection: formValues.CCConnection && project.CCConnection,
      };

      // If CC connection is enabled, add salespoint id
      if (categoryData.CCConnection) {
        categoryData.CCSalesPointId = project.CCSalesPointId;
      }

      // Create category in Cassa in Cloud if needed
      if (
        categoryData.CCConnection &&
        project.CCApiKey &&
        project.CCSalesPointId
      ) {
        // Create CC Category first
        const ccParams = {
          description: categoryData.name,
          idSalesPoint: parseInt(project.CCSalesPointId),
          enableForRisto: true,
          enableForSale: true,
          enableForECommerce: true,
          enableForMobileCommerce: true,
          enableForSelfOrderMenu: true,
          enableForKiosk: true,
        };

        const createdCCCategory = await this.ccCategoryService
          .createCategory(project.CCApiKey, ccParams)
          .toPromise();

        if (createdCCCategory) {
          // Add CC Category ID to local category
          categoryData.CCCategoryId = createdCCCategory.id;
        }
      }

      // Create local category
      this.categoryStore.createCategory({ category: categoryData });

      setTimeout(() => {
        this.refreshCategories();
        this.closeCreateDialog();
      }, 500);
    } catch (error: any) {
      console.error('Error creating category:', error);
      this.toastService.showError(
        error.message || 'Errore durante la creazione della categoria'
      );
    } finally {
      this.creatingCategory.set(false);
    }
  }

  /**
   * Updates an existing category
   */
  async updateCategory(): Promise<void> {
    if (this.editForm.invalid) {
      this.toastService.showError('Controlla i campi del form');
      return;
    }

    const project = this.selectedProject();
    const category = this.editingCategory();

    if (!project || !category) {
      this.toastService.showError('Dati mancanti');
      return;
    }

    try {
      this.updatingCategory.set(true);

      // Prepare update data
      const formValues = this.editForm.value;
      const updateData = {
        name: formValues.name,
        description: formValues.description,
        sortOrder: formValues.sortOrder,
        isActive: formValues.isActive,
      };

      // Update in Cassa in Cloud if needed and if CC ID exists
      if (category.CCConnection && category.CCCategoryId && project.CCApiKey) {
        const ccUpdateParams = {
          description: updateData.name,
        };

        await this.ccCategoryService
          .updateCategory(
            project.CCApiKey,
            category.CCCategoryId,
            ccUpdateParams
          )
          .toPromise();
      }

      // Update local category
      this.categoryStore.updateCategory({
        id: category.id || '',
        category: updateData,
      });

      this.closeEditDialog();
    } catch (error: any) {
      console.error('Error updating category:', error);
      this.toastService.showError(
        error.message || "Errore durante l'aggiornamento della categoria"
      );
    } finally {
      this.updatingCategory.set(false);
    }
  }

  /**
   * Deletes a category
   */
  async deleteCategory(event: Event, id: string): Promise<void> {
    event.preventDefault();

    try {
      const result = await this.confirmDialogService
        .confirm('Sei sicuro di voler eliminare questa categoria?')
        .toPromise();
      if (!result) return;

      const project = this.selectedProject();
      if (!project) {
        this.toastService.showError('Nessun progetto selezionato');
        return;
      }

      const category = this.categories()?.find((c) => c.id === id);
      if (!category) {
        this.toastService.showError('Categoria non trovata');
        return;
      }

      this.loading.set(true);

      // Delete local category
      this.categoryStore.deleteCategory({ id });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      this.toastService.showError(
        error.message || "Errore durante l'eliminazione della categoria"
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Opens the sync dialog
   */
  openSyncDialog(): void {
    // Clear selected categories
    this.selectedCCCategories.set([]);
    this.syncDialogVisible.set(true);
  }

  /**
   * Closes the sync dialog
   */
  closeSyncDialog(): void {
    this.syncDialogVisible.set(false);
  }

/**
 * Synchronizes selected CC categories to local categories
 */
async syncCategories(): Promise<void> {
  const project = this.selectedProject();
  const selectedCategories = this.selectedCCCategories();

  if (!project) {
    this.toastService.showError('Nessun progetto selezionato');
    return;
  }

  if (!selectedCategories || selectedCategories.length === 0) {
    this.toastService.showError('Nessuna categoria selezionata');
    return;
  }

  try {
    this.loading.set(true);

    // Map CC categories to local format
    const categoriesToImport = selectedCategories.map((cc) =>
      mapCCCategoryToCategory(
        cc,
        project.id,
        project.partnerId || '',
        project.CCSalesPointId || ''
      )
    );

    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Crea ogni categoria individualmente
    for (const category of categoriesToImport) {
      try {
        // Importante: convertiamo l'oggetto CCCategory in JSON per confrontarlo
        const ccCategoryJson = JSON.stringify(category.CCCategory);
        
        // Verifica se la categoria esiste già confrontando la rappresentazione JSON dell'oggetto CCCategory
        const existingCategory = (this.categories() || []).find(cat => {
          if (!cat.CCCategory) return false;
          return JSON.stringify(cat.CCCategory) === ccCategoryJson;
        });
        
        if (existingCategory) {
          // Se esiste già, aggiorniamo i dati rilevanti
          await this.categoryStore.updateCategory({
            id: existingCategory.id || '',
            category: {
              name: category.name,
              description: category.description,
              isActive: true
            }
          });
          updatedCount++;
        } else {
          // Se non esiste, creiamo una nuova categoria
          const categoryData = {
            name: category.name,
            description: category.description,
            isActive: true,
            projectId: project.id,
            partnerId: project.partnerId || '',
            CCConnection: true,
            CCSalesPointId: project.CCSalesPointId,
            CCCategoryId: category.CCCategoryId,
            CCCategory: category.CCCategory, // Includiamo l'oggetto CC completo
            sortOrder: (this.categories()?.length || 0) + importedCount
          };
          
          await this.categoryStore.createCategory({ 
            category: categoryData 
          });
          importedCount++;
        }
        
        // Piccola pausa tra le richieste
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (err: any) {
        console.error(`Errore nell'importazione della categoria ${category.name}:`, err);
        errors.push(`${category.name}: ${err.message || 'Errore sconosciuto'}`);
      }
    }

    // Mostra messaggi appropriati in base al risultato
    const messages = [];
    if (importedCount > 0) messages.push(`${importedCount} categorie create`);
    if (updatedCount > 0) messages.push(`${updatedCount} categorie aggiornate`);
    
    if (messages.length > 0) {
      this.toastService.showSuccess(messages.join(', '));
    }
    
    if (errors.length > 0) {
      this.toastService.showError(
        `${errors.length} categorie non importate a causa di errori`
      );
    }

    // Ricarica le categorie dopo un breve ritardo
    setTimeout(() => {
      this.refreshCategories();
      this.closeSyncDialog();
    }, 500);
  } catch (error: any) {
    console.error('Error synchronizing categories:', error);
    this.toastService.showError(
      error.message || 'Errore durante la sincronizzazione delle categorie'
    );
  } finally {
    this.loading.set(false);
  }
}

  /**
   * Updates the sort order of categories
   */
  updateSortOrder(categories: Category[]): void {
    if (!categories || categories.length === 0) return;

    // Create sort order updates
    const updates = categories.map((category, index) => ({
      id: category.id || '',
      sortOrder: index,
    }));

    // Update with store method
    this.categoryStore.updateCategoriesSortOrder({ updates });
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
   * Checks if a CC category is already imported
   */
  isCategoryImported(ccCategoryId: string): boolean {
    return (this.categories() || []).some(
      (cat) => cat.CCCategoryId === ccCategoryId
    );
  }

  /**
   * Gestisce il cambio di selezione delle categorie da importare
   */
  onSelectionChange(event: ICCCategory[]): void {
    this.selectedCCCategories.set(event);
  }

  /**
   * Gets the tag severity based on category connection
   */
  getCategorySeverity(
    category: any
  ):
    | 'success'
    | 'secondary'
    | 'info'
    | 'warn'
    | 'danger'
    | 'contrast'
    | undefined {
    if (category.CCConnection) {
      return 'success';
    } else {
      return 'warn';
    }
  }
}
