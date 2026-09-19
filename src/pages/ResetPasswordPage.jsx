import React, { useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { api } from "../lib/api.js";
import "../auth.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      navigate("/login?reset=success", { replace: true });
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

      <form className="authCard authCardSmall" onSubmit={submit}>
        <div className="authBrand">
          <Logo />
        </div>

        <div className="authHeading">
          <h1>Create new password</h1>
          <p>Choose a new password for your Rupioo Global account.</p>
        </div>

        <label className="authField">
          <span>New password</span>
          <div className="authInputWrap">
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              required
              autoFocus
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

        <label className="authField">
          <span>Confirm password</span>
          <div className="authInputWrap">
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              required
            />
          </div>
        </label>

        {error && <div className="authError">{error}</div>}

        <button className="authSubmit" type="submit" disabled={loading || !token}>
          {loading ? "Updating..." : "Reset password"}
        </button>

        <Link className="authBack" to="/login">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </main>
  );
}
