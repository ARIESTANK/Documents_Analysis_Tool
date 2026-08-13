import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Could not sign in with Google.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 animate-fade-in-up">
      <div className="text-center mb-8">
        <LogIn size={24} className="text-teal mx-auto mb-3 animate-pop-in" />
        <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
        <p className="text-slate text-sm mt-1">Sign in to access your workspaces.</p>
      </div>

      {!configured && (
        <div className="mb-5 border border-amber/40 bg-amber/10 text-ink px-4 py-3 rounded-md text-sm">
          Supabase isn't configured yet. Set VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY in frontend/.env.
        </div>
      )}

      {error && (
        <div className="mb-5 border border-rust/40 bg-rust/10 text-ink px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-rule bg-white/40 rounded-lg p-6">
        <label className="block text-xs font-mono uppercase tracking-widest text-slate mb-1.5">
          Email
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule rounded-md px-3 py-2 mb-4 bg-white/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal focus:-translate-y-px"
          placeholder="you@example.com"
        />
        <label className="block text-xs font-mono uppercase tracking-widest text-slate mb-1.5">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-rule rounded-md px-3 py-2 mb-5 bg-white/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal focus:-translate-y-px"
          placeholder="••••••••"
        />
        <button
          type="submit"
          disabled={loading || !configured}
          className="btn-press w-full flex items-center justify-center gap-2 bg-teal hover:bg-tealdark disabled:opacity-40 text-parchment px-4 py-2.5 rounded-md font-medium transition-colors shadow-sm hover:shadow-md"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-parchment/40 border-t-parchment rounded-full animate-spin" />
          ) : (
            "Sign in"
          )}
        </button>

        <div className="flex items-center gap-3 my-5 text-xs text-slate">
          <span className="h-px flex-1 bg-rule" />
          <span>or</span>
          <span className="h-px flex-1 bg-rule" />
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || !configured}
          className="btn-press w-full flex items-center justify-center gap-2 border border-rule hover:border-teal disabled:opacity-40 text-ink px-4 py-2.5 rounded-md font-medium transition-colors bg-white/70"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      <p className="text-center text-sm text-slate mt-6">
        Don't have an account?{" "}
        <Link to="/signup" className="text-teal hover:text-tealdark font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.8V7.3H2.9a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.9.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2a10 10 0 0 0-9.1 5.3l3.3 2.6C7 7.8 9.3 6 12 6Z" />
    </svg>
  );
}
