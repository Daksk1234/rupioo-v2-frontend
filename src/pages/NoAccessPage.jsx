import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, ShieldX } from "lucide-react";
import { clearSession, getUser } from "../lib/api.js";

export default function NoAccessPage() {
  const navigate = useNavigate();
  const user = getUser();

  const goHome = () => {
    if (user?.role === "MASTER") {
      navigate("/master/dashboard", { replace: true });
      return;
    }

    if (user?.homePath && user.homePath !== "/no-access") {
      navigate(user.homePath, { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.iconWrap}>
          <ShieldX size={34} strokeWidth={1.8} />
        </div>

        <div style={styles.eyebrow}>ACCESS RESTRICTED</div>

        <h1 style={styles.title}>No page access is assigned</h1>

        <p style={styles.text}>
          Your current plan/group does not have View permission for this page.
          Contact your administrator if this access is required.
        </p>

        {user?.planCode ? (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Plan</span>
            <strong style={styles.infoValue}>{user.planCode}</strong>
          </div>
        ) : null}

        <div style={styles.actions}>
          <button type="button" onClick={goHome} style={styles.primaryButton}>
            <ArrowLeft size={16} />
            Go to available page
          </button>

          <button type="button" onClick={logout} style={styles.secondaryButton}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at 20% 15%, rgba(99,102,241,.10), transparent 28%), linear-gradient(145deg,#f8f9ff 0%,#f5f7fb 100%)",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  card: {
    width: "min(460px, 100%)",
    padding: "34px 30px",
    border: "1px solid #e5e7f0",
    borderRadius: 22,
    background: "rgba(255,255,255,.97)",
    boxShadow: "0 24px 70px rgba(31,35,75,.12)",
    textAlign: "center",
  },

  iconWrap: {
    width: 66,
    height: 66,
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    borderRadius: 20,
    background: "#f1f2ff",
    color: "#5d60d6",
  },

  eyebrow: {
    marginBottom: 8,
    color: "#777aec",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".12em",
  },

  title: {
    margin: 0,
    color: "#202238",
    fontSize: 24,
    lineHeight: 1.2,
    letterSpacing: "-.03em",
  },

  text: {
    margin: "12px auto 20px",
    maxWidth: 360,
    color: "#777b90",
    fontSize: 12,
    lineHeight: 1.7,
  },

  infoRow: {
    margin: "0 auto 20px",
    maxWidth: 300,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 11,
    background: "#f7f8fc",
    border: "1px solid #eceef5",
  },

  infoLabel: {
    color: "#8c8fa2",
    fontSize: 10,
  },

  infoValue: {
    color: "#40435f",
    fontSize: 10,
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 42,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "0 15px",
    border: 0,
    borderRadius: 11,
    background: "linear-gradient(135deg,#6264ed,#8257e7)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: 42,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "0 15px",
    border: "1px solid #e1e3ec",
    borderRadius: 11,
    background: "#fff",
    color: "#56596f",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
};
