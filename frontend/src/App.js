import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import PerangkatDashboard from "./pages/PerangkatDashboard";
import VerifikatorDashboard from "./pages/VerifikatorDashboard";
import PenilaiDashboard from "./pages/PenilaiDashboard";
import { Toaster } from "./components/ui/sonner";

function Dashboard() {
  const { user } = useAuth();
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "perangkat") return <PerangkatDashboard />;
  if (user.role === "verifikator") return <VerifikatorDashboard />;
  if (user.role === "penilai") return <PenilaiDashboard />;
  return <div className="p-10 text-center">Peran tidak dikenal.</div>;
}

function App() {
  useEffect(() => {
    document.title = "Si-Scoring Kalteng";
  }, []);
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
