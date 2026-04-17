import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccessGuard from "@/components/AccessGuard";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Unauthorized from "@/pages/Unauthorized";

import Dashboard from "@/pages/Dashboard";
import MenuManage from "@/pages/MenuManage";
import Expenses from "@/pages/Expenses";
import Settings from "@/pages/Settings";
import OwnerTables from "@/pages/owner/TablesManage";
import Inventory from "@/pages/owner/Inventory";

import CaptainTables from "@/pages/captain/Tables";
import CaptainBill from "@/pages/captain/Bill";

import ChefKDS from "@/pages/chef/KDS";
import CashierPayments from "@/pages/cashier/Payments";

import Orders from "@/pages/Orders";
import CustomerMenu from "@/pages/CustomerMenu";
import PrintKOT from "@/pages/PrintKOT";
import PrintBill from "@/pages/PrintBill";

const HOME_BY_ROLE = {
  owner: "/dashboard",
  captain: "/captain",
  chef: "/kds",
  cashier: "/cashier",
  customer: "/browse",
};

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) return null;
  if (!user) return <Landing />;
  return <Navigate to={HOME_BY_ROLE[user.role] || "/"} replace />;
}

// Wraps a protected route with role check + access guard
const Guarded = ({ roles, children }) => (
  <ProtectedRoute roles={roles}>
    <AccessGuard>{children}</AccessGuard>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Owner */}
          <Route path="/dashboard" element={<Guarded roles={["owner"]}><Dashboard /></Guarded>} />
          <Route path="/menu" element={<Guarded roles={["owner"]}><MenuManage /></Guarded>} />
          <Route path="/expenses" element={<Guarded roles={["owner"]}><Expenses /></Guarded>} />
          <Route path="/settings" element={<Guarded roles={["owner"]}><Settings /></Guarded>} />
          <Route path="/owner/tables" element={<Guarded roles={["owner"]}><OwnerTables /></Guarded>} />
          <Route path="/inventory" element={<Guarded roles={["owner", "captain"]}><Inventory /></Guarded>} />

          {/* Captain */}
          <Route path="/captain" element={<Guarded roles={["captain", "owner"]}><CaptainTables /></Guarded>} />
          <Route path="/captain/bill/:id" element={<Guarded roles={["captain", "owner"]}><CaptainBill /></Guarded>} />

          {/* Chef */}
          <Route path="/kds" element={<Guarded roles={["chef", "captain", "owner"]}><ChefKDS /></Guarded>} />

          {/* Cashier */}
          <Route path="/cashier" element={<Guarded roles={["cashier", "owner"]}><CashierPayments /></Guarded>} />

          {/* Shared */}
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />

          {/* Customer */}
          <Route path="/browse" element={<ProtectedRoute roles={["customer", "owner", "captain"]}><CustomerMenu /></ProtectedRoute>} />

          {/* Prints */}
          <Route path="/print/kot/:id" element={<ProtectedRoute><PrintKOT /></ProtectedRoute>} />
          <Route path="/print/bill/:id" element={<ProtectedRoute><PrintBill /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
