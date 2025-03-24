export const adminRoutes = [
  {
    title: 'Admin Pages',
    links: [
      { name: 'Dashboard', routerLink: '/admin/dashboard', iconClass: 'pi pi-home' },
      {
        name: 'Profile',
        routerLink: '/admin/profile',
        iconClass: 'pi pi-user',
      },
      {
        name: 'Partners',
        routerLink: '/admin/partners',
        iconClass: 'pi pi-users',
      },
      {
        name: 'Restaurants',
        routerLink: '/admin/projects',
        iconClass: 'pi pi-shop',
      }
    ],
  },
  {
    title: 'Revenue Center',
    links: [
      { name: 'EInvoices', routerLink: '/profile', iconClass: 'pi pi-file-check' },
      { name: 'Payments', routerLink: '/help', iconClass: 'pi pi-credit-card' },
    ],
  },
];

export const partnerRoutes = [
  {
    title: 'Partner Pages',
    links: [
      { name: 'Dashboard', routerLink: '/partner/dashboard', iconClass: 'pi pi-home' },
      {
        name: 'Profile',
        routerLink: '/partner/profile',
        iconClass: 'pi pi-user',
      },
      {
        name: 'Restaurants',
        routerLink: '/partner/projects',
        iconClass: 'pi pi-shop',
      },
    ],
  },
  {
    title: 'Order APP',
    links: [
      {
        name: 'Orders',
        routerLink: '/partner/orders',
        iconClass: 'pi pi-receipt',
      },
      {
        name: 'Taxes',
        routerLink: '/partner/taxes',
        iconClass: 'pi pi-percentage',
      },
      {
        name: 'Departments',
        routerLink: '/partner/departments',
        iconClass: 'pi pi-book',
      },
      {
        name: 'Categories',
        routerLink: '/partner/categories',
        iconClass: 'pi pi-th-large',
      },
      {
        name: 'Products',
        routerLink: '/partner/products',
        iconClass: 'pi pi-box',
      },
      {
        name: 'Tables',
        routerLink: '/partner/tables',
        iconClass: 'pi pi-clone',
      },
      {
        name: 'Customers',
        routerLink: '/partner/customers',
        iconClass: 'pi pi-users',
      },
    ],
  },
  {
    title: 'Kambusa APP',
    links: [
      {
        name: 'Kambusa',
        routerLink: '/partner/kambusa-app',
        iconClass: 'pi pi-receipt',
      },
      {
        name: 'EInvoices',
        routerLink: '/partner/einvoices',
        iconClass: 'pi pi-receipt',
      },
      {
        name: 'Raw Products',
        routerLink: '/partner/rawproducts',
        iconClass: 'pi pi-receipt',
      }]
    }
];
