import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User, ArrowRight } from "lucide-react";

const API = "/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
      });

      const { access_token, user } = response.data;
      onLogin(access_token, user);
      toast.success("Welcome back");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch">
      <style>{`
        .login-wrap { background: hsl(var(--background)); }
        .login-left {
          position: relative;
          background:
            radial-gradient(900px 500px at 20% 20%, hsla(38, 91%, 55%, 0.12), transparent 55%),
            radial-gradient(700px 500px at 80% 90%, hsla(38, 91%, 55%, 0.06), transparent 60%),
            linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
          border-right: 1px solid hsl(var(--border));
          overflow: hidden;
        }
        .login-left::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%);
          pointer-events: none;
          opacity: 0.35;
        }
        .brand-dot {
          width: 10px; height: 10px; border-radius: 999px;
          background: hsl(var(--primary));
          box-shadow: 0 0 18px hsla(38, 91%, 55%, 0.6);
        }
        .login-card {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          box-shadow:
            0 1px 0 hsl(var(--foreground) / 0.03),
            0 20px 60px -20px hsl(var(--foreground) / 0.25);
        }
        .login-input {
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          height: 48px;
          font-size: 15px;
          padding-left: 44px;
        }
        .login-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsla(38, 91%, 55%, 0.15);
          outline: none;
        }
        .login-btn {
          height: 48px;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.01em;
          transition: transform 180ms ease, filter 180ms ease;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          border: none;
          cursor: pointer;
        }
        .login-btn:hover:not(:disabled) {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @keyframes login-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-rise { animation: login-rise 0.8s cubic-bezier(.25,.85,.4,1) both; }
        .login-d-1 { animation-delay: 0.05s; }
        .login-d-2 { animation-delay: 0.12s; }
        .login-d-3 { animation-delay: 0.2s; }
        .login-d-4 { animation-delay: 0.28s; }
      `}</style>

      {/* Left panel — brand / marketing */}
      <div className="login-left hidden lg:flex flex-1 flex-col justify-between p-14 relative">
        <div className="login-rise login-d-1 relative z-10">
          <div className="flex items-center gap-3">
            <span className="brand-dot" />
            <span className="text-xl font-bold tracking-tight">M3U Manager</span>
          </div>
        </div>

        <div className="login-rise login-d-2 relative z-10 max-w-xl">
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}
          >
            Every stream,
            <br />
            <span style={{ color: "hsl(var(--primary))" }}>in one place.</span>
          </h1>
          <p
            className="mt-6 max-w-md"
            style={{ color: "hsl(var(--muted-foreground))", fontSize: 17, lineHeight: 1.55 }}
          >
            Multi-tenant IPTV playlist management with live capacity
            tracking, monitored events, and role-based access.
          </p>
        </div>

        <div className="login-rise login-d-3 relative z-10 grid grid-cols-3 gap-6 max-w-xl">
          {[
            { k: "Tenants", v: "Multi-tenant isolation" },
            { k: "Streams", v: "Real-time capacity" },
            { k: "Events", v: "Category monitoring" },
          ].map((i) => (
            <div key={i.k}>
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                {i.k}
              </div>
              <div className="mt-1.5 text-[13px]" style={{ color: "hsl(var(--foreground) / 0.85)" }}>
                {i.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-wrap flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md login-rise login-d-2">
          {/* mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <span className="brand-dot" />
            <span className="text-xl font-bold tracking-tight">M3U Manager</span>
          </div>

          <div className="login-card p-8 sm:p-10" data-testid="login-card">
            <div className="mb-8">
              <div className="qp-eyebrow mb-3">Welcome back</div>
              <h2 className="font-bold tracking-tight" style={{ fontSize: 32, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                Sign in to your account
              </h2>
              <p className="mt-2" style={{ color: "hsl(var(--muted-foreground))", fontSize: 14 }}>
                Enter your credentials to access the control panel.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">Username</Label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <input
                    id="username"
                    data-testid="username-input"
                    type="text"
                    placeholder="you@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="login-input w-full"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <input
                    id="password"
                    data-testid="password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-input w-full"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                data-testid="login-button"
                className="login-btn"
                disabled={loading}
              >
                {loading ? "Signing in…" : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p
            className="text-center mt-6 text-xs"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Protected by role-based access · v1.1.2
          </p>
        </div>
      </div>
    </div>
  );
}
