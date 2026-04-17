import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Unauthorized from "@/pages/Unauthorized";
import POS from "@/pages/POS";
import KDS from "@/pages/KDS";
import Dashboard from "@/pages/Dashboard";
import MenuManage from "@/pages/MenuManage";
import Orders from "@/pages/Orders";
import Expenses from "@/pages/Expenses";
import Settings from "@/pages/Settings";
import CustomerMenu from "@/pages/CustomerMenu";
import PrintKOT from "@/pages/PrintKOT";
import PrintBill from "@/pages/PrintBill";

const HOME_BY_ROLE = { owner: "/dashboard", staff: "/pos", customer: "/browse" };

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) return null;
  if (!user) return <Landing />;
  return <Navigate to={HOME_BY_ROLE[user.role] || "/"} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="/dashboard" element={<ProtectedRoute roles={["owner"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/menu" element={<ProtectedRoute roles={["owner"]}><MenuManage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute roles={["owner"]}><Expenses /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={["owner"]}><Settings /></ProtectedRoute>} />

          <Route path="/pos" element={<ProtectedRoute roles={["owner", "staff"]}><POS /></ProtectedRoute>} />
          <Route path="/kds" element={<ProtectedRoute roles={["owner", "staff"]}><KDS /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />

          <Route path="/browse" element={<ProtectedRoute roles={["customer", "owner", "staff"]}><CustomerMenu /></ProtectedRoute>} />

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
