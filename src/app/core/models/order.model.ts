/**
 * Interfaccia per un elemento di un ordine
 */
export interface OrderItem {
  id?: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  userId?: string;
  username?: string;
  isPaid: boolean;
}

/**
 * Dettaglio degli elementi di un utente
 */
export interface UserItems {
  [userId: string]: OrderItem[];
}

/**
 * Informazioni sull'utente connesso al tavolo
 */
export interface ConnectedUser {
  userId: string;
  username: string;
  status: 'active' | 'inactive' | 'left';
  timestamp: number;
  isAnonymous?: boolean;
}

/**
 * Dizionario di utenti connessi al tavolo
 */
export interface ConnectedUsers {
  [userId: string]: ConnectedUser;
}

/**
 * Tipo di modalità di consegna
 */
export type DeliveryMode = 'PICKUP' | 'DELIVERY' | 'OTHER';

/**
 * Stato dell'ordine
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'completed'
  | 'cancelled';

/**
 * Informazioni di contatto per l'ordine
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Metadati dell'ordine
 */
export interface OrderMetadata {
  source?: string;
  CCSyncStatus?: 'synced' | 'failed' | 'pending';
  CCErrorMessage?: string;
  [key: string]: any;
}

/**
 * Interfaccia principale per un ordine
 */
export interface Order {
  id?: string;
  projectId: string;
  partnerId: string;

  // Informazioni sul cliente o tavolo
  customerId?: string;
  customerName?: string;
  tableId?: string;
  tableName?: string;

  // Tipo e stato
  type: 'table' | 'preorder';
  status: OrderStatus;

  // Elementi dell'ordine
  items: OrderItem[];

  // Organizzazione degli elementi per utente (solo per ordini da tavolo)
  userItems?: UserItems;

  // Utenti connessi al tavolo (solo per ordini da tavolo)
  connectedUsers?: ConnectedUsers;

  // Informazioni su preordine (solo per preordini)
  pickupTime?: string;
  deliveryMode?: DeliveryMode;
  deliveryDestination?: string;
  contactInfo?: ContactInfo;

  // Informazioni sui totali
  total: number;
  payedAmount: number;

  // Informazioni temporali
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;

  // Informazioni su Cassa in Cloud
  CCOrderId?: string;

  // Metadati aggiuntivi
  metadata?: OrderMetadata;
}

/**
 * Interfaccia per la creazione di un ordine da tavolo
 */
export interface CreateTableOrderDto {
  tableId: string;
  pay?: boolean;
}

/**
 * Interfaccia per la creazione di un preordine
 */
export interface CreatePreOrderDto {
  items: {
    product: {
      id: string;
      name: string;
      price: number;
      CCProductVariantId?: string;
      CCProduct?: any;
    };
    price: number;
    quantity: number;
    note?: string;
  }[];
  selectedDeliveryMode: DeliveryMode;
  preOrderTime: string;
  deliveryDestination?: string;
  contactInfo?: ContactInfo;
  pay?: boolean;
}

/**
 * Interfaccia per filtri di ricerca degli ordini
 */
export interface OrderSearchFilters {
  projectId?: string;
  partnerId?: string;
  status?: OrderStatus | OrderStatus[];
  type?: 'table' | 'preorder';
  customerId?: string;
  tableId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Interfaccia per la risposta alla creazione di un ordine
 */
export interface OrderCreationResponse {
  cassaincloudResult?: any;
  savedOrder: Order;
}

/**
 * Interfaccia per la lista di ordini di un cliente
 */
export interface CustomerOrdersResponse {
  orders: Order[];
}

/**
 * Interfaccia per la lista di ordini di un partner
 */
export interface PartnerOrdersResponse {
  orders: Order[];
}

/**
 * Interfaccia per supportare il formato legacy degli ordini
 */
export interface LegacyOrder {
  id?: string;
  projectId: string;
  partnerId: string;
  tableId?: string;
  tableName?: string;
  customerId?: string;
  type: 'CCORDER' | 'LOCAL';
  status?: string;
  selectedProducts: {
    id: string;
    name: string;
    price: number;
    payed: boolean;
    note?: string;
  }[];
  selectedDeliveryMode?: DeliveryMode;
  bookingTime?: string;
  totalAmount: number;
  payedAmount: number;
  createdAt?: string;
  cassainCloudOrderId?: string;
}

/**
 * Funzione per convertire un ordine legacy al nuovo formato
 */
export function convertLegacyOrder(legacyOrder: LegacyOrder): Order {
  const newOrder: Order = {
    id: legacyOrder.id,
    projectId: legacyOrder.projectId,
    partnerId: legacyOrder.partnerId,
    tableId: legacyOrder.tableId,
    tableName: legacyOrder.tableName,
    customerId: legacyOrder.customerId,
    type: legacyOrder.tableId ? 'table' : 'preorder',
    status: convertLegacyStatus(legacyOrder.status),
    items: legacyOrder.selectedProducts.map((product) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1, // Nel formato legacy la quantità non è specificata
      isPaid: product.payed,
      notes: product.note,
    })),
    total: legacyOrder.totalAmount,
    payedAmount: legacyOrder.payedAmount,
    deliveryMode: legacyOrder.selectedDeliveryMode,
    pickupTime: legacyOrder.bookingTime,
    createdAt: legacyOrder.createdAt,
    CCOrderId: legacyOrder.cassainCloudOrderId,
    metadata: {
      isLegacyFormat: true,
    },
  };

  return newOrder;
}

/**
 * Funzione di supporto per convertire lo stato legacy al nuovo formato
 */
function convertLegacyStatus(legacyStatus?: string): OrderStatus {
  if (!legacyStatus) return 'pending';

  switch (legacyStatus.toLowerCase()) {
    case 'completed':
    case 'complete':
      return 'completed';
    case 'confirmed':
    case 'confirm':
      return 'confirmed';
    case 'processing':
    case 'process':
      return 'processing';
    case 'cancelled':
    case 'cancel':
      return 'cancelled';
    default:
      return 'pending';
  }
}
