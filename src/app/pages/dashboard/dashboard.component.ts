import { Component, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ProjectStore } from '../../core/store/project.signal-store';
import { OrderStore } from '../../core/store/order.signal-store';
import { ProductStore } from '../../core/store/product.signal-store';
import { TableStore } from '../../core/store/table.signal-store';
import {
  StatsService,
  DashboardStats,
} from '../../core/services/stats.service';
import { StatsCardComponent } from '../../components/dashboard/stats-card.component';
import { ChartCardComponent } from '../../components/dashboard/chart-card.component';
import {
  DataTableComponent,
  DataTableColumn,
} from '../../components/dashboard/data-table.component';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of} from 'rxjs';

@Component({
  selector: 'dashboard-component',
  standalone: true,
  imports: [
    CommonModule,
    StatsCardComponent,
    ChartCardComponent,
    DataTableComponent,
    CalendarModule,
    ButtonModule,
    FormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styles: [
    `
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }

      .chart-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
        gap: 1.5rem;
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }

      .empty-state {
        text-align: center;
        padding: 40px;
        color: #666;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private projectStore = inject(ProjectStore);
  private orderStore = inject(OrderStore);
  private productStore = inject(ProductStore);
  private tableStore = inject(TableStore);
  private statsService = inject(StatsService);

  // Utilizziamo il segnale del progetto selezionato
  selectedProject = this.projectStore.selectedProject;

  // Statistiche della dashboard
  stats: DashboardStats | null = null;

  // Range di date per il filtro
  dateRange: Date[] = [];

  // Stato di caricamento
  loading = false;

  // Per la pulizia delle sottoscrizioni
  private destroy$ = new Subject<void>();

  // Helper per grafici e tabelle
  dailyRevenueLabels: string[] = [];
  dailyRevenueData: number[] = [];

  hourlyLabels: string[] = [];
  hourlyData: number[] = [];

  weekdayLabels: string[] = [];
  weekdayData: number[] = [];

  orderTypeLabels: string[] = [
    'Da Tavolo',
    'Preordini',
    'Completati',
    'In Attesa',
    'Cancellati',
  ];
  orderTypeData: number[] = [];
  orderTypeColors: string[] = [
    '#2196F3',
    '#FF9800',
    '#4CAF50',
    '#FFC107',
    '#F44336',
  ];

  // Definizione corretta delle colonne con tipi espliciti
  topProductsColumns: DataTableColumn[] = [
    { field: 'name', header: 'Prodotto' },
    { field: 'quantity', header: 'Quantità', type: 'number' },
    { field: 'revenue', header: 'Ricavo', type: 'currency' },
  ];

  topTablesColumns: DataTableColumn[] = [
    { field: 'name', header: 'Tavolo' },
    { field: 'orders', header: 'Ordini', type: 'number' },
    { field: 'revenue', header: 'Ricavo', type: 'currency' },
  ];

  constructor() {
    // Osserviamo i cambiamenti negli ordini utilizzando effect nel constructor
    effect(() => {
      const orders = this.orderStore.partnerOrders();
      console.log('Ordini aggiornati:', orders?.length || 0);
    });
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        console.log('Progetto selezionato cambiato:', project.name);
        // Usiamo setTimeout per evitare chiamate durante l'inizializzazione del componente
        setTimeout(() => this.loadDataForCurrentProject(), 0);
      }
    });
  }

  ngOnInit(): void {
    // Sottoscrizione alle statistiche
    this.statsService.stats$
      .pipe(takeUntil(this.destroy$))
      .subscribe((stats) => {
        console.log('Stats aggiornate:', stats);
        this.stats = stats;
        this.loading = stats?.isLoading || false;
  
        if (stats) {
          this.updateChartData(stats);
        }
      });
  
    // Rimossa la chiamata a effect da qui
  
    // Carica i dati quando il componente si inizializza
    setTimeout(() => this.loadDataForCurrentProject(), 0);
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carica i dati per il progetto corrente
   */
  private loadDataForCurrentProject(): void {
    // Ottiene il progetto attualmente selezionato
    const project = this.selectedProject();

    if (!project) {
      return;
    }

    this.loading = true;

    // Carica prima gli ordini, che sono i dati più importanti per le statistiche
    this.orderStore.fetchPartnerOrders({ projectId: project.id });

    // Carica gli altri dati in parallelo
    Promise.all([this.loadProducts(project.id), this.loadTables(project.id)])
      .then(() => {
        // Dopo che tutti i dati sono stati caricati, aspetta un momento per
        // assicurarsi che siano disponibili negli store e poi calcola le statistiche
        setTimeout(() => {
          this.statsService.calculateStats();
        }, 500);
      })
      .catch((error) => {
        console.error('Errore nel caricamento dei dati:', error);
        this.loading = false;
      });
  }

  /**
   * Aggiorna i dati per i grafici e le tabelle
   */
  private updateChartData(stats: DashboardStats): void {
    // Daily Revenue Chart
    this.dailyRevenueLabels = stats.timeStats.dailyRevenue.map(
      (item) => item.date
    );
    this.dailyRevenueData = stats.timeStats.dailyRevenue.map(
      (item) => item.revenue
    );

    // Hourly Distribution Chart
    this.hourlyLabels = stats.timeStats.hourlyDistribution.map(
      (item) => `${item.hour}:00`
    );
    this.hourlyData = stats.timeStats.hourlyDistribution.map(
      (item) => item.orders
    );

    // Weekday Distribution Chart
    this.weekdayLabels = stats.timeStats.weekdayDistribution.map(
      (item) => item.day
    );
    this.weekdayData = stats.timeStats.weekdayDistribution.map(
      (item) => item.orders
    );

    // Order Types Chart
    this.orderTypeData = [
      stats.orderStats.tableOrders,
      stats.orderStats.preOrders,
      stats.orderStats.completedOrders,
      stats.orderStats.pendingOrders,
      stats.orderStats.cancelledOrders,
    ];
  }

  /**
   * Carica i prodotti per il progetto corrente
   */
  private loadProducts(projectId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.productStore.fetchPartnerProducts();
      // Aumentiamo il timeout per dare più tempo al caricamento
      setTimeout(() => resolve(), 500);
    });
  }

  /**
   * Carica i tavoli per il progetto corrente
   */
  private loadTables(projectId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tableStore.fetchPartnerTables();
      // Aumentiamo il timeout per dare più tempo al caricamento
      setTimeout(() => resolve(), 500);
    });
  }

  /**
   * Aggiorna le statistiche con il nuovo range di date
   */
  updateDateRange(): void {
    if (this.dateRange.length === 2) {
      const [startDate, endDate] = this.dateRange;
      this.statsService.setDateRange(startDate, endDate);
    } else {
      this.statsService.setDateRange();
    }
  }

  /**
   * Resetta il filtro per date
   */
  resetDateRange(): void {
    this.dateRange = [];
    this.statsService.setDateRange();
  }

  /**
   * Metodo per ricaricare manualmente i dati
   */
  reloadData(): void {
    this.loading = true;
    this.loadDataForCurrentProject();
  }
}
