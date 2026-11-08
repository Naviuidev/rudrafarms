import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ToastProvider from '@brand/components/ToastProvider.jsx'
import { adminSignedIn } from './auth/session.js'
import AdminLayout from './components/AdminLayout.jsx'
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import CouponsPage from './pages/CouponsPage.jsx'
import CustomerDetailPage from './pages/CustomerDetailPage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DeveloperPage from './pages/DeveloperPage.jsx'
import DeliveriesPage from './pages/DeliveriesPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import LiveSubscriptionsPage from './pages/LiveSubscriptionsPage.jsx'
import LocationsPage from './pages/LocationsPage.jsx'
import ModulePage from './pages/ModulePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SubscriptionPlansPage from './pages/SubscriptionPlansPage.jsx'
import WebsitePage from './pages/WebsitePage.jsx'

function RequireAdmin() {
  if (!adminSignedIn()) return <Navigate to="/login" replace />
  return <AdminLayout />
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="login" element={<AdminLoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route index element={<DashboardPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="products" element={<CatalogPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="subscriptions/plans" element={<SubscriptionPlansPage />} />
            <Route path="subscriptions" element={<LiveSubscriptionsPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="payments" element={<Navigate to="/developer?section=payments" replace />} />
            <Route path="developer" element={<DeveloperPage />} />
            <Route path="website" element={<WebsitePage />} />
            <Route path="design/*" element={<Navigate to="/" replace />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
