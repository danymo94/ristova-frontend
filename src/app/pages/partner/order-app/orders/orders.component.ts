import {
  Component,
  OnInit,
  inject,
  signal,
  effect,
  computed,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TimelineModule } from 'primeng/timeline';
import { SelectButtonModule } from 'primeng/selectbutton';

import { OrderStore } from '../../../../core/store/order.signal-store';
import { ProjectStore } from '../../../../core/store/project.signal-store';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm.service';
import {
  Order,
  OrderStatus,
  DeliveryMode,
  OrderSearchFilters,
  OrderItem,
} from '../../../../core/models/order.model';

interface OrderStatusItem {
  label: string;
  value: OrderStatus;
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    CalendarModule,
    TagModule,
    TooltipModule,
    BadgeModule,
    CardModule,
    TabViewModule,
    ConfirmDialogModule,
    TimelineModule,
    SelectButtonModule,
  ],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  // Injezioni di dipendenze
  private orderStore = inject(OrderStore);
  private projectStore = inject(ProjectStore);
  private toastService = inject(ToastService);
  private confirmService = inject(ConfirmDialogService);

  // Signals dello store
  orders = this.orderStore.partnerOrders;
  pendingOrders = this.orderStore.pendingOrders;
  tableOrders = this.orderStore.tableOrders;
  preOrders = this.orderStore.preOrders;
  selectedOrder = this.orderStore.selectedOrder;
  isLoading = this.orderStore.loading;
  error = this.orderStore.error;
  selectedProject = this.projectStore.selectedProject;

  // Signal locali per lo stato del componente - convertiti a variabili standard per evitare errori con ngModel
  viewMode = signal<'grid' | 'list' | 'calendar'>('list');
  viewModeValue: 'grid' | 'list' | 'calendar' = 'list';

  searchQuery = signal<string>('');
  searchQueryValue: string = '';

  selectedStatus = signal<OrderStatus | null>(null);
  selectedStatusValue: OrderStatus | null = null;

  selectedType = signal<'table' | 'preorder' | null>(null);
  selectedTypeValue: 'table' | 'preorder' | null = null;

  dateRange = signal<Date[]>([]);
  dateRangeValue: Date[] = [];

  tableId = signal<string | null>(null);
  tableIdValue: string | null = null;

  // Dialogs
  detailsDialogVisible = signal<boolean>(false);
  detailsDialogVisibleValue: boolean = false;

  filterDialogVisible = signal<boolean>(false);
  filterDialogVisibleValue: boolean = false;

  // Opzioni per i filtri e le visualizzazioni
  statusOptions: OrderStatusItem[] = [
    { label: 'In attesa', value: 'pending', severity: 'warn' },
    { label: 'Confermato', value: 'confirmed', severity: 'info' },
    { label: 'In lavorazione', value: 'processing', severity: 'secondary' },
    { label: 'Completato', value: 'completed', severity: 'success' },
    { label: 'Annullato', value: 'cancelled', severity: 'danger' },
  ];

  typeOptions = [
    { label: 'Tavolo', value: 'table' },
    { label: 'Preordine', value: 'preorder' },
  ];

  viewOptions = [
    { icon: 'pi pi-list', value: 'list' },
    { icon: 'pi pi-th-large', value: 'grid' },
    { icon: 'pi pi-calendar', value: 'calendar' },
  ];

  // Computed signal per i tavoli filtrati
  filteredOrders = computed(() => {
    const allOrders = this.orders();
    const searchText = this.searchQuery().toLowerCase();
    const status = this.selectedStatus();
    const type = this.selectedType();
    const fromDate =
      this.dateRange() && this.dateRange().length > 0
        ? this.dateRange()[0]
        : null;
    const toDate =
      this.dateRange() && this.dateRange().length > 1
        ? this.dateRange()[1]
        : null;
    const tableIdFilter = this.tableId();

    if (!allOrders) return null;

    return allOrders.filter((order) => {
      // Filtro per testo di ricerca
      const matchesSearch =
        !searchText ||
        order.id?.toLowerCase().includes(searchText) ||
        order.tableName?.toLowerCase().includes(searchText) ||
        order.customerName?.toLowerCase().includes(searchText);

      // Filtro per stato
      const matchesStatus = !status || order.status === status;

      // Filtro per tipo
      const matchesType = !type || order.type === type;

      // Filtro per data
      const orderDate = order.createdAt ? new Date(order.createdAt) : null;
      const matchesFromDate = !fromDate || !orderDate || orderDate >= fromDate;
      const matchesToDate = !toDate || !orderDate || orderDate <= toDate;

      // Filtro per ID tavolo
      const matchesTableId = !tableIdFilter || order.tableId === tableIdFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesFromDate &&
        matchesToDate &&
        matchesTableId
      );
    });
  });

  constructor() {
    // Effect per caricare gli ordini quando cambia il progetto selezionato
    effect(() => {
      const project = this.selectedProject();
      if (project) {
        this.loadOrders();
      }
    });

    // Inizializza i valori delle variabili standard dai signal
    this.viewModeValue = this.viewMode();
    this.searchQueryValue = this.searchQuery();
    this.selectedStatusValue = this.selectedStatus();
    this.selectedTypeValue = this.selectedType();
    this.dateRangeValue = this.dateRange();
    this.tableIdValue = this.tableId();
    this.detailsDialogVisibleValue = this.detailsDialogVisible();
    this.filterDialogVisibleValue = this.filterDialogVisible();

    // Effects per sincronizzare i signal con le variabili standard
    effect(() => {
      this.viewModeValue = this.viewMode();
    });
    effect(() => {
      this.searchQueryValue = this.searchQuery();
    });
    effect(() => {
      this.selectedStatusValue = this.selectedStatus();
    });
    effect(() => {
      this.selectedTypeValue = this.selectedType();
    });
    effect(() => {
      this.dateRangeValue = this.dateRange();
    });
    effect(() => {
      this.tableIdValue = this.tableId();
    });
    effect(() => {
      this.detailsDialogVisibleValue = this.detailsDialogVisible();
    });
    effect(() => {
      this.filterDialogVisibleValue = this.filterDialogVisible();
    });
  }

  ngOnInit(): void {
    // Nessuna operazione specifica all'inizializzazione
    // Gli ordini saranno caricati dall'effect quando il progetto è selezionato
  }

  /**
   * Carica gli ordini per il progetto selezionato
   */
  loadOrders(): void {
    const project = this.selectedProject();
    if (!project) {
      this.toastService.showError('Nessun progetto selezionato');
      return;
    }

    this.orderStore.fetchPartnerOrders({ projectId: project.id });
  }

  /**
   * Gestione dell'aggiornamento delle variabili signal
   */
  updateSearchQuery(value: string): void {
    this.searchQueryValue = value;
    this.searchQuery.set(value);
  }

  updateViewMode(value: 'grid' | 'list' | 'calendar'): void {
    this.viewModeValue = value;
    this.viewMode.set(value);
  }

  updateSelectedStatus(value: OrderStatus | null): void {
    this.selectedStatusValue = value;
    this.selectedStatus.set(value);
  }

  updateSelectedType(value: 'table' | 'preorder' | null): void {
    this.selectedTypeValue = value;
    this.selectedType.set(value);
  }

  updateDateRange(value: Date[]): void {
    this.dateRangeValue = value;
    this.dateRange.set(value);
  }

  updateTableId(value: string | null): void {
    this.tableIdValue = value;
    this.tableId.set(value);
  }

  updateFilterDialogVisible(value: boolean): void {
    this.filterDialogVisibleValue = value;
    this.filterDialogVisible.set(value);
  }

  updateDetailsDialogVisible(value: boolean): void {
    this.detailsDialogVisibleValue = value;
    this.detailsDialogVisible.set(value);
  }

  /**
   * Filtra gli ordini in base al testo di ricerca
   */
  applyFilters(): void {
    this.updateFilterDialogVisible(false);
    // Non è necessaria un'operazione esplicita qui poiché i filtri vengono applicati
    // automaticamente tramite il computed signal filteredOrders
  }

  /**
   * Resetta tutti i filtri applicati
   */
  resetFilters(): void {
    this.updateSearchQuery('');
    this.updateSelectedStatus(null);
    this.updateSelectedType(null);
    this.updateDateRange([]);
    this.updateTableId(null);
    this.updateFilterDialogVisible(false);
  }

  /**
   * Apre la dialog dei dettagli dell'ordine
   */
  viewOrderDetails(order: Order): void {
    this.orderStore.selectOrder(order);
    this.updateDetailsDialogVisible(true);
  }

  /**
   * Chiude la dialog dei dettagli dell'ordine
   */
  closeDetailsDialog(): void {
    this.updateDetailsDialogVisible(false);
    this.orderStore.clearSelectedOrder();
  }

  /**
   * Gestisce il cambio di visibilità della dialog dei dettagli
   */
  onDetailsDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeDetailsDialog();
    }
  }

  /**
   * Aggiorna lo stato di un ordine
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus
  ): Promise<void> {
    try {
      const confirmed = await this.confirmService
        .confirm(
          `Sei sicuro di voler cambiare lo stato dell'ordine a ${this.getStatusLabel(
            newStatus
          )}?`
        )
        .toPromise();

      if (!confirmed) return;

      this.orderStore.updateOrderStatus({ orderId, status: newStatus });
    } catch (error) {
      console.error('Errore nella conferma:', error);
    }
  }

  /**
   * Ottiene l'etichetta per un codice di stato
   */
  getStatusLabel(status: OrderStatus): string {
    const statusItem = this.statusOptions.find((s) => s.value === status);
    return statusItem ? statusItem.label : status;
  }

  /**
   * Ottiene la severità (colore) per un codice di stato
   */
  getStatusSeverity(
    status: OrderStatus
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined {
    const statusItem = this.statusOptions.find((s) => s.value === status);
    return statusItem ? statusItem.severity : undefined;
  }

  /**
   * Formatta il timestamp in una stringa leggibile
   */
  formatDate(timestamp: string | undefined): string {
    if (!timestamp) return 'Data non disponibile';

    const date = new Date(timestamp);
    return date.toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Converte DeliveryMode in una stringa leggibile
   */
  getDeliveryModeLabel(mode: DeliveryMode | undefined): string {
    if (!mode) return 'Non specificato';

    switch (mode) {
      case 'PICKUP':
        return 'Ritiro in loco';
      case 'DELIVERY':
        return 'Consegna a domicilio';
      case 'OTHER':
        return 'Altro';
      default:
        return mode;
    }
  }

  /**
   * Calcola il totale degli elementi nell'ordine
   */
  calculateTotalItems(order: Order): number {
    return order.items.reduce((total, item) => total + item.quantity, 0);
  }

  /**
   * Aggiorna gli ordini
   */
  refreshOrders(): void {
    this.loadOrders();
  }

  /**
   * Gestisce il cambio della modalità di visualizzazione
   */
  changeViewMode(mode: 'grid' | 'list' | 'calendar'): void {
    this.updateViewMode(mode);
  }

  /**
   * Verifica se ci sono filtri attivi
   */
  hasActiveFilters(): boolean {
    return (
      !!this.searchQuery() ||
      !!this.selectedStatus() ||
      !!this.selectedType() ||
      (this.dateRange() && this.dateRange().length > 0) ||
      !!this.tableId()
    );
  }

  /**
   * Gestisce il pendingOrdersCount in modo sicuro
   */
  getPendingOrdersCount(): number {
    return this.pendingOrders()?.length || 0;
  }

  /**
   * Restituisce un array con gli ID degli utenti presenti nell'ordine
   */
  getOrderUsers(): string[] {
    const order = this.selectedOrder();
    if (!order || !order.userItems) return [];

    return Object.keys(order.userItems);
  }

  /**
   * Restituisce gli elementi di un utente specifico
   */
  getUserItems(userId: string): OrderItem[] {
    const order = this.selectedOrder();
    if (!order || !order.userItems || !order.userItems[userId]) return [];

    return order.userItems[userId];
  }

  /**
   * Calcola il totale per un utente specifico
   */
  calculateUserTotal(userId: string): number {
    const items = this.getUserItems(userId);
    if (!items || items.length === 0) return 0;

    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  /**
   * Restituisce il nome visualizzato per un utente
   */
  getUserDisplayName(userId: string): string {
    const order = this.selectedOrder();
    if (!order || !order.connectedUsers) return userId;

    const user = order.connectedUsers[userId];
    if (user) {
      return user.username || userId;
    }

    // Cerca l'username nelle items
    for (const item of order.items) {
      if (item.userId === userId && item.username) {
        return item.username;
      }
    }

    return userId;
  }

  /**
   * Restituisce il totale formattato dell'ordine
   */
  getFormattedTotal(order: Order | null): string {
    if (!order || typeof order.total !== 'number') return '0.00';
    return order.total.toFixed(2);
  }

  /**
   * Restituisce l'importo pagato formattato
   */
  getFormattedPayedAmount(order: Order | null): string {
    if (!order || typeof order.payedAmount !== 'number') return '0.00';
    return order.payedAmount.toFixed(2);
  }

  /**
   * Verifica se un ordine è completamente pagato
   */
  isFullyPaid(order: Order | null): boolean {
    if (
      !order ||
      typeof order.total !== 'number' ||
      typeof order.payedAmount !== 'number'
    ) {
      return false;
    }
    return order.payedAmount === order.total;
  }

  /**
   * Verifica se un ordine è parzialmente pagato
   */
  isPartiallyPaid(order: Order | null): boolean {
    if (
      !order ||
      typeof order.total !== 'number' ||
      typeof order.payedAmount !== 'number'
    ) {
      return false;
    }
    return order.payedAmount > 0 && order.payedAmount < order.total;
  }

  /**
   * Verifica se un ordine non è pagato
   */
  isNotPaid(order: Order | null): boolean {
    if (!order || typeof order.payedAmount !== 'number') {
      return true;
    }
    return order.payedAmount === 0;
  }

  /**
   * Restituisce lo stato del pagamento come testo
   */
  getPaymentStatusText(order: Order | null): string {
    if (this.isFullyPaid(order)) return 'Pagato';
    if (this.isPartiallyPaid(order)) return 'Parziale';
    return 'Non pagato';
  }
}
