import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';

import { Warehouse } from '../../../../../core/models/warehouse.model';
import {
  WarehouseBalance,
  WarehouseBalanceItem,
} from '../../../../../core/models/warehouse.model';
import { RawProduct } from '../../../../../core/models/rawproduct.model';
import { RawProductStore } from '../../../../../core/store/rawproduct.signal-store';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CardModule,
    InputTextModule,
    ButtonModule,
    DropdownModule,
    DialogModule,
    SkeletonModule,
    ProgressBarModule,
    ChartModule,
    TooltipModule,
  ],
  templateUrl: './warehouse-inventory.component.html',
})
export class WarehouseInventoryComponent {
  @Input() warehouse: Warehouse | null = null;
  @Input() warehouseBalance: WarehouseBalance | null = null;
  @Input() loading = false;

  private rawProductStore = inject(RawProductStore);

  // Stato interno
  searchTerm = '';
  sortField = 'currentQuantity';
  sortOrder = -1; // -1 descending, 1 ascending
  filteredItems: WarehouseBalanceItem[] = [];

  // Raggruppamento
  groupByCategory = false;
  itemsByCategory: Map<string, WarehouseBalanceItem[]> = new Map();

  // Dettagli prodotto
  selectedProduct: RawProduct | null = null;
  showProductDetailsDialog = false;

  // Chart data
  chartData: any;
  chartOptions: any;

  ngOnInit() {
    this.initChartData();
  }

  ngOnChanges() {
    this.filterItems();
    this.groupItemsByCategory();
    this.updateChartData();
  }

  filterItems() {
    if (!this.warehouseBalance?.items) {
      this.filteredItems = [];
      return;
    }

    let items = [...this.warehouseBalance.items];

    // Apply search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      items = items.filter((item) => {
        const productName = this.getProductName(item.rawProductId);
        return productName.toLowerCase().includes(search);
      });
    }

    // Apply sorting
    items.sort((a, b) => {
      if (this.sortField === 'productName') {
        const nameA = this.getProductName(a.rawProductId).toLowerCase();
        const nameB = this.getProductName(b.rawProductId).toLowerCase();
        return nameA.localeCompare(nameB) * this.sortOrder;
      }
      return (a[this.sortField as keyof WarehouseBalanceItem] as number) >
        (b[this.sortField as keyof WarehouseBalanceItem] as number)
        ? this.sortOrder
        : -this.sortOrder;
    });

    this.filteredItems = items;
  }

  groupItemsByCategory() {
    if (!this.filteredItems.length) {
      this.itemsByCategory = new Map();
      return;
    }

    const map = new Map<string, WarehouseBalanceItem[]>();
    const rawProducts = this.rawProductStore.rawProducts();

    this.filteredItems.forEach((item) => {
      const product = rawProducts?.find((p) => p.id === item.rawProductId);
      const category = product?.additionalData?.category || 'Non categorizzato';

      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(item);
    });

    this.itemsByCategory = map;
  }

  getProductName(rawProductId: string): string {
    const rawProducts = this.rawProductStore.rawProducts();
    const product = rawProducts?.find((p) => p.id === rawProductId);
    return product?.description || `Prodotto (${rawProductId.substring(0, 8)})`;
  }

  getProductCategory(rawProductId: string): string {
    const rawProducts = this.rawProductStore.rawProducts();
    const product = rawProducts?.find((p) => p.id === rawProductId);
    return product?.additionalData?.category || 'Non categorizzato';
  }

  onSort(event: any) {
    this.sortField = event.field;
    this.sortOrder = event.order;
    this.filterItems();
  }

  toggleGroupByCategory() {
    this.groupByCategory = !this.groupByCategory;
    if (this.groupByCategory) {
      this.groupItemsByCategory();
    }
  }

  viewProductDetails(rawProductId: string) {
    const rawProducts = this.rawProductStore.rawProducts();
    this.selectedProduct =
      rawProducts?.find((p) => p.id === rawProductId) || null;
    if (this.selectedProduct) {
      this.showProductDetailsDialog = true;
    }
  }

  closeProductDetailsDialog() {
    this.showProductDetailsDialog = false;
    this.selectedProduct = null;
  }

  // Initialize chart data
  initChartData() {
    this.chartOptions = {
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return `${context.label}: ${context.raw.toFixed(2)} €`;
            },
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    };

    this.updateChartData();
  }

  // Update chart data based on warehouse balance
  updateChartData() {
    if (
      !this.warehouseBalance?.items ||
      this.warehouseBalance.items.length === 0
    ) {
      this.chartData = {
        labels: ['Nessun dato'],
        datasets: [
          {
            data: [100],
            backgroundColor: ['#ccc'],
          },
        ],
      };
      return;
    }

    // Raggruppa per categoria e calcola il valore totale per ogni categoria
    const categoryTotals = new Map<string, number>();
    const rawProducts = this.rawProductStore.rawProducts();

    this.warehouseBalance.items.forEach((item) => {
      const product = rawProducts?.find((p) => p.id === item.rawProductId);
      const category = product?.additionalData?.category || 'Non categorizzato';

      const currentTotal = categoryTotals.get(category) || 0;
      categoryTotals.set(category, currentTotal + item.totalValue);
    });

    // Prendi le top 6 categorie per valore e raggruppa il resto in "Altro"
    const sortedCategories = [...categoryTotals.entries()].sort(
      (a, b) => b[1] - a[1]
    );

    const topCategories = sortedCategories.slice(0, 6);
    const otherCategories = sortedCategories.slice(6);

    const totalValueOthers = otherCategories.reduce(
      (sum, cat) => sum + cat[1],
      0
    );
    if (totalValueOthers > 0) {
      topCategories.push(['Altro', totalValueOthers]);
    }

    // Crea i dati per il grafico
    const labels = topCategories.map((cat) => cat[0]);
    const data = topCategories.map((cat) => cat[1]);
    const backgroundColors = [
      '#42A5F5',
      '#66BB6A',
      '#FFA726',
      '#26C6DA',
      '#7E57C2',
      '#EC407A',
      '#78909C',
    ];

    this.chartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors.slice(0, data.length),
        },
      ],
    };
  }
}
