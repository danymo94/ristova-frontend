import { Role } from './core/services/role.service';
import { Routes, CanActivate } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () =>
      import('./core/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [RoleGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'partners',
        loadComponent: () =>
          import('./pages/admin/new-partner/new-partner.component').then(
            (m) => m.NewPartnerComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects.component').then(
            (m) => m.ProjectsComponent
          ),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'partner',
    loadComponent: () =>
      import('./core/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [RoleGuard],

    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects.component').then(
            (m) => m.ProjectsComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'taxes',
        loadComponent: () =>
          import('./pages/partner/order-app/taxes/taxes.component').then(
            (m) => m.TaxesComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'departments',
        loadComponent: () =>
          import(
            './pages/partner/order-app/departments/departments.component'
          ).then((m) => m.DepartmentsComponent),
        pathMatch: 'full',
      },
      {
        path: 'categories',
        loadComponent: () =>
          import(
            './pages/partner/order-app/categories/categories.component'
          ).then((m) => m.CategoriesComponent),
        pathMatch: 'full',
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/partner/order-app/products/products.component').then(
            (m) => m.ProductsComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'tables',
        loadComponent: () =>
          import('./pages/partner/order-app/tables/tables.component').then(
            (m) => m.TablesComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/partner/order-app/orders/orders.component').then(
            (m) => m.OrdersComponent
          ),
        pathMatch: 'full',
      },
      {
        path: 'customers',
        loadComponent: () =>
          import(
            './pages/partner/order-app/customers/customers.component'
          ).then((m) => m.CustomersComponent),
        pathMatch: 'full',
      },
      {
        path: 'einvoices',
        loadComponent: () =>
          import(
            './pages/partner/kambusa-app/einvoices/einvoices.component'
          ).then((m) => m.EinvoicesComponent),
        pathMatch: 'full',
      },
      {
        path: 'rawproducts',
        loadComponent: () =>
          import(
            './pages/partner/kambusa-app/rawproducts/rawproducts.component'
          ).then((m) => m.RawproductsComponent),
        pathMatch: 'full',
      },
      {
        path: 'warehouses',
        loadComponent: () =>
          import(
            './pages/partner/kambusa-app/warehouses/warehouses.component'
          ).then((m) => m.WarehousesComponent),
        pathMatch: 'full',
      },
      {
        path: 'stockmovements',
        loadComponent: () =>
          import(
            './pages/partner/kambusa-app/stock-movements/stock-movements.component'
          ).then((m) => m.StockMovementsComponent),
        pathMatch: 'full',
      },
      {
        path: 'daily-closings',
        loadComponent: () =>
          import(
            './pages/partner/daily-closings/daily-closings.component'
          ).then((m) => m.DailyClosingsComponent),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/auth.component').then((m) => m.AuthComponent),
    canActivate: [RoleGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./core/auth/auth.component').then((m) => m.AuthComponent),
    canActivate: [RoleGuard],
  },
];
