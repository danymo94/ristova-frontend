// Definisco un'interfaccia per il tipo di route
export interface RouteSection {
  title: string;
  module?: string; // Proprietà opzionale per il controllo del modulo
  links: {
    name: string;
    routerLink: string;
    iconClass: string;
  }[];
}

export const adminRoutes: RouteSection[] = [
  {
    title: 'Pagine Admin',
    links: [
      {
        name: 'Dashboard',
        routerLink: '/admin/dashboard',
        iconClass: 'pi pi-home',
      },
      {
        name: 'Profilo',
        routerLink: '/admin/profile',
        iconClass: 'pi pi-user',
      },
      {
        name: 'Partner',
        routerLink: '/admin/partners',
        iconClass: 'pi pi-users',
      },
      {
        name: 'Ristoranti',
        routerLink: '/admin/projects',
        iconClass: 'pi pi-shop',
      },
    ],
  },
  {
    title: 'Centro Ricavi',
    links: [
      {
        name: 'Fatture Elettroniche',
        routerLink: '/profile',
        iconClass: 'pi pi-file-check',
      },
      {
        name: 'Pagamenti',
        routerLink: '/help',
        iconClass: 'pi pi-credit-card',
      },
    ],
  },
];

export const partnerRoutes: RouteSection[] = [
  {
    title: 'Pagine Partner',
    links: [
      {
        name: 'Profilo',
        routerLink: '/partner/profile',
        iconClass: 'pi pi-user',
      },
      {
        name: 'Ristoranti',
        routerLink: '/partner/projects',
        iconClass: 'pi pi-shop',
      },
      {
        name: 'Chiusure',
        routerLink: '/partner/daily-closings',
        iconClass: 'pi pi-calculator',
      },
    ],
  },
  {
    title: 'APP Ordini',
    module: 'orderApp',
    links: [
      {
        name: 'Dashboard',
        routerLink: '/partner/dashboard',
        iconClass: 'pi pi-home',
      },
      {
        name: 'Ordini',
        routerLink: '/partner/orders',
        iconClass: 'pi pi-receipt',
      },
      {
        name: 'Tasse',
        routerLink: '/partner/taxes',
        iconClass: 'pi pi-percentage',
      },
      {
        name: 'Reparti',
        routerLink: '/partner/departments',
        iconClass: 'pi pi-book',
      },
      {
        name: 'Categorie',
        routerLink: '/partner/categories',
        iconClass: 'pi pi-th-large',
      },
      {
        name: 'Prodotti',
        routerLink: '/partner/products',
        iconClass: 'pi pi-box',
      },
      {
        name: 'Tavoli',
        routerLink: '/partner/tables',
        iconClass: 'pi pi-clone',
      },
      {
        name: 'Clienti',
        routerLink: '/partner/customers',
        iconClass: 'pi pi-users',
      },
    ],
  },
];
