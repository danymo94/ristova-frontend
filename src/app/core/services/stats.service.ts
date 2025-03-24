import { Injectable, inject } from '@angular/core';
import { Order, OrderItem } from '../models/order.model';
import { Product } from '../models/product.model';
import { Table } from '../models/table.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { OrderStore } from '../store/order.signal-store';
import { ProductStore } from '../store/product.signal-store';
import { TableStore } from '../store/table.signal-store';

export interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
  tableOrders: number;
  preOrders: number;
}

export interface ProductStats {
  topSellingProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  leastSellingProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalProductsSold: number;
  categoriesDistribution: Array<{
    categoryId: string;
    name: string;
    count: number;
  }>;
}

export interface TableStats {
  totalTables: number;
  tablesWithOrders: number;
  averageOrdersPerTable: number;
  topTables: Array<{
    tableId: string;
    name: string;
    orders: number;
    revenue: number;
  }>;
}

export interface TimeStats {
  dailyRevenue: Array<{ date: string; revenue: number }>;
  hourlyDistribution: Array<{ hour: number; orders: number }>;
  weekdayDistribution: Array<{ day: string; orders: number }>;
}

export interface DashboardStats {
  orderStats: OrderStats;
  productStats: ProductStats;
  tableStats: TableStats;
  timeStats: TimeStats;
  isLoading: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private orderStore = inject(OrderStore);
  private productStore = inject(ProductStore);
  private tableStore = inject(TableStore);

  private _stats = new BehaviorSubject<DashboardStats | null>(null);
  public stats$: Observable<DashboardStats | null> = this._stats.asObservable();

  // Parametri per filtraggio delle statistiche
  private dateRange: { start?: Date; end?: Date } = {};

  constructor() {}

  /**
   * Imposta il range di date per il filtraggio delle statistiche
   */
  setDateRange(startDate?: Date, endDate?: Date): void {
    this.dateRange = { start: startDate, end: endDate };
    // Ricalcola le statistiche con il nuovo range
    this.calculateStats();
  }

  /**
   * Calcola le statistiche basate sui dati disponibili negli store
   */
  calculateStats(): void {
    // Notifica che stiamo caricando
    this._stats.next({ ...this.getEmptyStats(), isLoading: true });

    // Recupera i dati necessari
    const orders = this.orderStore.partnerOrders();
    const products = this.productStore.products();
    const tables = this.tableStore.tables();

    console.log('Calcolo statistiche con:', {
      ordini: orders?.length || 0,
      prodotti: products?.length || 0,
      tavoli: tables?.length || 0,
    });

    // Se non ci sono ordini, mostriamo comunque statistiche vuote senza errori
    if (!orders || orders.length === 0) {
      console.log('Nessun ordine trovato, mostro stats vuote');
      this._stats.next({ ...this.getEmptyStats(), isLoading: false });
      return;
    }

    // Filtra gli ordini per data se necessario
    const filteredOrders = this.filterOrdersByDate(orders);

    // Calcola statistiche per ordini
    const orderStats = this.calculateOrderStats(filteredOrders);

    // Calcola statistiche per prodotti
    const productStats = this.calculateProductStats(
      filteredOrders,
      products || []
    );

    // Calcola statistiche per tavoli
    const tableStats = this.calculateTableStats(filteredOrders, tables || []);

    // Calcola statistiche temporali
    const timeStats = this.calculateTimeStats(filteredOrders);

    // Aggiorna lo stato con le nuove statistiche
    this._stats.next({
      orderStats,
      productStats,
      tableStats,
      timeStats,
      isLoading: false,
    });
  }

  /**
   * Filtra gli ordini per data
   */
  private filterOrdersByDate(orders: Order[]): Order[] {
    if (!this.dateRange.start && !this.dateRange.end) {
      return orders;
    }

    return orders.filter((order) => {
      const orderDate = order.createdAt ? new Date(order.createdAt) : null;

      if (!orderDate) return true;

      let isAfterStart = true;
      let isBeforeEnd = true;

      if (this.dateRange.start) {
        isAfterStart = orderDate >= this.dateRange.start;
      }

      if (this.dateRange.end) {
        isBeforeEnd = orderDate <= this.dateRange.end;
      }

      return isAfterStart && isBeforeEnd;
    });
  }

  /**
   * Calcola statistiche sugli ordini
   */
  private calculateOrderStats(orders: Order[]): OrderStats {
    const stats: OrderStats = {
      totalOrders: orders.length,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0,
      totalRevenue: 0,
      tableOrders: 0,
      preOrders: 0,
    };

    // Calcola le statistiche di base
    orders.forEach((order) => {
      // Conteggio per stato
      if (order.status === 'completed') stats.completedOrders++;
      else if (order.status === 'cancelled') stats.cancelledOrders++;
      else if (['pending', 'confirmed', 'processing'].includes(order.status))
        stats.pendingOrders++;

      // Conteggio per tipo
      if (order.type === 'table') stats.tableOrders++;
      else if (order.type === 'preorder') stats.preOrders++;

      // Calcolo fatturato
      stats.totalRevenue += order.total;
    });

    // Calcola il valore medio dell'ordine
    if (stats.totalOrders > 0) {
      stats.averageOrderValue = stats.totalRevenue / stats.totalOrders;
    }

    return stats;
  }

  /**
   * Calcola statistiche sui prodotti venduti
   */
  private calculateProductStats(
    orders: Order[],
    products: Product[]
  ): ProductStats {
    // Mappa per tracciare le vendite per prodotto
    const productSales: Map<
      string,
      { name: string; quantity: number; revenue: number }
    > = new Map();
    let totalProductsSold = 0;

    // Mappa per i nomi delle categorie
    const categoryMap = new Map<string, string>();
    const categoryCounts = new Map<string, number>();

    // Estrai le categorie dai prodotti
    products.forEach((product) => {
      if (product.categoryId) {
        // Usa l'ID della categoria per mappare alle statistiche
        // Idealmente dovremmo avere i nomi delle categorie, ma qui usiamo solo l'ID
        categoryMap.set(product.categoryId, product.categoryId);
        categoryCounts.set(
          product.categoryId,
          (categoryCounts.get(product.categoryId) || 0) + 1
        );
      }
    });

    // Analizza gli elementi degli ordini
    orders.forEach((order) => {
      order.items.forEach((item) => {
        totalProductsSold += item.quantity;

        // Aggiorna o crea statistiche per questo prodotto
        const currentStats = productSales.get(item.productId) || {
          name: item.name,
          quantity: 0,
          revenue: 0,
        };

        currentStats.quantity += item.quantity;
        currentStats.revenue += item.price * item.quantity;

        productSales.set(item.productId, currentStats);
      });
    });

    // Converti la mappa in array per ordinamento
    const productStatsArray = Array.from(productSales.entries()).map(
      ([id, stats]) => ({
        productId: id,
        name: stats.name,
        quantity: stats.quantity,
        revenue: stats.revenue,
      })
    );

    // Ordina per quantità venduta
    const sortedByQuantity = [...productStatsArray].sort(
      (a, b) => b.quantity - a.quantity
    );

    // Prepara le statistiche di distribuzione per categoria
    const categoriesDistribution = Array.from(categoryCounts.entries()).map(
      ([id, count]) => ({
        categoryId: id,
        name: categoryMap.get(id) || id,
        count,
      })
    );

    return {
      topSellingProducts: sortedByQuantity.slice(0, 5),
      leastSellingProducts: sortedByQuantity.slice(-5).reverse(),
      totalProductsSold,
      categoriesDistribution,
    };
  }

  /**
   * Calcola statistiche sui tavoli
   */
  private calculateTableStats(orders: Order[], tables: Table[]): TableStats {
    const tableOrdersMap = new Map<
      string,
      { orders: number; revenue: number }
    >();

    // Inizializza la mappa con tutti i tavoli
    tables.forEach((table) => {
      if (table.id) {
        tableOrdersMap.set(table.id, { orders: 0, revenue: 0 });
      }
    });

    // Analizza gli ordini per trovare quelli da tavolo
    const tableOrders = orders.filter(
      (order) => order.type === 'table' && order.tableId
    );

    tableOrders.forEach((order) => {
      if (order.tableId) {
        // Aggiorna le statistiche per questo tavolo
        const current = tableOrdersMap.get(order.tableId) || {
          orders: 0,
          revenue: 0,
        };
        current.orders += 1;
        current.revenue += order.total;

        tableOrdersMap.set(order.tableId, current);
      }
    });

    // Conta tavoli che hanno avuto ordini
    let tablesWithOrders = 0;
    tableOrdersMap.forEach((stats) => {
      if (stats.orders > 0) tablesWithOrders++;
    });

    // Calcola media ordini per tavolo
    const averageOrdersPerTable = tableOrders.length / (tables.length || 1);

    // Trova i tavoli più attivi
    const tableStatsArray = Array.from(tableOrdersMap.entries()).map(
      ([tableId, stats]) => {
        // Trova il nome del tavolo
        const table = tables.find((t) => t.id === tableId);
        return {
          tableId,
          name: table?.name || `Tavolo ${tableId.substring(0, 4)}`,
          orders: stats.orders,
          revenue: stats.revenue,
        };
      }
    );

    // Ordina per numero di ordini
    const sortedByOrders = [...tableStatsArray].sort(
      (a, b) => b.orders - a.orders
    );

    return {
      totalTables: tables.length,
      tablesWithOrders,
      averageOrdersPerTable,
      topTables: sortedByOrders.slice(0, 5),
    };
  }

  /**
   * Calcola statistiche temporali
   */
  private calculateTimeStats(orders: Order[]): TimeStats {
    // Mappa per raggruppare ordini per data
    const dailyRevenue = new Map<string, number>();
    const hourlyOrders = new Map<number, number>();
    const weekdayOrders = new Map<number, number>();

    // Inizializza i contatori
    for (let i = 0; i < 24; i++) {
      hourlyOrders.set(i, 0);
    }

    for (let i = 0; i < 7; i++) {
      weekdayOrders.set(i, 0);
    }

    // Analizza gli ordini
    orders.forEach((order) => {
      if (order.createdAt) {
        const date = new Date(order.createdAt);

        // Formato data YYYY-MM-DD
        const dateKey = date.toISOString().split('T')[0];

        // Aggiorna fatturato giornaliero
        const currentRevenue = dailyRevenue.get(dateKey) || 0;
        dailyRevenue.set(dateKey, currentRevenue + order.total);

        // Aggiorna distribuzione oraria
        const hour = date.getHours();
        hourlyOrders.set(hour, (hourlyOrders.get(hour) || 0) + 1);

        // Aggiorna distribuzione settimanale
        const weekday = date.getDay();
        weekdayOrders.set(weekday, (weekdayOrders.get(weekday) || 0) + 1);
      }
    });

    // Converti mappe in array per il frontend
    const dailyRevenueArray = Array.from(dailyRevenue.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const hourlyDistribution = Array.from(hourlyOrders.entries())
      .map(([hour, orders]) => ({ hour, orders }))
      .sort((a, b) => a.hour - b.hour);

    const dayNames = [
      'Domenica',
      'Lunedì',
      'Martedì',
      'Mercoledì',
      'Giovedì',
      'Venerdì',
      'Sabato',
    ];
    const weekdayDistribution = Array.from(weekdayOrders.entries())
      .map(([day, orders]) => ({ day: dayNames[day], orders }))
      .sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));

    return {
      dailyRevenue: dailyRevenueArray,
      hourlyDistribution,
      weekdayDistribution,
    };
  }

  /**
   * Crea un oggetto di statistiche vuoto
   */
  private getEmptyStats(): DashboardStats {
    return {
      orderStats: {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        tableOrders: 0,
        preOrders: 0,
      },
      productStats: {
        topSellingProducts: [],
        leastSellingProducts: [],
        totalProductsSold: 0,
        categoriesDistribution: [],
      },
      tableStats: {
        totalTables: 0,
        tablesWithOrders: 0,
        averageOrdersPerTable: 0,
        topTables: [],
      },
      timeStats: {
        dailyRevenue: [],
        hourlyDistribution: [],
        weekdayDistribution: [],
      },
      isLoading: false,
    };
  }
}
