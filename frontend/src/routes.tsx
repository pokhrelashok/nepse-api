import { createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import Landing from './pages/Landing'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
  beforeLoad: ({ location }) => {
    // Check if we are on the admin subdomain
    if (typeof window !== 'undefined' && window.location.hostname.startsWith('admin.')) {
      if (location.pathname === '/') {
        throw redirect({ to: '/admin/dashboard' })
      }
    }
  }
})

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

import AdminLayout from './components/admin/AdminLayout'
import CompaniesPage from './pages/admin/Companies'
import PricesPage from './pages/admin/Prices'

// ... existing imports

export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'admin',
  component: () => <Outlet />,
})

export const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/admin/dashboard' })
  }
})

export const adminAuthenticatedRoute = createRoute({
  getParentRoute: () => adminRoute,
  id: 'admin-layout',
  component: AdminLayout,
  beforeLoad: ({ location }) => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      throw redirect({
        to: '/admin/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
})

export const adminLoginRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'login',
  component: Login,
})

export const adminDashboardRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'dashboard',
  component: Dashboard,
})

export const adminCompaniesRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'companies',
  component: CompaniesPage,
})

export const adminPricesRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'prices',
  component: PricesPage,
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    adminLoginRoute,
    adminAuthenticatedRoute.addChildren([
      adminDashboardRoute,
      adminCompaniesRoute,
      adminPricesRoute
    ])
  ]),
])
