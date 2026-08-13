import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogOut, LayoutGrid } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProjectView from "./pages/ProjectView.jsx";
import SDDAnalyzer from "./pages/SDDAnalysis.jsx";

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function Header() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="border-b border-rule/70 bg-parchment/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <img
            src="/asserts/logo.png"
            alt="Sadan AI logo"
            className="w-8 h-8 object-contain transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 drop-shadow-sm"
          />
          <span className="brand-gradient font-display text-xl font-bold tracking-tight">
            Sadan AI
          </span>
          <span className="hidden sm:inline text-xs font-mono text-slate/80 ml-1 pt-1">
            / စာတမ်းခွဲခြမ်းစိတ်ဖြာမှု · Document Analyzer
          </span>
        </Link>

        {!loading && (
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:flex items-center gap-1.5 text-sm text-slate hover:text-ink transition-colors"
                >
                  <LayoutGrid size={15} /> Dashboard
                </Link>
                <span className="hidden sm:inline text-xs font-mono text-slate/70">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="btn-press flex items-center gap-1.5 border border-rule hover:bg-white/60 text-ink px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-ink hover:text-teal transition-colors font-medium"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="btn-press bg-teal hover:bg-tealdark text-parchment px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div key={location.pathname} className="animate-page-in">
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <Signup />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdd-analyzer"
              element={
                <ProtectedRoute>
                  <SDDAnalyzer />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </main>

      <footer className="border-t border-rule/70 py-4">
        <p className="max-w-7xl mx-auto px-6 text-xs text-slate font-mono">
          Sadan AI — read less, know more · စာတမ်းကို ပိုမြန်စွာ နားလည်ပါ။
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}
