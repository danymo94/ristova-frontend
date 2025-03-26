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
  RawProduct,
  CreateRawProductDto,
  InvoiceRawProduct,
  ExtractInvoiceResponse,
} from '../models/rawproduct.model';
import { RawproductService } from '../services/api/local/rawproduct.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, EMPTY, Observable } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { ProjectStore } from './project.signal-store';

export interface RawProductState {
  rawProducts: RawProduct[] | null;
  selectedRawProduct: RawProduct | null;
  invoiceRawProducts: InvoiceRawProduct[] | null;
  extractionResult: ExtractInvoiceResponse | null;
  loading: boolean;
  processingEmbeddings: boolean;
  extractingFromInvoice: boolean;
  error: string | null;
}

const initialState: RawProductState = {
  rawProducts: null,
  selectedRawProduct: null,
  invoiceRawProducts: null,
  extractionResult: null,
  loading: false,
  processingEmbeddings: false,
  extractingFromInvoice: false,
  error: null,
};

export const RawProductStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      rawProductService = inject(RawproductService),
      projectStore = inject(ProjectStore),
      authService = inject(AuthService),
      toastService = inject(ToastService),
      router = inject(Router)
    ) => ({
      // Utility method to get raw product by ID
      getRawProductById(id: string) {
        const currentRawProducts = store.rawProducts();
        return currentRawProducts
          ? currentRawProducts.find((rawProduct) => rawProduct.id === id)
          : null;
      },

      // Fetch project raw products (based on role)
      fetchProjectRawProducts: rxMethod<{ projectId: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? rawProductService.getAdminProjectRawProducts(projectId)
                : rawProductService.getPartnerProjectRawProducts(projectId);

            return request.pipe(
              tapResponse({
                next: (rawProducts) => {
                  patchState(store, {
                    rawProducts,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch raw products',
                  });
                  toastService.showError(
                    (error as Error)?.message || 'Failed to fetch raw products'
                  );
                },
              })
            );
          })
        )
      ),

      // Fetch all admin raw products
      fetchAllAdminRawProducts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => {
            return rawProductService.getAllAdminRawProducts().pipe(
              tapResponse({
                next: (rawProducts) => {
                  patchState(store, {
                    rawProducts,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch raw products',
                  });
                  toastService.showError(
                    (error as Error)?.message || 'Failed to fetch raw products'
                  );
                },
              })
            );
          })
        )
      ),

      // Get specific raw product
      getRawProduct: rxMethod<{ projectId?: string; id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id }) => {
            const role = authService.userRole();

            let request: Observable<RawProduct>;
            if (role === 'admin') {
              request = rawProductService.getAdminRawProduct(id);
            } else {
              // Per partner, richiede projectId
              if (!projectId) {
                const selectedProject = projectStore.selectedProject();
                if (!selectedProject) {
                  toastService.showError('No project selected');
                  patchState(store, { loading: false });
                  return EMPTY;
                }
                projectId = selectedProject.id;
              }
              request = rawProductService.getPartnerRawProduct(projectId, id);
            }

            return request.pipe(
              tapResponse({
                next: (rawProduct) => {
                  patchState(store, {
                    selectedRawProduct: rawProduct,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch raw product',
                  });
                  toastService.showError(
                    (error as Error)?.message || 'Failed to fetch raw product'
                  );
                },
              })
            );
          })
        )
      ),

      // Create or update raw product
      createOrUpdateRawProduct: rxMethod<{
        projectId: string;
        rawProduct: CreateRawProductDto;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, rawProduct }) =>
            rawProductService
              .createOrUpdateRawProduct(projectId, rawProduct)
              .pipe(
                tapResponse({
                  next: (createdRawProduct) => {
                    toastService.showSuccess(
                      'Raw product successfully processed'
                    );

                    // Update raw products array, either adding new or updating existing
                    const currentRawProducts = store.rawProducts() || [];
                    const existingIndex = currentRawProducts.findIndex(
                      (p) =>
                        p.productCode === rawProduct.productCode &&
                        p.supplierId === rawProduct.supplierId
                    );

                    if (existingIndex >= 0) {
                      // Update existing
                      const updatedRawProducts = [...currentRawProducts];
                      updatedRawProducts[existingIndex] = createdRawProduct;
                      patchState(store, {
                        rawProducts: updatedRawProducts,
                        loading: false,
                        error: null,
                      });
                    } else {
                      // Add new
                      patchState(store, {
                        rawProducts: [...currentRawProducts, createdRawProduct],
                        loading: false,
                        error: null,
                      });
                    }
                  },
                  error: (error: unknown) => {
                    toastService.showError('Failed to process raw product');
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to process raw product',
                    });
                  },
                })
              )
          )
        )
      ),

      // Delete a raw product
      deleteRawProduct: rxMethod<{ projectId: string; id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ projectId, id }) =>
            rawProductService.deleteRawProduct(projectId, id).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Raw product successfully deleted');

                  // Remove the deleted raw product from the array
                  const currentRawProducts = store.rawProducts() || [];
                  const filteredRawProducts = currentRawProducts.filter(
                    (rawProduct) => rawProduct.id !== id
                  );

                  patchState(store, {
                    rawProducts: filteredRawProducts,
                    selectedRawProduct:
                      store.selectedRawProduct()?.id === id
                        ? null
                        : store.selectedRawProduct(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to delete raw product');
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to delete raw product',
                  });
                },
              })
            )
          )
        )
      ),

      // Get raw products for a specific invoice
      fetchInvoiceRawProducts: rxMethod<{
        projectId: string;
        invoiceId: string;
      }>(
        pipe(
          tap(() =>
            patchState(store, {
              loading: true,
              error: null,
              invoiceRawProducts: null,
            })
          ),
          switchMap(({ projectId, invoiceId }) =>
            rawProductService
              .getRawProductsByInvoice(projectId, invoiceId)
              .pipe(
                tapResponse({
                  next: (invoiceRawProducts) => {
                    patchState(store, {
                      invoiceRawProducts,
                      loading: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to fetch invoice raw products',
                      invoiceRawProducts: null,
                    });
                    toastService.showError(
                      (error as Error)?.message ||
                        'Failed to fetch invoice raw products'
                    );
                  },
                })
              )
          )
        )
      ),

      // Extract raw products from an invoice using batch operation
      extractRawProductsFromInvoice: rxMethod<{
        projectId: string;
        invoiceId: string;
      }>(
        pipe(
          tap(() =>
            patchState(store, {
              extractingFromInvoice: true,
              extractionResult: null,
              error: null,
            })
          ),
          switchMap(({ projectId, invoiceId }) =>
            rawProductService
              .extractRawProductsFromInvoice(projectId, invoiceId)
              .pipe(
                tapResponse({
                  next: (extractionResult) => {
                    if (extractionResult.successful) {
                      toastService.showSuccess(
                        `Extracted ${extractionResult.processedLines} products successfully`
                      );
                    } else {
                      toastService.showWarn(
                        `Extraction completed with ${extractionResult.errors.length} errors`
                      );
                    }

                    patchState(store, {
                      extractionResult,
                      extractingFromInvoice: false,
                      error: null,
                    });
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      (error as Error)?.message ||
                        'Failed to extract raw products from invoice'
                    );
                    patchState(store, {
                      extractingFromInvoice: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to extract raw products from invoice',
                    });
                  },
                })
              )
          )
        )
      ),

      // Generate embeddings for raw products
      generateEmbeddings: rxMethod<{ projectId: string }>(
        pipe(
          tap(() =>
            patchState(store, { processingEmbeddings: true, error: null })
          ),
          switchMap(({ projectId }) =>
            rawProductService.generateEmbeddings(projectId).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Embeddings successfully generated');
                  patchState(store, {
                    processingEmbeddings: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to generate embeddings');
                  patchState(store, {
                    processingEmbeddings: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to generate embeddings',
                  });
                },
              })
            )
          )
        )
      ),

      // Select a raw product
      selectRawProduct: (rawProduct: RawProduct) => {
        patchState(store, { selectedRawProduct: rawProduct });
      },

      // Clear selected raw product
      clearSelectedRawProduct: () => {
        patchState(store, { selectedRawProduct: null });
      },

      // Clear invoice raw products
      clearInvoiceRawProducts: () => {
        patchState(store, { invoiceRawProducts: null });
      },

      // Clear extraction result
      clearExtractionResult: () => {
        patchState(store, { extractionResult: null });
      },

      // Clear errors
      clearRawProductErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo i prodotti grezzi automaticamente all'inizializzazione
    },
  })
);
