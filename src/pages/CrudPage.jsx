import React, { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import BulkTools from "../components/BulkTools.jsx";
import { api } from "../lib/api.js";
import { fieldsFor, resourceName } from "../config/resourceSchemas.js";

const masterMap = {
  "/master/hsn": {
    endpoint: "/master/hsn",
    toApi: (v) => ({
      code: String(v.reference || "")
        .trim()
        .toUpperCase(),
      type: "HSN",
      description: String(v.title || "").trim(),
      gstRate: Number(v.gstRate || 0),
      cgstRate: Number(v.gstRate || 0) / 2,
      sgstRate: Number(v.gstRate || 0) / 2,
      igstRate: Number(v.gstRate || 0),
      cessRate: Number(v.cessRate || 0),
      status: "ACTIVE",
    }),
    fromApi: (r) => ({
      ...r,
      title: r.description,
      reference: r.code,
      cessRate: Number(r.cessRate || 0),
    }),
  },
  "/master/units": {
    endpoint: "/master/units",
    toApi: (v) => ({
      code: String(v.reference || "").toUpperCase(),
      name: v.title,
      uqc: String(v.uqc || "").toUpperCase(),
      decimals: Number(v.decimals || 0),
      status: v.status || "ACTIVE",
    }),
    fromApi: (r) => ({ ...r, title: r.name, reference: r.code }),
  },
  "/master/accounts": {
    endpoint: "/master/accounts",
    toApi: (v) => ({
      systemCode: v.reference,
      name: v.title,
      parentCode: v.parentCode,
      nature: v.nature || "ASSET",
      locked: false,
      allowCompanyLedger: true,
    }),
    fromApi: (r) => ({
      ...r,
      title: r.name,
      reference: r.systemCode,
      status: r.locked ? "LOCKED" : "ACTIVE",
    }),
  },
  "/master/barcodes": {
    endpoint: "/master/barcodes",
    toApi: (v) => ({
      barcodeId: v.reference || `BC-${Date.now()}`,
      gtin: v.reference || undefined,
      type: v.type || "EAN13",
      brand: v.brand,
      sku: v.sku,
      productName: v.title,
      status: v.status || "AVAILABLE",
    }),
    fromApi: (r) => ({
      ...r,
      title: r.productName,
      reference: r.gtin || r.barcodeId,
    }),
  },
};
const emptyFrom = (fields) =>
  Object.fromEntries(
    fields.map((x) => [
      x.key,
      x.type === "number"
        ? 0
        : x.key === "status"
          ? x.options?.[0] || "ACTIVE"
          : "",
    ]),
  );
const esc = (v) => String(v ?? "").replaceAll('"', '""');
function endpointFor(page) {
  return (
    masterMap[page.path]?.endpoint ||
    `/modules/${page.app}/${resourceName(page)}`
  );
}
function normalize(page, r) {
  const m = masterMap[page.path];
  return m ? m.fromApi(r) : { ...r, ...(r.data || {}) };
}
function payload(page, form) {
  const m = masterMap[page.path];
  if (m) return m.toApi(form);
  const standard = new Set([
    "title",
    "reference",
    "status",
    "date",
    "amount",
    "quantity",
    "assignedTo",
    "notes",
    "tags",
  ]);
  const data = {};
  Object.entries(form).forEach(([k, v]) => {
    if (!standard.has(k)) data[k] = v;
  });
  return {
    ...form,
    amount: Number(form.amount || 0),
    quantity: Number(form.quantity || 0),
    data,
  };
}
function bulkConfig(page, fields) {
  if (page.path === "/master/accounts")
    return { allowUpload: false, allowDelete: false, editFields: [] };
  return {
    allowUpload: true,
    allowDelete: true,
    editFields: fields.filter((x) => !["reference", "date"].includes(x.key)),
  };
}

export default function CrudPage({ page }) {
  const fields = fieldsFor(page),
    blank = useMemo(() => emptyFrom(fields), [page.path]),
    bulk = bulkConfig(page, fields);
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState(""),
    [show, setShow] = useState(false),
    [edit, setEdit] = useState(null),
    [form, setForm] = useState(blank),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState([]),
    [pageNo, setPageNo] = useState(1),
    [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const endpoint = endpointFor(page);
  const load = async (nextPage = pageNo) => {
    setLoading(true);
    try {
      const sep = endpoint.includes("?") ? "&" : "?";
      const statusQuery =
        filter && page.path !== "/master/hsn"
          ? `&status=${encodeURIComponent(filter)}`
          : "";
      const data = await api(
        `${endpoint}${sep}q=${encodeURIComponent(q)}&page=${nextPage}&limit=50${statusQuery}`,
      );
      const items = Array.isArray(data) ? data : data.items || [];
      setRows(items.map((r) => normalize(page, r)));
      setMeta(data.meta || { page: nextPage, pages: 1, total: items.length });
      setPageNo(data.meta?.page || nextPage);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setForm(blank);
    setEdit(null);
    setShow(false);
    setSelected([]);
    setPageNo(1);
    load(1);
  }, [page.path, filter]);
  const openNew = () => {
    setEdit(null);
    setForm(blank);
    setShow(true);
    setMessage("");
  };
  const openEdit = (r) => {
    setEdit(r);
    const values = { ...blank };
    fields.forEach((x) => {
      values[x.key] = r[x.key] ?? r.data?.[x.key] ?? "";
    });
    setForm(values);
    setShow(true);
    setMessage("");
  };
  const save = async () => {
    try {
      setLoading(true);
      const url = edit ? `${endpoint}/${edit._id}` : endpoint;
      await api(url, {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(payload(page, form)),
      });
      setMessage(edit ? "Updated successfully" : "Created successfully");
      setShow(false);
      setEdit(null);
      setForm(blank);
      await load();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };
  const remove = async (r) => {
    if (!confirm(`Delete ${r.title || r.reference || "this record"}?`)) return;
    try {
      await api(`${endpoint}/${r._id}`, { method: "DELETE" });
      setMessage("Deleted successfully");
      load();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const exportCsv = () => {
    const keys = fields.map((x) => x.key);
    const lines = [
      [...keys].join(","),
      ...rows.map((r) =>
        keys.map((k) => `"${esc(r[k] ?? r.data?.[k] ?? "")}"`).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${resourceName(page)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const toggle = (id) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const toggleAll = (checked, ids) =>
    setSelected((s) =>
      checked
        ? [...new Set([...s, ...ids])]
        : s.filter((x) => !ids.includes(x)),
    );
  const columns = [
    ...fields
      .slice(0, 6)
      .map((x) => ({
        key: x.key,
        label: x.label,
        status: x.key === "status",
        render:
          x.key === "date"
            ? (r) =>
                r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—"
            : undefined,
      })),
    {
      key: "__actions",
      label: "Actions",
      render: (r) => (
        <div className="rowActions">
          <button title="Edit" onClick={() => openEdit(r)}>
            <Pencil />
          </button>
          <button className="danger" title="Delete" onClick={() => remove(r)}>
            <Trash2 />
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={page.label}
        description={page.description}
        onAdd={openNew}
        onExport={exportCsv}
        onFilter={
          page.path === "/master/hsn"
            ? undefined
            : () => setFilter((v) => (v ? "" : "ACTIVE"))
        }
      />
      {message && (
        <div
          className={`resultBanner ${/success/i.test(message) ? "good" : "bad"}`}
        >
          {message}
        </div>
      )}
      <BulkTools
        endpoint={endpoint}
        fields={fields}
        editFields={bulk.editFields}
        selectedIds={selected}
        allowUpload={bulk.allowUpload}
        allowDelete={bulk.allowDelete}
        allowEdit={bulk.editFields?.length !== 0}
        schemaForUpload={!masterMap[page.path]}
        templateName={
          page.path === "/master/hsn"
            ? "HSN-Bulk-Upload-Format.csv"
            : `${resourceName(page)}-bulk-template.csv`
        }
        templateLabel={
          page.path === "/master/hsn" ? "Download Format" : "Template"
        }
        rejectedDownloadName={
          page.path === "/master/hsn"
            ? "HSN-Upload-Errors.csv"
            : "bulk-upload-errors.csv"
        }
        rejectedColumns={
          page.path === "/master/hsn"
            ? [
                { key: "code", label: "HSN No" },
                { key: "description", label: "Product Description" },
                { key: "gstRate", label: "GST %" },
                { key: "cessRate", label: "Cess" },
              ]
            : undefined
        }
        onClear={() => setSelected([])}
        onDone={() => load()}
      />
      {show && (
        <section className="panel editorPanel">
          <div className="formTitle">
            <div>
              <h3>{edit ? `Edit ${page.label}` : `Add ${page.label}`}</h3>
              <span>
                Saved to the live database. Changes are immediately visible in
                this module.
              </span>
            </div>
            <button className="btn ghost" onClick={() => setShow(false)}>
              Close
            </button>
          </div>
          <div className="formGrid dynamicForm">
            {fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={form[field.key]}
                onChange={(v) => setForm((x) => ({ ...x, [field.key]: v }))}
              />
            ))}
          </div>
          <div className="formActions">
            <button className="btn ghost" onClick={() => setShow(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={
                loading || !String(form.title || form.reference || "").trim()
              }
              onClick={save}
            >
              {edit ? "Update" : "Save"}
            </button>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setSelected([]), load(1))}
              placeholder={`Search ${page.label.toLowerCase()}...`}
            />
          </div>
          <button className="btn ghost" onClick={() => load()}>
            <RefreshCw size={15} />
            {loading ? "Loading" : "Refresh"}
          </button>
          {filter && (
            <button className="btn ghost" onClick={() => setFilter("")}>
              <XCircle size={15} />
              Clear Active Filter
            </button>
          )}
          <div className="recordCount">
            <CheckCircle2 size={16} />
            {meta.total ?? rows.length} records
          </div>
        </div>
        <DataTable
          selectable
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          columns={columns}
          rows={rows}
        />
        <div className="paginationBar">
          <span>
            Page {meta.page || pageNo} of {Math.max(1, meta.pages || 1)} •{" "}
            {meta.total ?? rows.length} records
          </span>
          <div>
            <button
              className="btn ghost"
              disabled={(meta.page || pageNo) <= 1}
              onClick={() => {
                setSelected([]);
                load((meta.page || pageNo) - 1);
              }}
            >
              <ChevronLeft size={15} />
              Previous
            </button>
            <button
              className="btn ghost"
              disabled={(meta.page || pageNo) >= (meta.pages || 1)}
              onClick={() => {
                setSelected([]);
                load((meta.page || pageNo) + 1);
              }}
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ field, value, onChange }) {
  const props = {
    value: value ?? "",
    onChange: (e) => onChange(e.target.value),
  };
  if (field.type === "select")
    return (
      <label>
        {field.label}
        <select {...props}>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {String(o).replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.type === "textarea")
    return (
      <label className="fullField">
        {field.label}
        <textarea {...props} rows="3" />
      </label>
    );
  return (
    <label>
      {field.label}
      <input type={field.type || "text"} {...props} />
    </label>
  );
}
