import React, { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { api, clearSession, setSession } from "../lib/api.js";
import "../auth.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Discard any legacy oversized token before attempting a new login.
      clearSession();
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setSession(data);
      const destination =
        data.user.role === "MASTER"
          ? "/master/dashboard"
          : data.user.homePath || "/no-access";

      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <div className="authGlow authGlowOne" />
      <div className="authGlow authGlowTwo" />

      <form className="authCard" onSubmit={login}>
        <div className="authBrand">
          <Logo />
        </div>

        <div className="authHeading">
          <h1>Welcome back</h1>
          <p>Sign in to continue to your workspace.</p>
        </div>

        <label className="authField">
          <span>Email</span>
          <div className="authInputWrap">
            <Mail size={17} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              required
              autoFocus
            />
          </div>
        </label>

        <label className="authField">
          <span>Password</span>
          <div className="authInputWrap">
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="passwordToggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <div className="forgotRow">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        {searchParams.get("reset") === "success" && (
          <div className="authSuccess">Password reset successfully. Please sign in.</div>
        )}
        {searchParams.get("registered") === "success" && (
          <div className="authSuccess">Registration completed successfully. Sign in with your Superadmin email and password.</div>
        )}
        {error && <div className="authError">{error}</div>}

        <button className="authSubmit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="authRegisterLink">
          <span>New company?</span>
          <Link to="/register">Register Superadmin</Link>
        </div>
      </form>
    </main>
  );
}
