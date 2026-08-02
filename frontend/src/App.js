import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { I18nProvider } from "@/i18n/I18nContext";

import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import UserLoginPage from "@/pages/UserLoginPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import ServicesPage from "@/pages/ServicesPage";
import BookingPage from "@/pages/BookingPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import PaymentCancelPage from "@/pages/PaymentCancelPage";
import UserDashboard from "@/pages/UserDashboard";
import ReceiptPage from "@/pages/ReceiptPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminScan from "@/pages/admin/AdminScan";
import AdminReceipts from "@/pages/admin/AdminReceipts";
import AdminServices from "@/pages/admin/AdminServices";
import AdminPromos from "@/pages/admin/AdminPromos";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <CurrencyProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<UserLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/book/:serviceId" element={
              <Protected roles={["user","admin","super_admin"]}><BookingPage /></Protected>
            } />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/cancel" element={<PaymentCancelPage />} />
            <Route path="/dashboard" element={
              <Protected roles={["user","admin","super_admin"]}><UserDashboard /></Protected>
            } />
            <Route path="/receipt/:id" element={
              <Protected roles={["user","admin","super_admin"]}><ReceiptPage /></Protected>
            } />

            <Route path="/admin" element={
              <Protected roles={["admin","super_admin"]}><AdminLayout /></Protected>
            }>
              <Route index element={<AdminAnalytics />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="receipts" element={<AdminReceipts />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="promos" element={<AdminPromos />} />
              <Route path="scan" element={<AdminScan />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
      </CurrencyProvider>
    </AuthProvider>
    </I18nProvider>
  );
}
