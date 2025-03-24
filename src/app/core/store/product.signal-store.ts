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
  Product,
  CreateProductDto,
  UpdateProductDto,
} from '../models/product.model';
import { ProductService } from '../services/api/local/product.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY, throwError } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';
import { CategoryStore } from './category.signal-store';
import { SortOrderUpdate } from '../services/api/local/product.service';
import { Category } from '../models/category.model';
import { ICCProduct } from '../interfaces/cassaincloud.interfaces';

export interface ProductState {
  products: Product[] | null;
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProductState = {
  products: null,
  selectedProduct: null,
  loading: false,
  error: null,
};

export const ProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      productService = inject(ProductService),
      projectStore = inject(ProjectStore),
      categoryStore = inject(CategoryStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      // Utility method to get product by ID
      getProductById(id: string) {
        const currentProducts = store.products();
        return currentProducts
          ? currentProducts.find((product) => product.id === id)
          : null;
      },

      // Fetch public products for a project
      fetchPublicProducts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return productService.getPublicProducts(selectedProject.id).pipe(
              tapResponse({
                next: (products) => {
                  patchState(store, {
                    products,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch public products for a specific category
      fetchPublicProductsByCategory: rxMethod<{ categoryId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ categoryId }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return productService
              .getPublicProductsByCategory(selectedProject.id, categoryId)
              .pipe(
                tapResponse({
                  next: (products) => {
                    patchState(store, {
                      products,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria'
                    );
                  },
                })
              );
          })
        )
      ),

      // Fetch partner products for a project
      fetchPartnerProducts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return productService.getPartnerProducts(selectedProject.id).pipe(
              tapResponse({
                next: (products) => {
                  patchState(store, {
                    products,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch partner products for a specific category
      fetchPartnerProductsByCategory: rxMethod<{ categoryId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ categoryId }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return productService
              .getPartnerProductsByCategory(selectedProject.id, categoryId)
              .pipe(
                tapResponse({
                  next: (products) => {
                    patchState(store, {
                      products,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria'
                    );
                  },
                })
              );
          })
        )
      ),

      // Fetch admin products for a project
      fetchAdminProducts: rxMethod<{ projectId?: string }>(
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

            return productService.getAdminProducts(targetProjectId).pipe(
              tapResponse({
                next: (products) => {
                  patchState(store, {
                    products,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero dei prodotti'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch admin products for a specific category
      fetchAdminProductsByCategory: rxMethod<{
        projectId?: string;
        categoryId: string;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, categoryId }) => {
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

            return productService
              .getAdminProductsByCategory(targetProjectId, categoryId)
              .pipe(
                tapResponse({
                  next: (products) => {
                    patchState(store, {
                      products,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante il recupero dei prodotti della categoria'
                    );
                  },
                })
              );
          })
        )
      ),

      // Get a specific product by ID
      getProduct: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject && role !== 'admin') {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = productService.getAdminProduct(id);
            } else {
              request = productService.getPartnerProduct(
                selectedProject!.id,
                id
              );
            }

            return request.pipe(
              tapResponse({
                next: (product) => {
                  patchState(store, {
                    selectedProduct: product,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante il recupero del prodotto',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante il recupero del prodotto'
                  );
                },
              })
            );
          })
        )
      ),

      // Create a new product
      createProduct: rxMethod<{ product: CreateProductDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ product }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            // Ensure projectId is set
            let productData = { ...product, projectId: selectedProject.id };

            let request;
            if (role === 'admin') {
              request = productService.createAdminProduct(
                selectedProject.id,
                productData
              );
            } else {
              request = productService.createPartnerProduct(
                selectedProject.id,
                productData
              );
            }

            return request.pipe(
              tapResponse({
                next: (createdProduct) => {
                  toastService.showSuccess('Prodotto creato con successo');

                  // Add the created product to the products array if we're on the same category
                  if (
                    store.products() &&
                    createdProduct.categoryId === productData.categoryId
                  ) {
                    const products = store.products() || [];
                    patchState(store, {
                      products: [...products, createdProduct],
                      loading: false,
                      error: null,
                    });
                  } else {
                    patchState(store, { loading: false, error: null });
                  }
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Errore durante la creazione del prodotto',
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      'Errore durante la creazione del prodotto'
                  );
                },
              })
            );
          })
        )
      ),

      // Update an existing product
      updateProduct: rxMethod<{ id: string; product: UpdateProductDto }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, product }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject && role !== 'admin') {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = productService.updateAdminProduct(id, product);
            } else {
              request = productService.updatePartnerProduct(
                selectedProject!.id,
                id,
                product
              );
            }

            return request.pipe(
              tapResponse({
                next: (updatedProduct) => {
                  toastService.showSuccess('Prodotto aggiornato con successo');

                  // Update products array with the updated product if categoryId hasn't changed
                  const currentProducts = store.products() || [];

                  // Handle category changes
                  if (
                    product.categoryId &&
                    store.selectedProduct()?.categoryId !== product.categoryId
                  ) {
                    // If category changed, remove from current list if we're viewing by category
                    const filteredProducts = currentProducts.filter(
                      (p) => p.id !== updatedProduct.id
                    );
                    patchState(store, { products: filteredProducts });
                  } else {
                    // Update in the current list
                    const updatedProducts = currentProducts.map((p) =>
                      p.id === updatedProduct.id ? updatedProduct : p
                    );
                    patchState(store, { products: updatedProducts });
                  }

                  // Update selected product if it's the one we just updated
                  if (store.selectedProduct()?.id === updatedProduct.id) {
                    patchState(store, { selectedProduct: updatedProduct });
                  }

                  patchState(store, { loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'aggiornamento del prodotto",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'aggiornamento del prodotto"
                  );
                },
              })
            );
          })
        )
      ),

      // Delete a product
      deleteProduct: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const selectedProject = projectStore.selectedProject();

            if (!selectedProject && role !== 'admin') {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            let request;
            if (role === 'admin') {
              request = productService.deleteAdminProduct(id);
            } else {
              request = productService.deletePartnerProduct(
                selectedProject!.id,
                id
              );
            }

            return request.pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Prodotto eliminato con successo');

                  // Remove the deleted product from the products array
                  const currentProducts = store.products() || [];
                  const filteredProducts = currentProducts.filter(
                    (product) => product.id !== id
                  );

                  patchState(store, {
                    products: filteredProducts,
                    selectedProduct:
                      store.selectedProduct()?.id === id
                        ? null
                        : store.selectedProduct(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      "Errore durante l'eliminazione del prodotto",
                  });
                  toastService.showError(
                    (error as Error)?.message ||
                      "Errore durante l'eliminazione del prodotto"
                  );
                },
              })
            );
          })
        )
      ),

      // Update sort order for multiple products
      updateProductsSortOrder: rxMethod<{ updates: SortOrderUpdate[] }>(
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

            return productService.updateProductsSortOrder(params).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess(
                    'Ordinamento prodotti aggiornato con successo'
                  );

                  // Update local products with new sort orders
                  const currentProducts = store.products() || [];
                  const updatedProducts = currentProducts.map((product) => {
                    const update = updates.find((u) => u.id === product.id);
                    if (update) {
                      return { ...product, sortOrder: update.sortOrder };
                    }
                    return product;
                  });

                  // Sort products by sortOrder
                  updatedProducts.sort((a, b) => {
                    return a.sortOrder - b.sortOrder;
                  });

                  patchState(store, {
                    products: updatedProducts,
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

      // Import products from Cassa in Cloud
      importCCProducts: rxMethod<{
        ccProducts: ICCProduct[];
        salesPointId: string;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ ccProducts, salesPointId }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            if (!ccProducts || ccProducts.length === 0) {
              toastService.showError('Nessun prodotto da importare');
              patchState(store, { loading: false });
              return EMPTY;
            }

            // Ottieni le categorie locali per mappare i prodotti CC alle categorie locali
            const localCategories = categoryStore.categories() || [];
            if (!localCategories.length) {
              toastService.showError(
                'Nessuna categoria locale trovata. Importa prima le categorie.'
              );
              patchState(store, { loading: false });
              return EMPTY;
            }

            const partnerId = selectedProject.partnerId;

            return productService
              .prepareAndImportCCProducts(
                selectedProject.id,
                ccProducts,
                localCategories,
                salesPointId,
                partnerId
              )
              .pipe(
                tapResponse({
                  next: (importedProducts) => {
                    toastService.showSuccess(
                      `${importedProducts.length} prodotti importati con successo`
                    );

                    // Se stiamo visualizzando prodotti, aggiorniamo la lista
                    const currentProducts = store.products() || [];
                    if (currentProducts.length > 0) {
                      // Aggiungiamo o aggiorniamo i prodotti importati
                      // se appartengono alla categoria corrente
                      const currentCategoryId = currentProducts[0]?.categoryId;

                      const updatedProducts = [...currentProducts];
                      const addedProducts: Product[] = [];

                      importedProducts.forEach((imported) => {
                        // Se stiamo visualizzando per categoria e il prodotto è di un'altra categoria,
                        // non lo includiamo
                        if (
                          currentCategoryId &&
                          imported.categoryId !== currentCategoryId
                        ) {
                          return;
                        }

                        // Verifica se il prodotto esiste già
                        const existingIndex = updatedProducts.findIndex(
                          (p) => p.CCProductId === imported.CCProductId
                        );

                        if (existingIndex >= 0) {
                          // Aggiorna prodotto esistente
                          updatedProducts[existingIndex] = imported;
                        } else {
                          // Aggiungi nuovo prodotto
                          addedProducts.push(imported);
                        }
                      });

                      const mergedProducts = [
                        ...updatedProducts,
                        ...addedProducts,
                      ];

                      patchState(store, {
                        products: mergedProducts,
                        loading: false,
                        error: null,
                      });
                    } else {
                      patchState(store, { loading: false, error: null });
                    }
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        "Errore durante l'importazione dei prodotti",
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        "Errore durante l'importazione dei prodotti"
                    );
                  },
                })
              );
          })
        )
      ),

      // Search products with filters
      searchProducts: rxMethod<{ filters: Record<string, any> }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ filters }) => {
            const selectedProject = projectStore.selectedProject();
            if (!selectedProject) {
              toastService.showError('Nessun progetto selezionato');
              patchState(store, { loading: false });
              return EMPTY;
            }

            return productService
              .searchProducts(selectedProject.id, filters)
              .pipe(
                tapResponse({
                  next: (products) => {
                    patchState(store, {
                      products,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Errore durante la ricerca dei prodotti',
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Errore durante la ricerca dei prodotti'
                    );
                  },
                })
              );
          })
        )
      ),

      // Select a product
      selectProduct: (product: Product) => {
        patchState(store, { selectedProduct: product });
      },

      // Clear selected product
      clearSelectedProduct: () => {
        patchState(store, { selectedProduct: null });
      },

      // Clear errors
      clearProductErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Don't automatically load products on initialization,
      // as we need a selected project first
    },
  })
);
