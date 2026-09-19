import React, { useEffect, useState } from "react";
import { Button, Input } from "reactstrap";
import swal from "sweetalert";
import { Image_URL } from "../import/ApiEndPoint/Api";

const API = String(import.meta.env?.VITE_API_URL || Image_URL || "").replace(/\/+$/, "");
const getUser = () => JSON.parse(localStorage.getItem("userData") || "{}");
const getToken = () => getUser()?.token || localStorage.getItem("token") || "";

const authHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export default function EntityDocuments({
  entityType,
  entityId,
  defaultDocumentType = "Other Document",
}) {
  const user = getUser();
  const database = user?.database || "";
  const [docs, setDocs] = useState([]);
  const [documentType, setDocumentType] = useState(defaultDocumentType);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!database || !entityType || !entityId) return;
    try {
      const response = await fetch(
        `${API}/product/storage/documents/${encodeURIComponent(database)}/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
        { headers: authHeaders() },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || "Unable to load documents");
      setDocs(Array.isArray(json?.Documents) ? json.Documents : []);
    } catch (error) {
      console.error(error);
      setDocs([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database, entityType, entityId]);

  const upload = async () => {
    if (!file) return swal("Select a document");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("database", database);
      fd.append("entityType", entityType);
      fd.append("entityId", entityId);
      fd.append("documentType", documentType || "Other Document");

      const response = await fetch(`${API}/product/storage/document`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: fd,
      });
      const json = await response.json();
      if (!response.ok || !json?.status) {
        throw new Error(json?.message || "Upload failed");
      }
      setFile(null);
      await load();
      swal("Saved", "Document stored successfully", "success");
    } catch (error) {
      swal("Error", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const view = async (doc) => {
    try {
      const response = await fetch(
        `${API}/product/storage/document/${doc._id}/view`,
        { headers: authHeaders() },
      );
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.message || "Unable to open document");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      swal("Error", error.message, "error");
    }
  };

  const requestDelete = async (id) => {
    const ok = await swal({
      title: "Move document to recovery state?",
      text: "Permanent deletion is protected for 30 days.",
      icon: "warning",
      buttons: true,
    });
    if (!ok) return;

    const response = await fetch(`${API}/product/storage/document/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return swal("Error", json?.message || "Unable to delete document", "error");
    }
    await load();
  };

  const restore = async (id) => {
    const response = await fetch(
      `${API}/product/storage/document/${id}/restore`,
      { method: "POST", headers: authHeaders() },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return swal("Error", json?.message || "Unable to restore document", "error");
    }
    await load();
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        marginTop: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Documents</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Input
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          placeholder="Document type"
        />
        <Input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button color="primary" disabled={busy || !file} onClick={upload}>
          {busy ? "Uploading..." : "Upload"}
        </Button>
      </div>

      <div style={{ marginTop: 12 }}>
        {docs.map((doc) => (
          <div
            key={doc._id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 0",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <div>
              <b>{doc.documentType}</b> — {doc.fileName}{" "}
              <span style={{ color: "#64748b" }}>v{doc.version}</span>
              {doc.status === "deletion_requested" ? (
                <span style={{ color: "#b45309", marginLeft: 8 }}>
                  Recovery state
                </span>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <Button
                size="sm"
                outline
                color="primary"
                onClick={() => view(doc)}
              >
                View
              </Button>
              {doc.status === "deletion_requested" ? (
                <Button
                  size="sm"
                  outline
                  color="success"
                  onClick={() => restore(doc._id)}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  outline
                  color="danger"
                  onClick={() => requestDelete(doc._id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
