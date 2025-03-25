import { PurchaseHistory } from './../../../../core/models/rawproduct.model';
import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  Signal,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import cosineSimilarity from 'compute-cosine-similarity';

import { ProjectStore } from '../../../../core/store/project.signal-store';
import { RawProductStore } from '../../../../core/store/rawproduct.signal-store';
import { SupplierStore } from '../../../../core/store/supplier.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import { Subject, takeUntil } from 'rxjs';

import {
  RawProduct,
  InvoiceRawProduct,
} from '../../../../core/models/rawproduct.model';
import { Supplier } from '../../../../core/models/supplier.model';

interface ExportColumn {
  title: string;
  dataKey: string;
}

interface CellStyle {
  font?: {
    bold?: boolean;
    size?: number;
    color?: { rgb: string };
  };
  fill?: {
    fgColor: { rgb: string };
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
  };
  border?: {
    bottom?: { style: string; color: { rgb: string } };
  };
  numFmt?: string;
}

@Component({
  selector: 'app-rawproducts',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    MultiSelectModule,
    FormsModule,
    ButtonModule,
    ChartModule,
    TooltipModule,
    TagModule,
    CardModule,
    BadgeModule,
    ProgressBarModule,
    DialogModule,
    ToastModule,
  ],
  templateUrl: './rawproducts.component.html',
})
export class RawproductsComponent implements OnInit, OnDestroy {
  // Dependency Injection
  private projectStore = inject(ProjectStore);
  private rawProductStore = inject(RawProductStore);
  private supplierStore = inject(SupplierStore);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  // Signal-based state
  selectedProject = this.projectStore.selectedProject;
  rawProducts = this.rawProductStore.rawProducts;
  selectedRawProduct = this.rawProductStore.selectedRawProduct;
  suppliers = this.supplierStore.suppliers;
  loading = computed(
    () => this.rawProductStore.loading() || this.supplierStore.loading()
  );
  processingEmbeddings = this.rawProductStore.processingEmbeddings;

  // Local state
  searchQuery: string = '';
  supplierFilter: any[] = [];
  filteredRawProducts: RawProduct[] = [];
  expandedRows: { [key: string]: boolean } = {};
  similarProducts: { [key: string]: RawProduct[] } = {};
  selectedRawProducts: RawProduct[] = [];
  detailsVisible: boolean = false;
  currentRawProductDetails: RawProduct | null = null;
  chartData: any = null;
  chartOptions: any = null;

  // Table columns
  cols: any[] = [
    {
      field: 'description',
      header: 'Descrizione',
      customExportHeader: 'Descrizione Prodotto',
    },
    { field: 'supplier', header: 'Fornitore' },
    { field: 'productCode', header: 'Codice' },
    { field: 'unitOfMeasure', header: 'UdM' },
    { field: 'lowestPrice', header: 'Prezzo Min.' },
    { field: 'highestPrice', header: 'Prezzo Max.' },
    { field: 'priceVariation', header: '% Variazione' },
  ];

  exportColumns: ExportColumn[] = this.cols.map((col) => ({
    title: col.header,
    dataKey: col.field,
  }));

  constructor() {
    // Monitor selected project changes
    effect(() => {
      const project = this.selectedProject();
      if (project && project.id) {
        this.loadData(project.id);
      }
    });

    // Update filtered products when raw products change
    effect(() => {
      const products = this.rawProducts();
      if (products) {
        this.applyFilters();
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
    this.rawProductStore.fetchProjectRawProducts({ projectId });
    this.supplierStore.fetchProjectSuppliers({ projectId });
  }

  refreshData(): void {
    const projectId = this.selectedProject()?.id;
    if (projectId) {
      this.loadData(projectId);
    }
  }

  applyFilters(): void {
    let filtered = [...(this.rawProducts() || [])];

    // Apply supplier filter
    if (this.supplierFilter && this.supplierFilter.length > 0) {
      filtered = filtered.filter((product) =>
        this.supplierFilter.some(
          (supplier) => supplier.id === product.supplierId
        )
      );
    }

    // Apply search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.description.toLowerCase().includes(query) ||
          product.productCode.toLowerCase().includes(query) ||
          this.getSupplierName(product).toLowerCase().includes(query)
      );
    }

    // Add computed properties
    this.filteredRawProducts = filtered.map((product) => ({
      ...product,
      supplier: this.getSupplierName(product),
      lowestPrice: this.getLowestPrice(product),
      highestPrice: this.getHighestPrice(product),
      priceVariation: this.getPriceVariation(product),
    }));
  }

  filterBySuppliers(event: any): void {
    this.supplierFilter = event.value;
    this.applyFilters();
  }

  searchRawProducts(event: any): void {
    this.searchQuery = event.target.value;
    this.applyFilters();
  }

  // Nuovo: restituisce il nome del supplier o 'N/A'
  getSupplierName(rawProduct: RawProduct): string {
    const suppliersArray = this.suppliers();
    if (!suppliersArray) return 'N/A';

    const supplier = suppliersArray.find((s) => s.id === rawProduct.supplierId);
    return supplier ? supplier.name : 'N/A';
  }

  // Restituisce il prezzo minimo da purchaseHistory
  getLowestPrice(rawProduct: RawProduct): number | string {
    if (
      rawProduct.purchaseHistory &&
      Array.isArray(rawProduct.purchaseHistory) &&
      rawProduct.purchaseHistory.length > 0
    ) {
      const prices = rawProduct.purchaseHistory.map((p) => p.unitPrice);
      return Math.min(...prices);
    }
    return '-';
  }

  // Restituisce il prezzo massimo da purchaseHistory
  getHighestPrice(rawProduct: RawProduct): number | string {
    if (
      rawProduct.purchaseHistory &&
      Array.isArray(rawProduct.purchaseHistory) &&
      rawProduct.purchaseHistory.length > 0
    ) {
      const prices = rawProduct.purchaseHistory.map((p) => p.unitPrice);
      return Math.max(...prices);
    }
    return '-';
  }

  // Calcola la percentuale di variazione tra il prezzo minimo e massimo
  getPriceVariation(rawProduct: RawProduct): number {
    if (
      !rawProduct.purchaseHistory ||
      !Array.isArray(rawProduct.purchaseHistory) ||
      rawProduct.purchaseHistory.length < 2
    ) {
      return 0; // Non abbastanza dati per calcolare la variazione
    }

    // Ordina la cronologia degli acquisti per data
    const sortedHistory = [...rawProduct.purchaseHistory].sort(
      (a, b) =>
        new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    const firstPrice = sortedHistory[0].unitPrice;
    const lastPrice = sortedHistory[sortedHistory.length - 1].unitPrice;

    if (firstPrice === 0) {
      return 0; // Evita la divisione per zero
    }

    const variation = ((lastPrice - firstPrice) / firstPrice) * 100;
    return parseFloat(variation.toFixed(2));
  }

  // Getter per mappare i supplier come opzioni per il filtro
  get supplierOptions(): any[] {
    const suppliersArray = this.suppliers() || [];
    return suppliersArray.map((s) => ({ id: s.id, name: s.name }));
  }

  // Getter per preparare i dati di export con i campi calcolati
  get exportRawProducts(): any[] {
    return this.selectedRawProducts.map((rp) => ({
      description: rp.description,
      supplier: this.getSupplierName(rp),
      unitOfMeasure: rp.unitOfMeasure,
      lowestPrice: this.getLowestPrice(rp),
      highestPrice: this.getHighestPrice(rp),
      priceVariation: this.getPriceVariation(rp),
    }));
  }

  /**
   * Genera i dati per il grafico del trend prezzo a partire dall'array di purchaseHistory del rawProduct.
   */
  generateChartData(rawProduct: RawProduct): any {
    const purchases = rawProduct.purchaseHistory;
    if (!purchases || purchases.length === 0) return null;

    // Ordina per data di acquisto
    const sorted = [...purchases].sort(
      (a, b) =>
        new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    const labels: string[] = [];
    const data: number[] = [];
    const priceVariations: number[] = []; // Array per le variazioni di prezzo
    let previousPrice: number | null = null;

    sorted.forEach((record) => {
      const purchaseDate = new Date(record.purchaseDate);
      labels.push(purchaseDate.toLocaleDateString());
      data.push(record.unitPrice);

      // Calcola la variazione di prezzo rispetto al prezzo precedente
      if (previousPrice !== null) {
        const variation =
          ((record.unitPrice - previousPrice) / previousPrice) * 100;
        priceVariations.push(variation);
      } else {
        priceVariations.push(0); // Nessuna variazione per il primo punto
      }

      previousPrice = record.unitPrice;
    });

    return {
      labels: labels,
      datasets: [
        {
          label: 'Price Trend',
          data: data,
          fill: false,
          borderColor: '#42A5F5',
          tension: 0.4,
        },
        {
          label: 'Price Variation (%)',
          data: priceVariations,
          fill: false,
          borderColor: '#FFA726',
          tension: 0.4,
          yAxisID: 'y1', // Asse Y secondario per la variazione di prezzo
        },
      ],
    };
  }

/**
 * Genera le opzioni per il grafico del trend prezzo.
 */
generateChartOptions(): any {
  const documentStyle = getComputedStyle(document.documentElement);
  const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
  const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
  const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dee2e6';

  return {
    maintainAspectRatio: false, // Importante: mantiene il grafico all'interno del contenitore
    responsive: true,          // Importante: rende il grafico responsive
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: {
            size: 11  // Riduzione dimensione testo per adattarsi a spazi piccoli
          }
        },
        position: 'top',
        align: 'start'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        ticks: { 
          color: textColorSecondary,
          maxRotation: 45,    // Ruota le etichette se necessario
          minRotation: 0,
          font: {
            size: 10          // Riduzione dimensione testo
          }
        },
        grid: { color: surfaceBorder },
      },
      y: {
        ticks: { color: textColorSecondary },
        grid: { color: surfaceBorder },
        beginAtZero: false    // Per adattare automaticamente la scala
      },
      y1: {
        position: 'right',
        ticks: { color: textColorSecondary },
        grid: { display: false },  // Rimuovi le linee della griglia duplicata
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    elements: {
      point: {
        radius: 3,            // Punti più piccoli
        hoverRadius: 5        // Punti un po' più grandi all'hover
      },
      line: {
        tension: 0.4
      }
    }
  };
}
  /**
   * Genera embeddings per i raw products.
   */
  generateEmbeddings(): void {
    const projectId = this.selectedProject()?.id;
    if (!projectId) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.rawProductStore.generateEmbeddings({ projectId });
  }

/**
 * Trova i prodotti più simili dato un embedding di OpenAI, escludendo quelli dello stesso fornitore.
 * @param embedding L'embedding di OpenAI da confrontare.
 * @param rawProduct Il raw product di riferimento.
 * @param topK Il numero di prodotti simili da restituire (default: 3).
 * @returns Un array dei top K prodotti più simili, ordinati per similarità.
 */
findSimilarProducts(
  embedding: number[],
  rawProduct: RawProduct,
  topK: number = 3
): RawProduct[] {
  const rawProductsArray = this.rawProducts();
  if (!rawProductsArray || rawProductsArray.length === 0) {
    console.warn('No raw products available to compare.');
    return [];
  }

  // Filtra i prodotti escludendo quelli dello stesso fornitore
  const otherProducts = rawProductsArray.filter(
    (rp) => rp.supplierId !== rawProduct.supplierId
  );

  if (otherProducts.length === 0) {
    console.warn('No other products available from different suppliers.');
    return [];
  }

  // Calcola la similarità coseno tra l'embedding dato e gli embedding degli altri prodotti
  const similarities = otherProducts.map((product) => {
    if (!product.additionalData?.embeddings) {
      return { product, similarity: -1 }; // Penalizza i prodotti senza embedding
    }

    try {
      // Usa il nuovo metodo di parsing
      const productEmbeddings = this.parseEmbeddings(product.additionalData.embeddings);
      
      if (!productEmbeddings) {
        return { product, similarity: -1 };
      }
      
      const similarity = cosineSimilarity(embedding, productEmbeddings);
      return { product, similarity: similarity !== null ? similarity : -1 };
    } catch (error) {
      console.error(`Error calculating similarity for product ${product.id}:`, error);
      return { product, similarity: -1 }; // Penalizza in caso di errore
    }
  });

  // Ordina i prodotti per similarità in ordine decrescente
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Restituisce i top K prodotti più simili, escludendo quelli con similarità negativa
  const topSimilarProducts = similarities
    .filter(item => item.similarity > 0)
    .slice(0, topK)
    .map((item) => item.product);

  return topSimilarProducts;
}

  /**
   * Calcola il prezzo medio di un raw product.
   * @param rawProduct Il raw product di cui calcolare il prezzo medio.
   * @returns Il prezzo medio del raw product, o 0 se non ci sono dati.
   */
  getAveragePrice(rawProduct: RawProduct): number {
    if (
      !rawProduct.purchaseHistory ||
      !Array.isArray(rawProduct.purchaseHistory) ||
      rawProduct.purchaseHistory.length === 0
    ) {
      return 0;
    }

    const total = rawProduct.purchaseHistory.reduce(
      (sum: number, purchase: any) => sum + purchase.unitPrice,
      0
    );
    return total / rawProduct.purchaseHistory.length;
  }

// Metodo per gestire l'espansione delle righe
onRowExpand(event: any) {
  // Log per debugging
  console.log('Row expanded:', event.data.id);

  const product = event.data;
  // Verifica che product abbia un id
  if (!product || !product.id) {
    console.error('Product or product ID missing in expansion event');
    return;
  }

  // Trova i prodotti simili solo se non li abbiamo già caricati
  if (!this.similarProducts[product.id]) {
    try {
      // Inizializza sempre con un array vuoto
      this.similarProducts[product.id] = [];
      
      // Verifica la presenza di embeddings
      if (product.additionalData?.embeddings) {
        // Parsare gli embeddings in modo sicuro
        const embeddings = this.parseEmbeddings(product.additionalData.embeddings);
        
        if (!embeddings) {
          console.warn(`No valid embeddings found for product ${product.id}`);
          return;
        }
        
        // Carica i dati effettivi dopo un breve ritardo per migliorare UX
        setTimeout(() => {
          try {
            const similarProducts = this.findSimilarProducts(
              embeddings,
              product,
              5
            );
            this.similarProducts[product.id] = similarProducts;
            console.log('Similar products found:', this.similarProducts[product.id]);
          } catch (error) {
            console.error('Error finding similar products:', error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error processing row expansion:', error);
    }
  }
}
  /**
   * Mostra i dettagli di un prodotto grezzo in un dialog.
   * @param product Il prodotto di cui visualizzare i dettagli
   */
  showDetails(product: RawProduct) {
    this.currentRawProductDetails = product;
    this.chartData = this.generateChartData(product);
    this.chartOptions = this.generateChartOptions();
    this.detailsVisible = true;
  }

  /**
   * Chiude il dialog dei dettagli.
   */
  closeDetails() {
    this.detailsVisible = false;
    this.currentRawProductDetails = null;
    this.chartData = null;
  }

  /**
   * Restituisce un'etichetta appropriata per lo stato degli embeddings di un prodotto grezzo.
   */
  getEmbeddingStatus(product: RawProduct): {
    label: string;
    severity: 'success' | 'warn' | 'danger';
  } {
    if (!product.additionalData) {
      return { label: 'No Data', severity: 'danger' };
    }

    if (product.additionalData.embeddings) {
      return { label: 'Embeddings Elaborati', severity: 'success' };
    }

    return { label: 'Embeddings Assenti', severity: 'warn' };
  }
  // Modifica il metodo toggleRowExpansion
  toggleRowExpansion(expanded: boolean, product: any): void {
    console.log('Toggle row expansion:', { expanded, productId: product.id });

    if (expanded) {
      // Se già espanso, rimuovi dall'oggetto per collassare la riga
      delete this.expandedRows[product.id];
    } else {
      // Se non espanso, aggiungilo per espandere la riga
      this.expandedRows[product.id] = true;

      // Recupera i prodotti simili solo se abbiamo gli embedding
      if (product.additionalData?.embeddings) {
        this.onRowExpand({ data: product });
      }
    }

    // Importante: crea un nuovo oggetto per forzare il rilevamento dei cambiamenti
    this.expandedRows = { ...this.expandedRows };
    console.log('Expanded rows after update:', this.expandedRows);
  }

  // 3. Metodo per il debug
  logRowState(productId: string): void {
    console.log(
      `Row ${productId} expanded state:`,
      !!this.expandedRows[productId]
    );
  }
  // Aggiungi un metodo per verificare lo stato
  isRowExpanded(productId: string): boolean {
    return !!this.expandedRows[productId];
  }

  /**
   * Genera i dati per il grafico dell'andamento prezzi
   */
  generatePriceChartData(product: RawProduct): any {
    if (!product.purchaseHistory || product.purchaseHistory.length < 2) {
      return null;
    }

    // Ordina la cronologia per data
    const sortedHistory = [...product.purchaseHistory].sort(
      (a, b) =>
        new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    // Prepara i dati
    const labels = sortedHistory.map((p) =>
      new Date(p.purchaseDate).toLocaleDateString()
    );
    const prices = sortedHistory.map((p) => p.unitPrice);

    // Calcola le variazioni percentuali
    const variations: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prevPrice = prices[i - 1];
      const currentPrice = prices[i];
      const variation =
        prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
      variations.push(parseFloat(variation.toFixed(1)));
    }
    variations.unshift(0); // Prima variazione è 0

    return {
      labels,
      datasets: [
        {
          label: 'Prezzo unitario',
          data: prices,
          borderColor: '#2196F3',
          tension: 0.4,
          fill: false,
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Variazione %',
          data: variations,
          borderColor: '#FF9800',
          tension: 0.4,
          fill: false,
          backgroundColor: 'rgba(255, 152, 0, 0.2)',
          yAxisID: 'y1',
        },
      ],
    };
  }

  /**
   * Calcola la quantità totale acquistata
   */
  getTotalQuantity(product: RawProduct): number {
    if (!product.purchaseHistory || product.purchaseHistory.length === 0) {
      return 0;
    }
    return product.purchaseHistory.reduce((sum, p) => sum + p.quantity, 0);
  }

  /**
   * Ottiene la data dell'ultimo acquisto formattata
   */
  getLastPurchaseDate(product: RawProduct): string {
    if (!product.purchaseHistory || product.purchaseHistory.length === 0) {
      return 'N/A';
    }

    const sortedHistory = [...product.purchaseHistory].sort(
      (a, b) =>
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
    );

    return new Date(sortedHistory[0].purchaseDate).toLocaleDateString();
  }

  /**
   * Ottiene l'ultimo acquisto
   */
  getLastPurchase(product: RawProduct): PurchaseHistory | null {
    if (!product.purchaseHistory || product.purchaseHistory.length === 0) {
      return null;
    }

    const sortedHistory = [...product.purchaseHistory].sort(
      (a, b) =>
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
    );

    return sortedHistory[0];
  }
  /**
   * Calcola il potenziale risparmio confrontando il prodotto con i simili
   * @param product Il prodotto di riferimento
   * @param similarProducts Array di prodotti simili
   * @returns Un oggetto con l'importo e la percentuale di potenziale risparmio
   */
  getSavingsPotential(
    product: RawProduct,
    similarProducts: RawProduct[]
  ): { amount: number; percentage: number } {
    if (!similarProducts || similarProducts.length === 0) {
      return { amount: 0, percentage: 0 };
    }

    const currentAvgPrice = this.getAveragePrice(product);
    if (currentAvgPrice <= 0) {
      return { amount: 0, percentage: 0 };
    }

    // Trova il prodotto simile con il prezzo medio più basso
    const lowestPriceProduct = similarProducts.reduce((lowest, current) => {
      const currentPrice = this.getAveragePrice(current);
      const lowestPrice = lowest
        ? this.getAveragePrice(lowest)
        : Number.MAX_VALUE;
      return currentPrice < lowestPrice ? current : lowest;
    }, null as RawProduct | null);

    if (!lowestPriceProduct) {
      return { amount: 0, percentage: 0 };
    }

    const lowestAvgPrice = this.getAveragePrice(lowestPriceProduct);

    // Se il prodotto simile è più costoso, non c'è risparmio
    if (lowestAvgPrice >= currentAvgPrice) {
      return { amount: 0, percentage: 0 };
    }

    const savingsAmount = currentAvgPrice - lowestAvgPrice;
    const savingsPercentage = (savingsAmount / currentAvgPrice) * 100;

    return {
      amount: savingsAmount,
      percentage: savingsPercentage,
    };
  }
  /**
   * Restituisce la data corrente formattata per il nome del file
   */
  getCurrentDate(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }

  /**
   * Esporta i prodotti selezionati in un file Excel formattato in modo professionale
   */
  exportToExcel(): void {
    if (this.selectedRawProducts.length === 0) {
      this.toastService.showWarn('Seleziona almeno un prodotto da esportare');
      return;
    }

    try {
      // Preparazione dei dati per l'export
      const exportData = this.selectedRawProducts.map((product) => ({
        Descrizione: product.description,
        Fornitore: this.getSupplierName(product),
        Codice: product.productCode,
        'Unità di Misura': product.unitOfMeasure,
        'Prezzo Minimo':
          typeof this.getLowestPrice(product) === 'number'
            ? this.getLowestPrice(product)
            : '',
        'Prezzo Massimo':
          typeof this.getHighestPrice(product) === 'number'
            ? this.getHighestPrice(product)
            : '',
        'Prezzo Medio': this.getAveragePrice(product),
        'Variazione %': this.getPriceVariation(product),
        'Quantità Totale': this.getTotalQuantity(product),
        'Ultimo Acquisto': this.getLastPurchaseDate(product),
        'IVA %': product.vatRate,
      }));

      import('xlsx').then((xlsx) => {
        // Crea un nuovo foglio di lavoro
        const worksheet = xlsx.utils.aoa_to_sheet([]);

        // Aggiungi titolo del report
        xlsx.utils.sheet_add_aoa(
          worksheet,
          [
            [
              `Report Prodotti Grezzi - ${new Date().toLocaleDateString(
                'it-IT'
              )}`,
            ],
          ],
          { origin: 'A1' }
        );

        // Aggiungi sottotitolo con numero di prodotti
        xlsx.utils.sheet_add_aoa(
          worksheet,
          [[`Esportazione di ${exportData.length} prodotti`]],
          { origin: 'A2' }
        );

        // Aggiungi intestazioni della tabella
        const headers = Object.keys(exportData[0]);
        xlsx.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A4' });

        // Aggiungi dati della tabella
        xlsx.utils.sheet_add_json(worksheet, exportData, {
          origin: 'A5',
          skipHeader: true,
        });

        // Imposta larghezza colonne
        const columnWidths = [
          { wch: 40 }, // Descrizione
          { wch: 25 }, // Fornitore
          { wch: 15 }, // Codice
          { wch: 15 }, // UdM
          { wch: 15 }, // Prezzo Min
          { wch: 15 }, // Prezzo Max
          { wch: 15 }, // Prezzo Medio
          { wch: 15 }, // Variazione %
          { wch: 15 }, // Quantità Tot
          { wch: 15 }, // Ultimo Acquisto
          { wch: 10 }, // IVA %
        ];
        worksheet['!cols'] = columnWidths;

        // Definizione stili
        const styles = {
          title: {
            font: { bold: true, size: 16, color: { rgb: '2F75B5' } },
            fill: { fgColor: { rgb: 'E9EFF7' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: '4472C4' } } },
          },
          subtitle: {
            font: { bold: true, size: 12, color: { rgb: '44546A' } },
            alignment: { horizontal: 'left', vertical: 'center' },
          },
          header: {
            font: { bold: true, size: 12, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: '8EAADB' } } },
          },
          cell: {
            alignment: { vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'D9D9D9' } } },
          },
          price: {
            numFmt: '€ #,##0.00',
            alignment: { horizontal: 'right', vertical: 'center' },
          },
          percentage: {
            numFmt: '0.00%',
            alignment: { horizontal: 'right', vertical: 'center' },
          },
        };

        // Applica stili alle celle
        const workbook = xlsx.utils.book_new();

        // Stile titolo
        worksheet['A1'] = {
          v: `Report Prodotti Grezzi - ${new Date().toLocaleDateString(
            'it-IT'
          )}`,
          t: 's',
          s: styles.title,
        };
        worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }]; // Merge title across columns

        // Stile sottotitolo
        worksheet['A2'] = {
          v: `Esportazione di ${exportData.length} prodotti`,
          t: 's',
          s: styles.subtitle,
        };
        worksheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }); // Merge subtitle

        // Stili intestazioni
        for (let i = 0; i < headers.length; i++) {
          const cellRef = xlsx.utils.encode_cell({ r: 3, c: i });
          worksheet[cellRef] = {
            v: headers[i],
            t: 's',
            s: styles.header,
          };
        }

        // Stili dati
        for (let r = 0; r < exportData.length; r++) {
          for (let c = 0; c < headers.length; c++) {
            const cellRef = xlsx.utils.encode_cell({ r: r + 4, c: c });
            const header = headers[c];
            let cellStyle: CellStyle = { ...styles.cell }; // Usa l'interfaccia qui

            // Applica stili specifici in base al tipo di dato
            if (
              ['Prezzo Minimo', 'Prezzo Massimo', 'Prezzo Medio'].includes(
                header
              )
            ) {
              cellStyle = { ...styles.cell, ...styles.price };
            } else if (header === 'Variazione %') {
              cellStyle = { ...styles.cell, ...styles.percentage };
              // Colora la variazione in verde o rosso in base al valore
              const value = exportData[r][header];
              if (value > 0) {
                cellStyle.font = { color: { rgb: '008000' } }; // Verde
              } else if (value < 0) {
                cellStyle.font = { color: { rgb: 'FF0000' } }; // Rosso
              }
            }

            // Applica stile alternato per righe
            if (r % 2 !== 0) {
              cellStyle.fill = { fgColor: { rgb: 'F2F2F2' } }; // Grigio chiaro
            }

            if (worksheet[cellRef]) {
              worksheet[cellRef].s = cellStyle;
            }
          }
        }

        // Aggiungi foglio al workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Prodotti');

        // Genera file
        const excelBuffer = xlsx.write(workbook, {
          bookType: 'xlsx',
          type: 'array',
        });
        this.saveAsExcelFile(excelBuffer, 'RawProducts');

        this.toastService.showSuccess(
          `${exportData.length} prodotti esportati con successo`
        );
      });
    } catch (error) {
      console.error("Errore durante l'esportazione:", error);
      this.toastService.showError("Errore durante l'esportazione in Excel");
    }
  }

  /**
   * Salva i dati come file Excel
   * @param buffer I dati da salvare
   * @param fileName Il nome del file
   */
  private saveAsExcelFile(buffer: any, fileName: string): void {
    import('file-saver').then((FileSaver) => {
      const EXCEL_TYPE =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
      const EXCEL_EXTENSION = '.xlsx';

      const data: Blob = new Blob([buffer], { type: EXCEL_TYPE });

      // Crea un nome file con data e ora
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      const fullFileName = `${fileName}_${dateStr}${EXCEL_EXTENSION}`;

      FileSaver.saveAs(data, fullFileName);
    });
  }
  /**
 * Analizza in modo sicuro gli embeddings, gestendo diversi formati possibili
 * @param embeddings Gli embeddings da parsare (stringa o oggetto)
 * @returns Array di numeri con gli embeddings o null in caso di errore
 */
private parseEmbeddings(embeddings: any): number[] | null {
  try {
    // Se è già un array, restituiscilo
    if (Array.isArray(embeddings)) {
      return embeddings;
    }
    
    // Se è una stringa, prova a parsarla come JSON
    if (typeof embeddings === 'string') {
      // Rimuovi eventuali caratteri non validi all'inizio o alla fine
      let cleanedStr = embeddings.trim();

      // Rimuovi i caratteri di controllo che potrebbero causare errori
      cleanedStr = cleanedStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      // Se sembra un array JSON diretto
      if (cleanedStr.startsWith('[') && cleanedStr.endsWith(']')) {
        try {
          return JSON.parse(cleanedStr);
        } catch (e) {
          console.warn('Fallito parsing diretto dell\'array', e);
        }
      }
      
      // Prova a vedere se è un oggetto JSON che contiene l'array
      try {
        const parsed = JSON.parse(cleanedStr);
        
        // Se l'oggetto parsato è già un array
        if (Array.isArray(parsed)) {
          return parsed;
        }
        
        // Prova a trovare un campo che contiene un array
        for (const key in parsed) {
          if (Array.isArray(parsed[key])) {
            return parsed[key];
          }
        }
      } catch (e) {
        console.warn('Fallito parsing come oggetto', e);
      }
    }
    
    // Se embeddings è un oggetto, prova a trovare un campo array
    if (typeof embeddings === 'object' && embeddings !== null) {
      for (const key in embeddings) {
        if (Array.isArray(embeddings[key])) {
          return embeddings[key];
        }
      }
    }
    
    console.error('Formato embeddings non riconosciuto:', embeddings);
    return null;
  } catch (error) {
    console.error('Errore durante il parsing degli embeddings:', error);
    return null;
  }
}
}
