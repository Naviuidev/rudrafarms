import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ToastProvider from '@brand/components/ToastProvider.jsx'
import CatalogProvider from './context/CatalogProvider.jsx'
import ShopProvider from './context/ShopProvider.jsx'
import AuthLayout from './components/AuthLayout.jsx'
import StoreLayout from './components/StoreLayout.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import AddressFormPage from './pages/AddressFormPage.jsx'
import AddressesPage from './pages/AddressesPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import HomePage from './pages/HomePage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import QuickDeliveryPage from './pages/QuickDeliveryPage.jsx'
import ShopPage from './pages/ShopPage.jsx'
import SubscriptionsPage from './pages/SubscriptionsPage.jsx'
import SubscriptionDetailPage from './pages/SubscriptionDetailPage.jsx'
import SupportPage from './pages/SupportPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <ShopProvider>
          <CatalogProvider>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
            </Route>
            <Route element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="subscriptions/:subscriptionId" element={<SubscriptionDetailPage />} />
              <Route path="quick-delivery" element={<QuickDeliveryPage />} />
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="addresses/new" element={<AddressFormPage />} />
              <Route path="addresses/:id" element={<AddressFormPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="verify-email" element={<VerifyEmailPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="account/settings" element={<SettingsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
              <Route path="support/:page" element={<SupportPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          </CatalogProvider>
        </ShopProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
