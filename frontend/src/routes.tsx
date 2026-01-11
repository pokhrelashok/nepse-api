import { createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import PublicLayout from './components/PublicLayout'
import LandingPage from './pages/Landing'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import FeedbackSubmit from './pages/FeedbackSubmit'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'

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

// Public layout route (wraps all public pages with header/footer)
export const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public-layout',
  component: PublicLayout,
})

export const indexRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: '/',
  component: LandingPage,
})

export const feedbackRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: 'feedback',
  component: FeedbackSubmit,
})

export const privacyPolicyRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: 'privacy-policy',
  component: PrivacyPolicy,
})

export const termsOfServiceRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: 'terms-of-service',
  component: TermsOfService,
})

import AdminLayout from './components/admin/AdminLayout'
import CompaniesPage from './pages/admin/Companies'
import PricesPage from './pages/admin/Prices'
import IposPage from './pages/admin/Ipos'
import DividendsPage from './pages/admin/Dividends'
import ApiKeysPage from './pages/admin/ApiKeys'
import FeedbackPage from './pages/admin/Feedback'
import UsersPage from './pages/admin/Users'
import HolidaysPage from './pages/admin/Holidays'

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

export const adminUsersRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'users',
  component: UsersPage,
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

export const adminIposRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'ipos',
  component: IposPage,
})

export const adminDividendsRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'dividends',
  component: DividendsPage,
})

export const adminApiKeysRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'api-keys',
  component: ApiKeysPage,
})

export const adminFeedbackRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'feedback',
  component: FeedbackPage,
})

export const adminHolidaysRoute = createRoute({
  getParentRoute: () => adminAuthenticatedRoute,
  path: 'holidays',
  component: HolidaysPage,
})

export const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    indexRoute,
    feedbackRoute,
    privacyPolicyRoute,
    termsOfServiceRoute,
  ]),
  adminRoute.addChildren([
    adminIndexRoute,
    adminLoginRoute,
    adminAuthenticatedRoute.addChildren([
      adminDashboardRoute,
      adminUsersRoute,
      adminCompaniesRoute,
      adminPricesRoute,
      adminIposRoute,
      adminDividendsRoute,
      adminApiKeysRoute,
      adminFeedbackRoute,
      adminHolidaysRoute,
    ])
  ]),
])
