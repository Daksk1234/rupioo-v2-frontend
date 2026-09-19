import React, { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { api } from "../lib/api.js";
import "../auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(
        "If this email is registered, a password reset link has been sent. Please check your inbox."
      );
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
          <h1>Reset password</h1>
          <p>Enter your account email and we’ll send you a secure reset link.</p>
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

        {message && <div className="authSuccess">{message}</div>}
        {error && <div className="authError">{error}</div>}

        <button className="authSubmit" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <Link className="authBack" to="/login">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </main>
  );
}
