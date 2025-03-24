import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, from, lastValueFrom, firstValueFrom } from 'rxjs';
import { catchError, map, concatMap, toArray } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Product,
  CreateProductDto,
  UpdateProductDto,
} from '../../../models/product.model';
import { AuthStore } from '../../../store/auth.signal-store';
import { ICCProduct } from '../../../interfaces/cassaincloud.interfaces';
import { Category } from '../../../models/category.model';

/**
 * Interfaccia per le risposte API standard
 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * Interfaccia per gli aggiornamenti dell'ordinamento dei prodotti
 */
export interface SortOrderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Parametri per l'aggiornamento dell'ordinamento di più prodotti
 */
export interface UpdateSortOrderParams {
  projectId: string;
  sortOrderUpdates: SortOrderUpdate[];
}

/**
 * Parametri per l'importazione di prodotti da Cassa in Cloud
 */
export interface ImportCCProductsParams {
  projectId: string;
  products: Product[]; // Prodotti già mappati in formato locale
  salesPointId: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  constructor() {}

  /**
   * Ottiene i prodotti pubblici per un progetto specifico
   * @param projectId ID del progetto
   * @returns Observable con l'array di prodotti
   */
  getPublicProducts(projectId: string): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/public/projects/${projectId}/products`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching public products:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching public products')
          );
        })
      );
  }

  /**
   * Ottiene i prodotti pubblici per una categoria specifica
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @returns Observable con l'array di prodotti della categoria
   */
  getPublicProductsByCategory(
    projectId: string,
    categoryId: string
  ): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/public/projects/${projectId}/categories/${categoryId}/products`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching public products by category:', error);
          return throwError(
            () =>
              new Error(
                error.message || 'Error fetching public products by category'
              )
          );
        })
      );
  }

  /**
   * Ottiene un prodotto pubblico specifico
   * @param projectId ID del progetto
   * @param productId ID del prodotto
   * @returns Observable con il prodotto richiesto
   */
  getPublicProduct(projectId: string, productId: string): Observable<Product> {
    return this.http
      .get<ApiResponse<Product>>(
        `${this.apiUrl}/public/projects/${projectId}/products/${productId}`
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching public product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching public product')
          );
        })
      );
  }

  /**
   * Ottiene tutti i prodotti per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @returns Observable con l'array di prodotti
   */
  getPartnerProducts(projectId: string): Observable<Product[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/products`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching partner products:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching partner products')
          );
        })
      );
  }

  /**
   * Ottiene i prodotti per una categoria specifica del partner autenticato
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @returns Observable con l'array di prodotti della categoria
   */
  getPartnerProductsByCategory(
    projectId: string,
    categoryId: string
  ): Observable<Product[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/partner/projects/${projectId}/categories/${categoryId}/products`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching partner products by category:', error);
          return throwError(
            () =>
              new Error(
                error.message || 'Error fetching partner products by category'
              )
          );
        })
      );
  }

  /**
   * Ottiene un prodotto specifico per un partner autenticato
   * @param projectId ID del progetto
   * @param productId ID del prodotto
   * @returns Observable con il prodotto richiesto
   */
  getPartnerProduct(projectId: string, productId: string): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product>>(
        `${this.apiUrl}/partner/projects/${projectId}/products/${productId}`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching partner product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching partner product')
          );
        })
      );
  }

  /**
   * Crea un nuovo prodotto per un progetto del partner autenticato
   * @param projectId ID del progetto
   * @param productData Dati del prodotto da creare
   * @returns Observable con il prodotto creato
   */
  createPartnerProduct(
    projectId: string,
    productData: CreateProductDto
  ): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Product>>(
        `${this.apiUrl}/partner/projects/${projectId}/products`,
        productData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating partner product:', error);
          return throwError(
            () => new Error(error.message || 'Error creating partner product')
          );
        })
      );
  }

  /**
   * Aggiorna un prodotto esistente del partner autenticato
   * @param projectId ID del progetto
   * @param productId ID del prodotto
   * @param productData Dati aggiornati del prodotto
   * @returns Observable con il prodotto aggiornato
   */
  updatePartnerProduct(
    projectId: string,
    productId: string,
    productData: UpdateProductDto
  ): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Product>>(
        `${this.apiUrl}/partner/projects/${projectId}/products/${productId}`,
        productData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating partner product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating partner product')
          );
        })
      );
  }

  /**
   * Elimina un prodotto esistente del partner autenticato
   * @param projectId ID del progetto
   * @param productId ID del prodotto da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deletePartnerProduct(projectId: string, productId: string): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(
        `${this.apiUrl}/partner/projects/${projectId}/products/${productId}`,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting partner product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting partner product')
          );
        })
      );
  }

  /**
   * Aggiorna l'ordinamento di più prodotti contemporaneamente
   * @param params Parametri per l'aggiornamento dell'ordinamento
   * @returns Observable che completa dopo l'aggiornamento
   */
  updateProductsSortOrder(params: UpdateSortOrderParams): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<any>>(
        `${this.apiUrl}/partner/products/sort-order`,
        params,
        { headers }
      )
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error('Error updating products sort order:', error);
          return throwError(
            () =>
              new Error(error.message || 'Error updating products sort order')
          );
        })
      );
  }

  /**
   * Ottiene tutti i prodotti per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @returns Observable con l'array di prodotti
   */
  getAdminProducts(projectId: string): Observable<Product[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/admin/projects/${projectId}/products`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching admin products:', error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin products')
          );
        })
      );
  }

  /**
   * Ottiene i prodotti per una categoria specifica (accesso admin)
   * @param projectId ID del progetto
   * @param categoryId ID della categoria
   * @returns Observable con l'array di prodotti della categoria
   */
  getAdminProductsByCategory(
    projectId: string,
    categoryId: string
  ): Observable<Product[]> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product[]>>(
        `${this.apiUrl}/admin/projects/${projectId}/categories/${categoryId}/products`,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching admin products by category:', error);
          return throwError(
            () =>
              new Error(
                error.message || 'Error fetching admin products by category'
              )
          );
        })
      );
  }

  /**
   * Ottiene un prodotto specifico (accesso admin)
   * @param productId ID del prodotto
   * @returns Observable con il prodotto richiesto
   */
  getAdminProduct(productId: string): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .get<ApiResponse<Product>>(`${this.apiUrl}/admin/products/${productId}`, {
        headers,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error fetching admin product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error fetching admin product')
          );
        })
      );
  }

  /**
   * Crea un nuovo prodotto per un progetto (accesso admin)
   * @param projectId ID del progetto
   * @param productData Dati del prodotto da creare
   * @returns Observable con il prodotto creato
   */
  createAdminProduct(
    projectId: string,
    productData: CreateProductDto
  ): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .post<ApiResponse<Product>>(
        `${this.apiUrl}/admin/projects/${projectId}/products`,
        productData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error creating admin product:', error);
          return throwError(
            () => new Error(error.message || 'Error creating admin product')
          );
        })
      );
  }

  /**
   * Aggiorna un prodotto esistente (accesso admin)
   * @param productId ID del prodotto
   * @param productData Dati aggiornati del prodotto
   * @returns Observable con il prodotto aggiornato
   */
  updateAdminProduct(
    productId: string,
    productData: UpdateProductDto
  ): Observable<Product> {
    const headers = this.getAuthHeaders();

    return this.http
      .put<ApiResponse<Product>>(
        `${this.apiUrl}/admin/products/${productId}`,
        productData,
        { headers }
      )
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error(`Error updating admin product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error updating admin product')
          );
        })
      );
  }

  /**
   * Elimina un prodotto esistente (accesso admin)
   * @param productId ID del prodotto da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteAdminProduct(productId: string): Observable<void> {
    const headers = this.getAuthHeaders();

    return this.http
      .delete<ApiResponse<any>>(`${this.apiUrl}/admin/products/${productId}`, {
        headers,
      })
      .pipe(
        map(() => undefined),
        catchError((error) => {
          console.error(`Error deleting admin product ${productId}:`, error);
          return throwError(
            () => new Error(error.message || 'Error deleting admin product')
          );
        })
      );
  }

/**
 * Importa prodotti da Cassa in Cloud creandoli come nuovi prodotti locali
 * @param params Parametri per l'importazione
 * @returns Observable con i prodotti importati
 */
importCCProducts(params: ImportCCProductsParams): Observable<Product[]> {
  const headers = this.getAuthHeaders();
  
  // Usa concatMap per processare i prodotti in sequenza
  return from(params.products).pipe(
    // Elabora un prodotto alla volta in sequenza
    concatMap(product => {
      // Prepara il DTO di creazione dal prodotto pre-mappato
      const createDto: CreateProductDto = {
        name: product.name,
        description: product.description || '',
        price: product.price,
        categoryId: product.categoryId,
        allergens: product.allergens || [],
        calories: product.calories || 0,
        sortOrder: product.sortOrder || 0,
        isActive: product.isActive !== undefined ? product.isActive : true,
        projectId: params.projectId,
        partnerId: product.partnerId,
        
        // Mantieni tutte le informazioni di collegamento a CC
        CCConnection: true,
        CCProductId: product.CCProductId,
        CCProductVariantId: product.CCProductVariantId,
        CCCategoryId: product.CCCategoryId,
        CCSalesPointId: params.salesPointId,
        CCProduct: product.CCProduct,
        
        // Dati aggiuntivi come tag, ingredienti, ecc.
        additionalData: product.additionalData || {}
      };
      
      // Crea il prodotto e gestisci eventuali errori a livello di singolo prodotto
      return this.createPartnerProduct(params.projectId, createDto).pipe(
        catchError(error => {
          // Log dell'errore ma continua con il prossimo prodotto
          console.error(`Errore creando il prodotto "${product.name}":`, error);
          // Ritorna null per i prodotti che falliscono (verranno filtrati dopo)
          return from([null as unknown as Product]);
        })
      );
    }),
    // Raccogli tutti i prodotti creati in un array finale
    toArray(),
    // Filtra i prodotti null (quelli che hanno generato errori)
    map(products => products.filter(p => p !== null)),
    // Gestisci errori generali
    catchError(error => {
      console.error('Errore durante l\'importazione dei prodotti:', error);
      return throwError(() => new Error(error.message || 'Errore durante l\'importazione dei prodotti'));
    })
  );
}
  /**
   * Prepara e importa prodotti da Cassa in Cloud
   * @param projectId ID del progetto
   * @param ccProducts Prodotti di Cassa in Cloud
   * @param localCategories Categorie locali già mappate con i CCCategoryId
   * @param salesPointId ID del punto vendita
   * @param partnerId ID del partner
   * @returns Observable con i prodotti importati
   */
  prepareAndImportCCProducts(
    projectId: string,
    ccProducts: ICCProduct[],
    localCategories: Category[],
    salesPointId: string,
    partnerId: string
  ): Observable<Product[]> {
    // Creo una mappa delle categorie locali indicizzate per CCCategoryId
    const categoriesMap = new Map<string, Category>();
    localCategories.forEach((category) => {
      if (category.CCCategoryId) {
        categoriesMap.set(category.CCCategoryId, category);
      }
    });

    // Preparo i prodotti locali a partire dai prodotti CC
    const localProducts: Product[] = [];

    // Per ogni prodotto CC, trovo la categoria locale e mappo il prodotto
    ccProducts.forEach((ccProduct) => {
      const ccCategoryId = ccProduct.idCategory.toString();
      const localCategory = categoriesMap.get(ccCategoryId);

      // Se trovo una categoria locale mappata, creo il prodotto locale
      if (localCategory) {
        const localProduct = this.mapCCProductToLocalProduct(
          ccProduct,
          projectId,
          partnerId,
          localCategory.id!, // Uso l'ID della categoria locale
          salesPointId
        );
        localProducts.push(localProduct);
      } else {
        console.warn(
          `Categoria locale non trovata per il prodotto CC: ${ccProduct.description} (CCCategoryId: ${ccCategoryId})`
        );
      }
    });

    // Se non ho prodotti da importare, ritorno un array vuoto
    if (localProducts.length === 0) {
      return new Observable((observer) => {
        observer.next([]);
        observer.complete();
      });
    }

    // Invio i prodotti mappati all'endpoint di importazione
    const params: ImportCCProductsParams = {
      projectId,
      products: localProducts,
      salesPointId,
    };

    return this.importCCProducts(params);
  }

/**
 * Mappa un prodotto CC in un prodotto locale
 * @param ccProduct Prodotto di Cassa in Cloud
 * @param projectId ID del progetto
 * @param partnerId ID del partner
 * @param localCategoryId ID della categoria locale
 * @param salesPointId ID del punto vendita
 * @returns Prodotto in formato locale
 */
private mapCCProductToLocalProduct(
  ccProduct: ICCProduct,
  projectId: string,
  partnerId: string,
  localCategoryId: string,
  salesPointId: string
): Product {
  // Estrazione del prezzo semplificata
  let price = 0;
  
  if (ccProduct.prices && ccProduct.prices.length > 0) {
    // Converti l'ID del punto vendita in numero
    const salesPointIdNum = parseInt(salesPointId, 10);
    
    // Cerca un prezzo che corrisponda al punto vendita
    const matchingPrice = ccProduct.prices.find(p => 
      parseInt(p.idSalesPoint.toString(), 10) === salesPointIdNum);
    
    if (matchingPrice) {
      // Se trovo una corrispondenza, uso quel prezzo
      price = matchingPrice.value;
    } else {
      // Se non trovo corrispondenza, uso il primo prezzo disponibile
      price = ccProduct.prices[0].value;
    }
  }

  // Estrai nome prodotto per il modello locale
  const name = ccProduct.description || '';

  // Estrai descrizione (usa descrizione estesa o fallback a descrizione normale)
  const description =
    ccProduct.descriptionExtended || ccProduct.description || '';

  // Estrai dati variante se disponibili
  const isMultivariant = ccProduct.multivariant || false;
  const variantId = ccProduct.variants ? ccProduct.variants[0]?.id : '';

  // Mappa il prodotto al modello locale
  return {
    name,
    description,
    price,
    allergens: [], // CC non ha informazioni dirette sugli allergeni
    calories: 0, // CC non ha informazioni sulle calorie
    sortOrder: 0, // Imposta ordine predefinito
    isActive: true, // Assumiamo attivo di default

    // Associazione alla categoria locale trovata
    categoryId: localCategoryId,
    projectId,
    partnerId,

    // Dati di integrazione CC
    CCConnection: true,
    CCSalesPointId: salesPointId,
    CCCategoryId: ccProduct.idCategory.toString(),
    CCProductId: ccProduct.id,
    CCProductVariantId: variantId,
    CCProduct: ccProduct,

    // Dati aggiuntivi con estrazione automatica dei tag se disponibili
    additionalData: {
      tags: ccProduct.tags || [],
      ingredients: [],
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isLactoseFree: false,
      image: '', // L'immagine sarà nulla per i prodotti importati da CC
    },
  };
}

  /**
   * Ricerca prodotti con filtri
   * @param projectId ID del progetto
   * @param filters Filtri di ricerca (opzionali)
   * @returns Observable con l'array di prodotti filtrati
   */
  searchProducts(
    projectId: string,
    filters: Record<string, any> = {}
  ): Observable<Product[]> {
    const headers = this.getAuthHeaders();

    // Converti i filtri in parametri di query
    let params = new HttpParams().set('projectId', projectId);

    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null) {
        params = params.set(key, filters[key].toString());
      }
    });

    return this.http
      .get<ApiResponse<Product[]>>(`${this.apiUrl}/partner/products/search`, {
        headers,
        params,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error searching products:', error);
          return throwError(
            () => new Error(error.message || 'Error searching products')
          );
        })
      );
  }

  /**
   * Recupera gli header di autenticazione dall'AuthStore
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }
}
