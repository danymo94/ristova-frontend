import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend, HttpHeaders } from '@angular/common/http';
import { TokenService } from './token.service';
import { Observable, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ICCProduct } from '../../../interfaces/cassaincloud.interfaces';
// Aggiungere all'inizio del file product.service.ts
import { Category } from '../../../models/category.model';
/**
 * Enum per i canali di visibilità dei prodotti
 */
export enum ProductChannel {
  RISTO = 'RISTO',
  SALE = 'SALE',
  ECOMMERCE = 'ECOMMERCE',
  MOBILECOMMERCE = 'MOBILE_COMMERCE',
  SELFORDER = 'SELF_ORDER',
  KIOSK = 'KIOSK',
}

/**
 * Formati supportati per il codice a barre
 */
export enum BarcodeFormat {
  EAN13 = 'EAN13',
  EAN8 = 'EAN8',
  CODE128 = 'CODE128',
  CODE39 = 'CODE39',
  UPC = 'UPC',
  QR = 'QR',
}

/**
 * Barcode di un prodotto
 */
export interface Barcode {
  value: string;
  format?: BarcodeFormat;
  salable: boolean;
}

/**
 * Prezzo di un prodotto
 */
export interface Price {
  idSalesMode?: string;
  idSalesPoint?: number;
  value: number;
}

/**
 * Costo di un prodotto
 */
export interface Cost {
  idSupplier: string;
  cost: number;
  variation1?: number;
  variation2?: number;
  variation3?: number;
  variation4?: number;
  idDepartment?: string;
}

/**
 * Immagine di un prodotto
 */
export interface ProductImage {
  imageUrl: string;
}

/**
 * Valore di un attributo
 */
export interface AttributeValue {
  idValue: string;
}

/**
 * Attributo di un prodotto
 */
export interface Attribute {
  idOption: string;
  position: number;
  values: AttributeValue[];
}

/**
 * Valore di un modificatore
 */
export interface ModifierValue {
  idValue: string;
  price?: number;
  percentagePrice?: number;
  isDefault?: boolean;
}

/**
 * Modificatore di un prodotto
 */
export interface Modifier {
  idOption: string;
  position: number;
  values: ModifierValue[];
}

/**
 * Scelta di un corso (per prodotti tipo menu)
 */
export interface CourseChoice {
  idProduct?: string;
  idCategory?: string;
  quantity: number;
}

/**
 * Corso di un prodotto menu
 */
export interface Course {
  description: string;
  position: number;
  min: number;
  max: number;
  orderTicketCourse: number;
  courseChoices: CourseChoice[];
}

/**
 * Prezzo per un componente
 */
export interface ComponentPrice {
  idSalesMode?: string;
  idSalesPoint?: number;
  value: number;
}

/**
 * Scelta di un componente (per prodotti compositi)
 */
export interface ComponentChoice {
  idProduct?: string;
  idCategory?: string;
  price?: ComponentPrice;
}

/**
 * Componente di un prodotto composito
 */
export interface Component {
  description: string;
  position: number;
  min: number;
  max: number;
  orderTicketCourse: number;
  componentChoices: ComponentChoice[];
}

/**
 * Parametri di creazione prodotto
 */
export interface ProductCreateParams {
  description: string;
  descriptionLabel: string;
  descriptionExtended: string;
  idDepartment: string;
  idCategory: string;
  idSalesPoint: number;
  icon?: string;
  soldByWeight: boolean;
  defaultTare?: number;
  multivariant: boolean;
  color?: string;
  enableForRisto: boolean;
  enableForSale: boolean;
  enableForECommerce: boolean;
  enableForMobileCommerce: boolean;
  enableForSelfOrderMenu: boolean;
  enableForKiosk: boolean;
  tags?: string[];
  costs?: Cost[];
  externalId?: string;
  descriptionReceipt?: string;
  internalId?: string;
  barcodes?: Barcode[];
  prices: Price[];
  attributes?: Attribute[];
  modifiers?: Modifier[];
  images?: ProductImage[];
  menu?: boolean;
  composition?: boolean;
  soldOnlyInCompositions?: boolean;
  courses?: Course[];
  components?: Component[];
}

/**
 * Parametri per l'aggiornamento di un prodotto
 */
export interface ProductUpdateParams {
  description?: string;
  descriptionLabel?: string;
  descriptionExtended?: string;
  idDepartment?: string;
  idCategory?: string;
  icon?: string;
  soldByWeight?: boolean;
  defaultTare?: number;
  multivariant?: boolean;
  color?: string;
  enableForRisto?: boolean;
  enableForSale?: boolean;
  enableForECommerce?: boolean;
  enableForMobileCommerce?: boolean;
  enableForSelfOrderMenu?: boolean;
  enableForKiosk?: boolean;
  tags?: string[];
  costs?: Cost[];
  externalId?: string;
  descriptionReceipt?: string;
  internalId?: string;
  barcodes?: Barcode[];
  prices?: Price[];
  attributes?: Attribute[];
  modifiers?: Modifier[];
  images?: ProductImage[];
  menu?: boolean;
  composition?: boolean;
  soldOnlyInCompositions?: boolean;
  courses?: Course[];
  components?: Component[];
}

/**
 * Interfaccia per il parametro di ordinamento
 */
export interface Sort {
  property: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Parametri di ricerca per i prodotti
 */
export interface ProductSearchParams {
  start?: number;
  limit?: number;
  sorts?: Sort[];
  ids?: string[];
  idsSalesPoint?: number[];
  idsCategory?: string[];
  idsDepartment?: string[];
  description?: string;
  barcodes?: string[];
  multiVariant?: boolean;
  tags?: string[];
  tagsAll?: string[];
  menu?: boolean;
  composition?: boolean;
  soldOnlyInComposition?: boolean;
  externalId?: string[];
  lastUpdateFrom?: string; // timestamp ISO
  lastUpdateTo?: string; // timestamp ISO
  enabledForChannels?: ProductChannel[]; // Filtra per canali abilitati
  itemListVisibility?: boolean; // Applica regole di visibilità per account
}

/**
 * Risposta dell'API per un singolo prodotto
 */
export interface ProductResponse {
  product: ICCProduct;
}

/**
 * Risposta dell'API per più prodotti
 */
export interface ProductsResponse {
  products: ICCProduct[];
  totalCount: number;
}

/**
 * Risposta per l'operazione di batch
 */
export interface BatchProductsResponse {
  batchResponse: {
    create: { id: string; externalId?: string }[];
    update: { id: string; externalId?: string }[];
  };
}

/**
 * Parametri di creazione/aggiornamento batch per prodotti
 */
export interface BatchProductParams {
  create?: ProductCreateParams[];
  update?: (ProductUpdateParams & { id: string })[];
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  // Utilizzo di inject() per le dipendenze
  private httpBackend = inject(HttpBackend);
  private tokenService = inject(TokenService);

  // Proprietà del servizio
  private httpClient: HttpClient;
  private baseUrl: string;

  constructor() {
    // Creiamo un'istanza di HttpClient che bypassa gli interceptor
    this.httpClient = new HttpClient(this.httpBackend);
    // Base URL dell'API Cassa in Cloud
    this.baseUrl = 'https://api.cassanova.com';
  }

  /**
   * Recupera tutti i prodotti paginando automaticamente le richieste quando ce ne sono più di 100
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri di ricerca opzionali (il limite verrà usato per ogni singola richiesta)
   * @returns Observable con l'intera lista dei prodotti
   */
  getAllProductsPaginated(
    apiKey: string,
    params: ProductSearchParams = { start: 0, limit: 100 }
  ): Observable<ICCProduct[]> {
    // Utilizziamo un subject per accumulare i risultati
    return new Observable<ICCProduct[]>((observer) => {
      const allProducts: ICCProduct[] = [];
      const limit = params.limit || 100;
      let currentStart = params.start || 0;
      let hasMoreResults = true;

      // Funzione ricorsiva per recuperare tutti i prodotti
      const fetchNextPage = () => {
        // Copia i parametri e aggiorna start e limit
        const pageParams: ProductSearchParams = {
          ...params,
          start: currentStart,
          limit: limit,
        };

        // Chiamata al metodo esistente per ottenere una pagina di prodotti
        this.getProducts(apiKey, pageParams).subscribe({
          next: (response) => {
            // Aggiungi i prodotti attuali al risultato totale
            allProducts.push(...response.products);

            // Verifica se ci sono altri prodotti da recuperare
            const totalCount = response.totalCount;
            const retrievedCount = currentStart + response.products.length;

            // Log informativo sul processo di paginazione
            console.log(`Recuperati ${retrievedCount}/${totalCount} prodotti`);

            // Se abbiamo recuperato meno prodotti di quanti ce ne sono in totale
            if (retrievedCount < totalCount) {
              // Aggiorna lo start per la prossima pagina
              currentStart += limit;
              // Recupera la prossima pagina
              fetchNextPage();
            } else {
              // Abbiamo recuperato tutti i prodotti, completa l'observable
              observer.next(allProducts);
              observer.complete();
            }
          },
          error: (error) => {
            // In caso di errore, propaga l'errore all'observable
            observer.error(error);
          },
        });
      };

      // Avvia il processo di recupero
      fetchNextPage();
    });
  }

  /**
   * Recupera tutti i prodotti di un punto vendita, gestendo la paginazione
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @param enabledForChannels - Canali per cui i prodotti sono abilitati
   * @returns Observable con la lista completa dei prodotti del punto vendita
   */
  getAllProductsBySalesPoint(
    apiKey: string,
    salesPointId: number,
    enabledForChannels?: ProductChannel[],
    additionalParams: Partial<ProductSearchParams> = {}
  ): Observable<ICCProduct[]> {
    // Costruiamo i parametri di ricerca
    const searchParams: ProductSearchParams = {
      start: 0,
      limit: 100, // Recupera 100 elementi per pagina
      idsSalesPoint: [salesPointId],
      ...additionalParams,
    };

    // Aggiungiamo i canali se specificati
    if (enabledForChannels && enabledForChannels.length > 0) {
      searchParams.enabledForChannels = enabledForChannels;
    }

    // Utilizziamo il metodo paginato per recuperare tutti i prodotti
    return this.getAllProductsPaginated(apiKey, searchParams);
  }

  /**
   * Recupera tutti i prodotti di una categoria, gestendo la paginazione
   * @param apiKey - La chiave API da utilizzare
   * @param categoryId - ID della categoria
   * @param salesPointId - ID opzionale del punto vendita
   * @returns Observable con la lista completa dei prodotti della categoria
   */
  getAllProductsByCategory(
    apiKey: string,
    categoryId: string,
    salesPointId?: number,
    additionalParams: Partial<ProductSearchParams> = {}
  ): Observable<ICCProduct[]> {
    // Costruiamo i parametri di ricerca
    const searchParams: ProductSearchParams = {
      start: 0,
      limit: 100, // Recupera 100 elementi per pagina
      idsCategory: [categoryId],
      ...additionalParams,
    };

    // Aggiungiamo il punto vendita se specificato
    if (salesPointId) {
      searchParams.idsSalesPoint = [salesPointId];
    }

    // Utilizziamo il metodo paginato per recuperare tutti i prodotti
    return this.getAllProductsPaginated(apiKey, searchParams);
  }

  /**
   * Recupera tutti i prodotti secondo i parametri di ricerca specificati
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri di ricerca opzionali
   * @returns Observable con la lista dei prodotti
   */
  getProducts(
    apiKey: string,
    params: ProductSearchParams = { start: 0, limit: 100 }
  ): Observable<ProductsResponse> {
    // Costruiamo un oggetto per i parametri base
    const queryParams: Record<string, string> = {
      start: params.start?.toString() || '0',
      limit: params.limit?.toString() || '100',
    };

    // Aggiungi parametri opzionali se presenti
    if (params.description) {
      queryParams['description'] = params.description;
    }

    if (params.lastUpdateFrom) {
      queryParams['lastUpdateFrom'] = params.lastUpdateFrom;
    }

    if (params.lastUpdateTo) {
      queryParams['lastUpdateTo'] = params.lastUpdateTo;
    }

    if (params.multiVariant !== undefined) {
      queryParams['multiVariant'] = params.multiVariant.toString();
    }

    if (params.menu !== undefined) {
      queryParams['menu'] = params.menu.toString();
    }

    if (params.composition !== undefined) {
      queryParams['composition'] = params.composition.toString();
    }

    if (params.soldOnlyInComposition !== undefined) {
      queryParams['soldOnlyInComposition'] =
        params.soldOnlyInComposition.toString();
    }

    if (params.itemListVisibility !== undefined) {
      queryParams['itemListVisibility'] = params.itemListVisibility.toString();
    }

    // Creiamo la stringa di query manualmente per evitare i caratteri di escape
    let queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Gestiamo separatamente gli array per mantenere i caratteri [] non codificati
    if (params.ids && params.ids.length > 0) {
      queryString += `&ids=[${params.ids.join(',')}]`;
    }

    if (params.idsSalesPoint && params.idsSalesPoint.length > 0) {
      queryString += `&idsSalesPoint=[${params.idsSalesPoint.join(',')}]`;
    }

    if (params.idsCategory && params.idsCategory.length > 0) {
      queryString += `&idsCategory=[${params.idsCategory.join(',')}]`;
    }

    if (params.idsDepartment && params.idsDepartment.length > 0) {
      queryString += `&idsDepartment=[${params.idsDepartment.join(',')}]`;
    }

    if (params.barcodes && params.barcodes.length > 0) {
      queryString += `&barcodes=[${params.barcodes.join(',')}]`;
    }

    if (params.externalId && params.externalId.length > 0) {
      queryString += `&externalId=[${params.externalId.join(',')}]`;
    }

    if (params.tags && params.tags.length > 0) {
      queryString += `&tags=[${params.tags.join(',')}]`;
    }

    if (params.tagsAll && params.tagsAll.length > 0) {
      queryString += `&tagsAll=[${params.tagsAll.join(',')}]`;
    }

    // Gestione dell'ordinamento
    if (params.sorts && params.sorts.length > 0) {
      params.sorts.forEach((sort) => {
        queryString += `&sorts=${sort.property}:${sort.direction}`;
      });
    }

    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Utilizziamo l'URL con la stringa di query invece di HttpParams
        return this.httpClient.get<ProductsResponse>(
          `${this.baseUrl}/products?${queryString}`,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error fetching products:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching products')
        );
      })
    );
  }

  /**
   * Recupera i prodotti per un punto vendita specifico
   * @param apiKey - La chiave API da utilizzare
   * @param salesPointId - ID del punto vendita
   * @param enabledForChannels - Canali per cui i prodotti sono abilitati
   * @returns Observable con la lista dei prodotti del punto vendita
   */
  getProductsBySalesPoint(
    apiKey: string,
    salesPointId: number,
    enabledForChannels?: ProductChannel[],
    additionalParams: Partial<ProductSearchParams> = {}
  ): Observable<ProductsResponse> {
    // Costruiamo i parametri di ricerca
    const searchParams: ProductSearchParams = {
      start: 0,
      limit: 100,
      idsSalesPoint: [salesPointId],
      ...additionalParams,
    };

    // Aggiungiamo i canali se specificati
    if (enabledForChannels && enabledForChannels.length > 0) {
      searchParams.enabledForChannels = enabledForChannels;
    }

    return this.getProducts(apiKey, searchParams);
  }

  /**
   * Recupera i prodotti per una categoria specifica
   * @param apiKey - La chiave API da utilizzare
   * @param categoryId - ID della categoria
   * @param salesPointId - ID opzionale del punto vendita per filtrare ulteriormente
   * @returns Observable con la lista dei prodotti della categoria
   */
  getProductsByCategory(
    apiKey: string,
    categoryId: string,
    salesPointId?: number,
    additionalParams: Partial<ProductSearchParams> = {}
  ): Observable<ProductsResponse> {
    // Costruiamo i parametri di ricerca
    const searchParams: ProductSearchParams = {
      start: 0,
      limit: 100,
      idsCategory: [categoryId],
      ...additionalParams,
    };

    // Aggiungiamo il punto vendita se specificato
    if (salesPointId) {
      searchParams.idsSalesPoint = [salesPointId];
    }

    return this.getProducts(apiKey, searchParams);
  }

  /**
   * Recupera un prodotto specifico per ID
   * @param apiKey - La chiave API da utilizzare
   * @param productId - ID del prodotto da recuperare
   * @returns Observable con il prodotto richiesto
   */
  getProductById(
    apiKey: string,
    productId: string
  ): Observable<ProductResponse> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        return this.httpClient.get<ProductResponse>(
          `${this.baseUrl}/products/${productId}`,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error fetching product by id:', error);
        return throwError(
          () => new Error(error.message || 'Error fetching product')
        );
      })
    );
  }

  /**
   * Crea un nuovo prodotto
   * @param apiKey - La chiave API da utilizzare
   * @param params - Parametri per la creazione del prodotto
   * @returns Observable con l'ID del prodotto creato
   */
  createProduct(
    apiKey: string,
    params: ProductCreateParams
  ): Observable<{ id: string }> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Converti i parametri in formato JSON
        const body = JSON.stringify(params);

        return this.httpClient.post<{ id: string }>(
          `${this.baseUrl}/products`,
          body,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error creating product:', error);
        return throwError(
          () => new Error(error.message || 'Error creating product')
        );
      })
    );
  }

  /**
   * Aggiorna un prodotto esistente
   * @param apiKey - La chiave API da utilizzare
   * @param productId - ID del prodotto da aggiornare
   * @param params - Parametri di aggiornamento
   * @returns Observable void o con il prodotto aggiornato
   */
  updateProduct(
    apiKey: string,
    productId: string,
    params: ProductUpdateParams
  ): Observable<void> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Converti i parametri in formato JSON
        const body = JSON.stringify(params);

        // PUT non ritorna un payload, quindi impostiamo il tipo di risposta come void
        return this.httpClient.put<void>(
          `${this.baseUrl}/products/${productId}`,
          body,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error updating product:', error);
        return throwError(
          () => new Error(error.message || 'Error updating product')
        );
      })
    );
  }

  /**
   * Elimina un prodotto esistente
   * @param apiKey - La chiave API da utilizzare
   * @param productId - ID del prodotto da eliminare
   * @returns Observable che completa dopo l'eliminazione
   */
  deleteProduct(apiKey: string, productId: string): Observable<void> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Configuriamo la risposta per accettare testo semplice invece di JSON
        // Aggiungiamo anche un body vuoto come richiesto dall'API
        return this.httpClient.delete<void>(
          `${this.baseUrl}/products/${productId}`,
          {
            headers,
            body: {},
          }
        );
      }),
      catchError((error) => {
        console.error('Error deleting product:', error);
        return throwError(
          () => new Error(error.message || 'Error deleting product')
        );
      })
    );
  }

  /**
   * Crea/Aggiorna più prodotti con una singola richiesta batch
   * @param apiKey - La chiave API da utilizzare
   * @param batchParams - Parametri per il batch con prodotti da creare e aggiornare
   * @returns Observable con la risposta batch
   */
  batchProducts(
    apiKey: string,
    batchParams: BatchProductParams
  ): Observable<BatchProductsResponse> {
    // Ottieni prima il token, poi fai la chiamata API
    return this.tokenService.getToken(apiKey).pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Requested-With': '*',
          'X-Version': '1.0.0',
          Authorization: `Bearer ${token}`,
        });

        // Converti i parametri in formato JSON
        const body = JSON.stringify(batchParams);

        return this.httpClient.post<BatchProductsResponse>(
          `${this.baseUrl}/products/batch`,
          body,
          { headers }
        );
      }),
      catchError((error) => {
        console.error('Error executing batch products:', error);
        return throwError(
          () =>
            new Error(
              error.message || 'Error executing batch products operation'
            )
        );
      })
    );
  }
}
