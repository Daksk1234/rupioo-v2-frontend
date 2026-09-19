import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import RegisterSuperadminPage from "./pages/RegisterSuperadminPage.jsx";
import AppShell from "./components/AppShell.jsx";
import ModulePage from "./pages/ModulePage.jsx";
import NoAccessPage from "./pages/NoAccessPage.jsx";
import SuperadminProfilePage from "./pages/SuperadminProfilePage.jsx";
import StorageSettings from "./pages/StorageSettings.jsx";
import { allPages } from "./config/modules.js";
import { getUser, token } from "./lib/api.js";

function homePath() {
  const user = getUser();
  if (user?.role === "MASTER") return "/master/dashboard";
  return user?.homePath || "/no-access";
}

function Protected({ page }) {
  if (!token()) return <Navigate to="/login" replace />;

  const user = getUser();

  // MASTER account is intentionally isolated to the MASTER panel.
  if (user?.role === "MASTER" && page.app !== "master") {
    return <Navigate to="/master/dashboard" replace />;
  }

  // Company/Superadmin users must never enter MASTER routes.
  if (user?.role !== "MASTER" && page.app === "master") {
    return <Navigate to={homePath()} replace />;
  }

  // Every operational route is protected by the View permission inherited
  // from the Group attached to the selected Plan. Direct URL entry is blocked.
  if (user?.role !== "MASTER" && !user?.pageAccess?.[page.path]?.view) {
    return <Navigate to={homePath()} replace />;
  }

  return (
    <AppShell appKey={page.app}>
      <ModulePage page={page} />
    </AppShell>
  );
}

function SuperadminProfileProtected() {
  if (!token()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (user?.role === "MASTER") return <Navigate to="/master/dashboard" replace />;
  if (user?.role !== "SUPERADMIN") return <Navigate to={homePath()} replace />;
  return (
    <AppShell appKey="dms">
      <SuperadminProfilePage />
    </AppShell>
  );
}


function StorageSettingsProtected({ master = false }) {
  if (!token()) return <Navigate to="/login" replace />;
  const user = getUser();
  if (master) {
    if (user?.role !== "MASTER") return <Navigate to={homePath()} replace />;
    return (
      <AppShell appKey="master">
        <StorageSettings />
      </AppShell>
    );
  }
  if (user?.role === "MASTER") return <Navigate to="/master/storage-connection" replace />;
  if (user?.role !== "SUPERADMIN") return <Navigate to={homePath()} replace />;
  return (
    <AppShell appKey="dms">
      <StorageSettings />
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterSuperadminPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/no-access" element={token() ? <NoAccessPage /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={<SuperadminProfileProtected />} />
      <Route path="/storage-settings" element={<StorageSettingsProtected />} />
      <Route path="/master/storage-connection" element={<StorageSettingsProtected master />} />

      <Route
        path="/"
        element={<Navigate to={token() ? homePath() : "/login"} replace />}
      />

      {allPages.map((page) => (
        <Route
          key={page.path}
          path={page.path}
          element={<Protected page={page} />}
        />
      ))}

      <Route
        path="*"
        element={<Navigate to={token() ? homePath() : "/login"} replace />}
      />
    </Routes>
  );
}
