import { computed, inject } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../models/category.model';
import { CategoryService } from '../services/api/local/category.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY, throwError } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';
import { SortOrderUpdate } from '../services/api/local/category.service';

export interface CategoryState {
  categories: Category[] | null;
  selectedCategory: Category | null;
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  categories: null,
  selectedCategory: null,
  loading: false,
  error: null,
};

export const CategoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      categoryService = inject(CategoryService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      // Utility method to get category by ID
      getCategoryById(id: string) {
        const currentCategories = store.categories();
        return currentCategories
          ? currentCategories.find((category) => category.id === id)
          : null;
      },

      // Fetch public categories for a project
      fetchPublicCategories: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return categoryService.getPublicCategories(selectedProject.id).pipe(
              tapResponse({
                next: (categories) => {
                  patchState(store, {
                    categories,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero delle categorie',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero delle categorie'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch partner categories for a project
      fetchPartnerCategories: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return categoryService
              .getPartnerCategories(selectedProject.id)
              .pipe(
                tapResponse({
                  next: (categories) => {
                    patchState(store, {
                      categories,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero delle categorie',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero delle categorie'
                    );
                  },
                })
              );
          })
        )
      ),

      // Fetch admin categories for a project
      fetchAdminCategories: rxMethod<{ projectId?: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId }) => {
            let targetProjectId = projectId;

            if (!targetProjectId) {
              const selectedProject = projectStore.selectedProject();
              if (!selectedProject) {
                toastService.showError('Nessun progetto selezionato');
                patchState(store, { loading: false });
                return EMPTY;
              }
              targetProjectId = selectedProject.id;
            }

            return categoryService.getAdminCategories(targetProjectId).pipe(
              tapResponse({
                next: (categories) => {
                  patchState(store, {
                    categories,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero delle categorie',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero delle categorie'
                  );
                },
              })
            );
          })
        )
      ),

      // Get a specific category by ID
      getCategory: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = categoryService.getAdminCategory(id);
            } else {
              request = categoryService.getPartnerCategory(
                selectedProject.id,
                id
              );
            }

            return request.pipe(
              tapResponse({
                next: (category) => {
                  patchState(store, {
                    selectedCategory: category,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero della categoria',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero della categoria'
                  );
                },
              })
            );
          })
        )
      ),

      // Create a new category
      createCategory: rxMethod<{ category: CreateCategoryDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ category }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            // Ensure projectId is set
            let categoryData = { ...category, projectId: selectedProject.id };

            let request;
            if (role === 'admin') {
              request = categoryService.createAdminCategory(
                selectedProject.id,
                categoryData
              );
            } else {
              request = categoryService.createPartnerCategory(
                selectedProject.id,
                categoryData
              );
            }

            return request.pipe(
              tapResponse({
                next: (createdCategory) => {
                  toastService.showSuccess('Categoria creata con successo');
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante la creazione della categoria',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante la creazione della categoria'
                  );
                },
              })
            );
          })
        )
      ),

      // Update an existing category
      updateCategory: rxMethod<{ id: string; category: UpdateCategoryDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, category }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = categoryService.updateAdminCategory(id, category);
            } else {
              request = categoryService.updatePartnerCategory(
                selectedProject.id,
                id,
                category
              );
            }

            return request.pipe(
              tapResponse({
                next: (updatedCategory) => {
                  toastService.showSuccess('Categoria aggiornata con successo');

                  // Update categories array with the updated category
                  const currentCategories = store.categories() || [];
                  const updatedCategories = currentCategories.map((c) =>
                    c.id === updatedCategory.id ? updatedCategory : c
                  );

                  patchState(store, {
                    categories: updatedCategories,
                    selectedCategory:
                      store.selectedCategory()?.id === updatedCategory.id
                        ? updatedCategory
                        : store.selectedCategory(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'aggiornamento della categoria",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'aggiornamento della categoria"
                  );
                },
              })
            );
          })
        )
      ),

      // Delete a category
      deleteCategory: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = categoryService.deleteAdminCategory(id);
            } else {
              request = categoryService.deletePartnerCategory(
                selectedProject.id,
                id
              );
            }

            return request.pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Categoria eliminata con successo');

                  // Filter out the deleted category
                  const currentCategories = store.categories() || [];
                  const filteredCategories = currentCategories.filter(
                    (category) => category.id !== id
                  );

                  patchState(store, {
                    categories: filteredCategories,
                    selectedCategory:
                      store.selectedCategory()?.id === id
                        ? null
                        : store.selectedCategory(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'eliminazione della categoria",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'eliminazione della categoria"
                  );
                },
              })
            );
          })
        )
      ),

      // Update sort order for multiple categories
      updateCategoriesSortOrder: rxMethod<{ updates: SortOrderUpdate[] }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ updates }) => {
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            const params = {
              projectId: selectedProject.id,
              sortOrderUpdates: updates,
            };

            return categoryService.updateCategoriesSortOrder(params).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess(
                    'Ordinamento categorie aggiornato con successo'
                  );

                  // Update local categories with new sort orders
                  const currentCategories = store.categories() || [];
                  const updatedCategories = currentCategories.map(
                    (category) => {
                      const update = updates.find((u) => u.id === category.id);
                      if (update) {
                        return { ...category, sortOrder: update.sortOrder };
                      }
                      return category;
                    }
                  );

                  // Sort categories by sortOrder
                  updatedCategories.sort((a, b) => {
                    return (a.sortOrder || 0) - (b.sortOrder || 0);
                  });

                  patchState(store, {
                    categories: updatedCategories,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'aggiornamento dell'ordinamento",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'aggiornamento dell'ordinamento"
                  );
                },
              })
            );
          })
        )
      ),

      // Import categories from Cassa in Cloud
      importCCCategories: rxMethod<{ ccCategories: any[] }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ ccCategories }) => {
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            if (!ccCategories || ccCategories.length === 0) {
              toastService.showError('Nessuna categoria da importare');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return categoryService
              .importCCCategories(selectedProject.id, ccCategories)
              .pipe(
                tapResponse({
                  next: (importedCategories) => {
                    toastService.showSuccess(
                      `${importedCategories.length} categorie importate con successo`
                    );

                    // Merge with existing categories
                    const currentCategories = store.categories() || [];

                    // Create a map of existing categories by CCCategoryId
                    const existingCategoriesMap = new Map<string, Category>();
                    currentCategories.forEach((cat) => {
                      if (cat.CCCategoryId) {
                        existingCategoriesMap.set(cat.CCCategoryId, cat);
                      }
                    });

                    // Merge imported categories with existing ones
                    const mergedCategories = [...currentCategories];

                    importedCategories.forEach((imported) => {
                      const existingIndex = mergedCategories.findIndex(
                        (cat) => cat.CCCategoryId === imported.CCCategoryId
                      );

                      if (existingIndex >= 0) {
                        // Update existing category
                        mergedCategories[existingIndex] = imported;
                      } else {
                        // Add new category
                        mergedCategories.push(imported);
                      }
                    });

                    patchState(store, {
                      categories: mergedCategories,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante l'importazione delle categorie",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante l'importazione delle categorie"
                    );
                  },
                })
              );
          })
        )
      ),

      // Select a category
      selectCategory: (category: Category) => {
        patchState(store, { selectedCategory: category });
      },

      // Clear selected category
      clearSelectedCategory: () => {
        patchState(store, { selectedCategory: null });
      },

      // Clear errors
      clearCategoryErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Don't automatically load categories on initialization,
      // as we need a selected project first
    },
  })
);
