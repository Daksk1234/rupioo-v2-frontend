import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import BulkTools from "../components/BulkTools.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import CreateLookupButton, {
  getLookupEditId,
  isLookupCreate,
  notifyLookupCreated,
} from "../components/CreateLookupButton.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import ScanAndFill from "../components/ScanAndFill.jsx";
import { api, apiBlob, getUser } from "../lib/api.js";
import {
  bankFieldsFromIfsc,
  lookupIfscMaster,
  normalizeIfsc,
} from "../lib/ifscLookup.js";
import { accessForPath } from "../lib/permissionAccess.js";

const digits = (v) => String(v || "").replace(/\D/g, "");
const cityKey = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const needsTransport = (customerCity, firmCity) =>
  Boolean(
    cityKey(customerCity) &&
    cityKey(firmCity) &&
    cityKey(customerCity) !== cityKey(firmCity),
  );
const currentFY = () => {
  try {
    return localStorage.getItem("financialYearSelected") || "2026-27";
  } catch {
    return "2026-27";
  }
};
const emptyBank = () => ({
  ifsc: "",
  bankName: "",
  branchName: "",
  branchArea: "",
  bankAddress: "",
  bankCity: "",
  bankState: "",
  bankStdCode: "",
  bankPhone: "",
  bankContactNo: "",
  accountNumber: "",
  accountName: "",
});
const blankCustomer = () => ({
  sourceLeadId: "",
  firstName: "",
  lastName: "",
  passportNumber: "",
  tradeName: "",
  ownerName: "",
  ownerMobile: "",
  ownerAadhaar: "",
  ownerAadhaarMasked: "",
  ownerPan: "",
  ownerPincode: "",
  ownerArea: "",
  ownerCity: "",
  ownerDistrict: "",
  ownerState: "",
  ownerAddress: "",
  legalName: "",
  partyType: "DEBITOR",
  registrationType: "UNKNOWN",
  gstin: "",
  pan: "",
  email: "",
  dealsInProducts: "",
  annualTurnover: 0,
  address: "",
  address2: "",
  companyContactNumber: "",
  pincode: "",
  area: "",
  city: "",
  district: "",
  state: "",
  shopSize: "",
  category: "",
  regionType: "LOCAL",
  paymentType: "CASH",
  dueDate: "",
  creditDays: 0,
  creditLimit: 0,
  graceDays: 0,
  assignedTransport: "",
  assignedTransportGlobalId: "",
  assignedTransportBookingStationId: "",
  assignedTransportDeliveryStationId: "",
  serviceArea: "",
  salespersonId: "",
  priceList: "STANDARD",
  gradeCode: "",
  gradeDiscountPct: 0,
  geotagging: "",
  password: "",
  portalLoginEnabled: false,
  bankDetails: [emptyBank()],
  financialYear: currentFY(),
  openingBalance: 0,
  openingBalanceType: "DR",
  remarks: "",
});

const bulkFields = [
  {
    key: "legalName",
    label: "Company Name",
    example: "ABC Traders",
    noBulkEdit: true,
  },
  {
    key: "gstin",
    label: "GSTIN",
    example: "18AKRPJ2121L2ZX",
    noBulkEdit: true,
  },
  { key: "pan", label: "Company PAN", example: "AKRPJ2121L", noBulkEdit: true },
  { key: "ownerName", label: "Owner Name" },
  { key: "ownerMobile", label: "Owner Mobile" },
  {
    key: "pincode",
    label: "Company Pincode",
    example: "781001",
    noBulkEdit: true,
  },
  { key: "address", label: "Company Address", noBulkEdit: true },
  {
    key: "partyType",
    label: "Party Type",
    type: "select",
    options: ["DEBITOR", "CREDITOR", "ECOMMERCE"],
  },
  {
    key: "paymentType",
    label: "Payment Term",
    type: "select",
    options: ["CASH", "CREDIT"],
  },
  { key: "creditDays", label: "Credit Period", type: "number" },
  { key: "creditLimit", label: "Amount Limit", type: "number" },
  { key: "salespersonId", label: "Salesperson ID" },
];
const bulkUploadFields = [
  { key: "legalName", label: "Company Name", example: "ABC Traders" },
  { key: "tradeName", label: "Trade Name" },
  { key: "gstin", label: "GSTIN", example: "18AKRPJ2121L2ZX" },
  { key: "pan", label: "Company PAN", example: "AKRPJ2121L" },
  {
    key: "partyType",
    label: "Party Type",
    type: "select",
    options: ["DEBITOR", "CREDITOR", "ECOMMERCE"],
  },
  {
    key: "registrationType",
    label: "Registration Type",
    type: "select",
    options: ["UNKNOWN", "REGULAR", "COMPOSITION", "UNREGISTERED"],
  },
  { key: "ownerName", label: "Owner Name" },
  { key: "ownerMobile", label: "Owner Mobile" },
  { key: "ownerPan", label: "Owner PAN" },
  { key: "ownerAadhaar", label: "Owner Aadhaar" },
  { key: "ownerPincode", label: "Owner Pincode" },
  { key: "ownerAddress", label: "Owner Address" },
  { key: "email", label: "Email" },
  { key: "companyContactNumber", label: "Contact Number" },
  { key: "pincode", label: "Company Pincode", example: "781001" },
  { key: "address", label: "Address 1" },
  { key: "address2", label: "Address 2" },
  { key: "dealsInProducts", label: "Deals in Product" },
  { key: "annualTurnover", label: "Annual Turnover", type: "number" },
  { key: "shopSize", label: "Shop Size" },
  { key: "category", label: "Category" },
  {
    key: "paymentType",
    label: "Payment Term",
    type: "select",
    options: ["CASH", "CREDIT"],
  },
  { key: "dueDate", label: "Due Date" },
  { key: "creditDays", label: "Credit Period", type: "number" },
  { key: "creditLimit", label: "Amount Limit", type: "number" },
  { key: "graceDays", label: "Grace Days", type: "number" },
  { key: "assignedTransport", label: "Assigned Transport" },
  { key: "serviceArea", label: "Service Area" },
  { key: "salespersonId", label: "Salesperson ID" },
  { key: "gradeCode", label: "Customer Grade" },
  { key: "gradeDiscountPct", label: "Grade Discount %", type: "number" },
  { key: "priceList", label: "Price List" },
  { key: "openingBalance", label: "Opening Balance", type: "number" },
  {
    key: "openingBalanceType",
    label: "Balance Type",
    type: "select",
    options: ["DR", "CR"],
  },
  { key: "financialYear", label: "Opening Financial Year", example: "2026-27" },
];
const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const saveCsv = (fields, rows, fileName) => {
  const header = fields.map((f) => csvCell(f.label || f.key)).join(",");
  const lines = rows.map((row) =>
    fields.map((f) => csvCell(row?.[f.key] ?? "")).join(","),
  );
  const blob = new Blob([`\uFEFF${[header, ...lines].join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};
const firstValue = (items = []) => {
  const row =
    (items || []).find((x) => x?.primary && x?.value) ||
    (items || []).find((x) => x?.value) ||
    (items || [])[0];
  return row?.value || "";
};
const dateText = (v) => (v ? String(v).slice(0, 10) : "");
const customerBulkErrors = (row) => {
  const errors = [];
  if (!String(row?.legalName || "").trim())
    errors.push("Company Name is required");
  if (
    !String(row?.gstin || "").trim() &&
    !String(row?.pan || "").trim() &&
    !String(row?.ownerPan || "").trim() &&
    !digits(row?.ownerAadhaar)
  )
    errors.push("GSTIN, Company PAN, Owner PAN or Owner Aadhaar is required");
  if (row?._serverError) errors.push(String(row._serverError));
  return errors;
};
const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const normalizeBulkBank = (item) => ({
  ...emptyBank(),
  ...(item || {}),
  ifsc: normalizeIfsc(item?.ifsc || item?.Ifsc_code || ""),
  bankName: item?.bankName || item?.Bank_Name || "",
  accountName: item?.accountName || item?.Account_Name || "",
  accountNumber: item?.accountNumber || item?.Account_No || "",
});
const bulkRowToFullForm = (row) => {
  const banks = parseJsonArray(row?.bankDetails).map(normalizeBulkBank);
  const next = {
    ...blankCustomer(),
    ...row,
    sourceRow: row?.sourceRow,
    bankDetails: banks.length ? banks : [emptyBank()],
  };
  next.partyType = String(next.partyType || "DEBITOR").toUpperCase();
  if (next.partyType === "1") next.partyType = "DEBITOR";
  next.registrationType = String(
    next.registrationType || "UNKNOWN",
  ).toUpperCase();
  if (next.registrationType === "0") next.registrationType = "REGULAR";
  next.paymentType =
    String(next.paymentType || "CASH").toUpperCase() === "CREDIT"
      ? "CREDIT"
      : "CASH";
  next.openingBalanceType = String(next.openingBalanceType || "DR")
    .toUpperCase()
    .startsWith("C")
    ? "CR"
    : "DR";
  next.ownerAadhaar = digits(next.ownerAadhaar).slice(0, 12);
  next.pincode = digits(next.pincode).slice(0, 6);
  next.ownerPincode = digits(next.ownerPincode).slice(0, 6);
  next.financialYear = next.financialYear || currentFY();
  return next;
};

const canApprove = (u) =>
  ["MASTER", "SUPERADMIN"].includes(String(u?.role || "").toUpperCase()) ||
  (u?.permissions || []).includes("*") ||
  (u?.permissions || []).includes("customers.approve");

export default function CustomerPage({
  approvalsOnly = false,
  embedded = false,
  autoOpenCreate = false,
}) {
  const user = getUser();
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [meta, setMeta] = useState({ pages: 1, total: 0 }),
    [selected, setSelected] = useState([]),
    [msg, setMsg] = useState(""),
    [deletingAll, setDeletingAll] = useState(false),
    [downloadingData, setDownloadingData] = useState(false);
  const isSuperAdmin = String(user?.role || "").toUpperCase() === "SUPERADMIN";
  const bulkUploadInput = useRef(null);
  const [bulkReview, setBulkReview] = useState(null),
    [bulkStage, setBulkStage] = useState("QUICK"),
    [bulkBusy, setBulkBusy] = useState(false),
    [bulkNotice, setBulkNotice] = useState("");
  const [show, setShow] = useState(false),
    [edit, setEdit] = useState(null),
    [form, setForm] = useState(blankCustomer()),
    [companyAreas, setCompanyAreas] = useState([]),
    [ownerAreas, setOwnerAreas] = useState([]),
    [assignment, setAssignment] = useState({
      users: [],
      requiresSelection: false,
      autoUserId: "",
    }),
    [grades, setGrades] = useState([]),
    [transporters, setTransporters] = useState([]),
    [transporterMatches, setTransporterMatches] = useState([]),
    [transporterBusy, setTransporterBusy] = useState(false),
    [review, setReview] = useState(null),
    [view360, setView360] = useState(null),
    [fy, setFy] = useState(currentFY()),
    [firmLocation, setFirmLocation] = useState(() => ({
      city: user?.companyProfile?.city || "",
      state: user?.companyProfile?.state || "",
      pincode: user?.companyProfile?.pincode || "",
    }));
  const pageAccess = accessForPath(
    typeof window !== "undefined" ? window.location.pathname : "/dms/customers",
  );
  const canDeleteCustomers =
    ["MASTER", "SUPERADMIN"].includes(String(user?.role || "").toUpperCase()) ||
    Boolean(pageAccess?.delete);
  const transportRequired = needsTransport(form.city, firmLocation.city);
  const deliveryMode = !form.city
    ? "PENDING"
    : transportRequired
      ? "OUTSIDE"
      : "LOCAL";
  const endpoint = approvalsOnly ? "/customers/approvals" : "/customers";
  const load = async (next = page) => {
    try {
      const d = await api(
        `${endpoint}?q=${encodeURIComponent(q)}&page=${next}&limit=50`,
      );
      setRows(d.items || []);
      setMeta(d.meta || { pages: 1, total: 0 });
      setPage(d.meta?.page || next);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const downloadCustomerData = async () => {
    if (!isSuperAdmin) return;
    setDownloadingData(true);
    setMsg("");
    try {
      const file = await apiBlob("/customers/export-data.xlsx");
      const blob = file?.blob instanceof Blob ? file.blob : file;
      if (!(blob instanceof Blob))
        throw new Error("Invalid customer export response");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMsg(
        "Customer data downloaded in Excel template format. Mobile columns are stored as Text so Excel will not change the digits.",
      );
    } catch (e) {
      setMsg(e.message);
    } finally {
      setDownloadingData(false);
    }
  };
  const loadTransporters = () =>
    api("/operations/transporters?limit=200")
      .then((d) => setTransporters(d.items || []))
      .catch(() => setTransporters([]));
  const loadTransportMatches = async (target = form) => {
    if (!needsTransport(target.city, firmLocation.city)) {
      setTransporterMatches([]);
      return [];
    }
    const pin = digits(target.pincode).slice(0, 6);
    if (pin.length !== 6 && !target.city && !target.state) return [];
    setTransporterBusy(true);
    try {
      const d = await api(
        `/operations/transporters/service-match?pincode=${encodeURIComponent(pin)}&city=${encodeURIComponent(target.city || "")}&state=${encodeURIComponent(target.state || "")}`,
      );
      const items = d.items || [];
      setTransporterMatches(items);
      return items;
    } catch (e) {
      setMsg(e.message);
      setTransporterMatches([]);
      return [];
    } finally {
      setTransporterBusy(false);
    }
  };
  const selectTransportMatch = async (value, source = transporterMatches) => {
    try {
      if (!value) {
        setForm((f) => ({
          ...f,
          assignedTransport: "",
          assignedTransportGlobalId: "",
          assignedTransportBookingStationId: "",
          assignedTransportDeliveryStationId: "",
          serviceArea: "",
        }));
        return;
      }
      const match = (source || []).find(
        (x) => String(x.globalTransporterId) === String(value),
      );
      if (!match) return;
      let localId = match.localTransporterId;
      if (!localId) {
        const saved = await api(
          `/operations/transporters/import-global/${match._id}`,
          { method: "POST" },
        );
        localId = saved?._id || "";
        await loadTransporters();
      }
      const delivery = (match.deliveryStations || [])[0];
      const booking = (match.bookingStations || [])[0];
      setForm((f) => ({
        ...f,
        assignedTransport: String(localId || ""),
        assignedTransportGlobalId: match.globalTransporterId || "",
        assignedTransportDeliveryStationId: delivery?.stationId || "",
        assignedTransportBookingStationId: booking?.stationId || "",
        serviceArea: delivery?.name || delivery?.city || f.serviceArea,
      }));
    } catch (e) {
      setMsg(e.message);
    }
  };
  useEffect(() => {
    load(1);
    api("/catalog/grades?limit=200&status=ACTIVE")
      .then((d) => setGrades(d.items || []))
      .catch(() => {});
    loadTransporters();
    api("/company/profile")
      .then((d) =>
        setFirmLocation({
          city: d?.city || "",
          state: d?.state || "",
          pincode: d?.pincode || "",
        }),
      )
      .catch(() => {});
  }, [approvalsOnly]);
  useEffect(() => {
    if (!form.city) return;
    const mode = needsTransport(form.city, firmLocation.city)
      ? "OUTSIDE"
      : "LOCAL";
    setForm((f) => {
      if (
        f.regionType === mode &&
        (mode !== "LOCAL" ||
          (!f.assignedTransport &&
            !f.assignedTransportGlobalId &&
            !f.assignedTransportBookingStationId &&
            !f.assignedTransportDeliveryStationId))
      )
        return f;
      return {
        ...f,
        regionType: mode,
        ...(mode === "LOCAL"
          ? {
              assignedTransport: "",
              assignedTransportGlobalId: "",
              assignedTransportBookingStationId: "",
              assignedTransportDeliveryStationId: "",
              serviceArea: f.city || f.serviceArea,
            }
          : {}),
      };
    });
    if (mode === "OUTSIDE" && (digits(form.pincode).length === 6 || form.city))
      loadTransportMatches({ ...form, regionType: mode });
    else setTransporterMatches([]);
  }, [form.pincode, form.city, form.state, firmLocation.city]);
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const applyCustomerScan = async (values) => {
    const bank = {
      ...emptyBank(),
      ...(form.bankDetails?.[0] || {}),
      ifsc: values.ifsc || form.bankDetails?.[0]?.ifsc || "",
      accountNumber:
        values.accountNumber || form.bankDetails?.[0]?.accountNumber || "",
      accountName:
        values.accountName || form.bankDetails?.[0]?.accountName || "",
      bankName: values.bankName || form.bankDetails?.[0]?.bankName || "",
      bankAddress:
        values.bankAddress || form.bankDetails?.[0]?.bankAddress || "",
    };
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(
        Object.entries(values).filter(
          ([k]) =>
            ![
              "ifsc",
              "accountNumber",
              "accountName",
              "bankName",
              "bankAddress",
              "items",
            ].includes(k),
        ),
      ),
      bankDetails: [bank, ...(f.bankDetails || []).slice(1)],
    }));
    if (values.pincode)
      setTimeout(() => lookupPincode("company", values.pincode), 0);
    if (values.ifsc) setTimeout(() => lookupIfsc(0, values.ifsc), 50);
  };

  const downloadCustomerBulkTemplate = () => {
    const header = bulkUploadFields.map((f) => csvCell(f.label)).join(",");
    const sample = bulkUploadFields
      .map((f) => csvCell(f.example ?? ""))
      .join(",");
    const blob = new Blob([`\uFEFF${header}\n${sample}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "customers-bulk-review-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const previewCustomerBulk = async (file) => {
    if (!file) return;
    setBulkBusy(true);
    setBulkNotice("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api("/customers/bulk-preview", {
        method: "POST",
        body: fd,
      });
      setBulkReview({
        ...data,
        fileName: file.name,
        rows: (data.rows || []).map((r) => ({
          ...r,
          _errors: customerBulkErrors(r),
        })),
      });
      setBulkStage("QUICK");
      setBulkNotice(
        `${data.received || 0} customer row(s) loaded for quick review. Empty cells are allowed at this stage.`,
      );
    } catch (e) {
      setBulkNotice(e.message);
    } finally {
      setBulkBusy(false);
      if (bulkUploadInput.current) bulkUploadInput.current.value = "";
    }
  };
  const updateBulkReviewRow = (index, key, value) =>
    setBulkReview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [key]: value };
        delete next._serverError;
        return next;
      });
      return { ...prev, rows };
    });
  const replaceBulkReviewRow = (index, nextRow) =>
    setBulkReview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((row, i) =>
              i === index
                ? { ...row, ...nextRow, _serverError: undefined }
                : row,
            ),
          }
        : prev,
    );
  const removeBulkReviewRow = (index) =>
    setBulkReview((prev) =>
      prev ? { ...prev, rows: prev.rows.filter((_, i) => i !== index) } : prev,
    );
  const applyBulkReviewValue = (key, value) =>
    setBulkReview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((row) => {
              const next = { ...row, [key]: value };
              delete next._serverError;
              return next;
            }),
          }
        : prev,
    );
  const continueToFullBulkReview = () => {
    setBulkReview((prev) =>
      prev ? { ...prev, rows: (prev.rows || []).map(bulkRowToFullForm) } : prev,
    );
    setBulkStage("FULL");
    setBulkNotice(
      "Full customer forms are ready. Expand each customer to review every Create Customer field before Final Import.",
    );
  };
  const commitCustomerBulk = async () => {
    if (!bulkReview?.rows?.length) return;
    setBulkBusy(true);
    setBulkNotice("");
    try {
      const data = await api("/customers/bulk-commit", {
        method: "POST",
        body: JSON.stringify({ rows: bulkReview.rows }),
      });
      await load(1);
      if (data.invalid > 0) {
        setBulkReview({
          ...bulkReview,
          received: data.rejectedRows?.length || 0,
          rows: (data.rejectedRows || []).map((r) =>
            bulkRowToFullForm({
              ...r,
              _serverError:
                r.error || r._errors?.[0] || "Import validation failed",
            }),
          ),
        });
        setBulkStage("FULL");
        setBulkNotice(
          `${data.inserted || 0} inserted • ${data.updated || 0} updated • ${data.invalid || 0} row(s) remain in the full-form review for correction.`,
        );
      } else {
        setBulkReview(null);
        setBulkStage("QUICK");
        setBulkNotice(
          `${data.inserted || 0} inserted • ${data.updated || 0} updated. Bulk import completed.`,
        );
      }
    } catch (e) {
      setBulkNotice(e.message);
    } finally {
      setBulkBusy(false);
    }
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

  const loadAssignment = async (pin) => {
    const p = digits(pin).slice(0, 6);
    if (p.length !== 6) {
      setAssignment({ users: [], requiresSelection: false, autoUserId: "" });
      return;
    }
    const a = await api(`/access/assignment-options?pincode=${p}`).catch(
      () => ({ users: [], requiresSelection: false, autoUserId: "" }),
    );
    setAssignment(a || { users: [], requiresSelection: false, autoUserId: "" });
    setForm((f) => ({
      ...f,
      salespersonId:
        a?.autoUserId ||
        ((a?.users || []).some((u) => String(u._id) === String(f.salespersonId))
          ? f.salespersonId
          : ""),
    }));
    if (!(a?.users || []).length) {
      const text = `Pincode ${p} is not assigned to any Sales Person. Assign the pincode first, then create the customer.`;
      setMsg(text);
      window.alert?.(text);
    }
    return a;
  };
  const lookupPincode = async (kind, raw) => {
    const p = digits(raw).slice(0, 6);
    setForm((f) => ({
      ...f,
      [kind === "owner" ? "ownerPincode" : "pincode"]: p,
    }));
    if (p.length !== 6) return;
    try {
      const r = await api(`/access/pincode-lookup/${p}`);
      const areas = r.alternatives?.length ? r.alternatives : [r];
      const first = areas[0] || r;
      if (kind === "owner") {
        setOwnerAreas(areas);
        setForm((f) => ({
          ...f,
          ownerPincode: p,
          ownerArea: first.area || "",
          ownerCity: first.city || first.area || r.city || "",
          ownerDistrict: first.district || r.district || "",
          ownerState: first.state || r.state || "",
        }));
      } else {
        setCompanyAreas(areas);
        setForm((f) => ({
          ...f,
          pincode: p,
          area: first.area || "",
          city: first.city || first.area || r.city || "",
          district: first.district || r.district || "",
          state: first.state || r.state || "",
          serviceArea: f.serviceArea || first.area || "",
        }));
        await loadAssignment(p);
      }
    } catch (e) {
      setMsg(e.message);
    }
  };
  const selectArea = (kind, value) => {
    const rows = kind === "owner" ? ownerAreas : companyAreas;
    const x = rows.find((a) => a.area === value);
    if (kind === "owner")
      setForm((f) => ({
        ...f,
        ownerArea: value,
        ownerCity: x?.city || value,
        ownerDistrict: x?.district || f.ownerDistrict,
        ownerState: x?.state || f.ownerState,
      }));
    else
      setForm((f) => ({
        ...f,
        area: value,
        city: x?.city || value,
        district: x?.district || f.district,
        state: x?.state || f.state,
        serviceArea: f.serviceArea || value,
      }));
  };
  const searchGst = async () => {
    try {
      const gstin = String(form.gstin || "")
        .trim()
        .toUpperCase();
      if (gstin.length !== 15)
        throw new Error("Enter a valid 15-character GSTIN");
      const r = await api(
        `/reference/gst/search?gstin=${encodeURIComponent(gstin)}`,
      );
      const p = digits(r.pincode || form.pincode).slice(0, 6);
      setForm((f) => ({
        ...f,
        gstin: r.gstin || gstin,
        pan: f.pan || r.pan || "",
        legalName: r.legalName || r.tradeName || f.legalName,
        address: r.principalAddress || r.address || f.address,
        pincode: p || f.pincode,
        registrationType: "REGULAR",
      }));
      if (p.length === 6) await lookupPincode("company", p);
      setMsg("GST details loaded");
    } catch (e) {
      setMsg(e.message);
    }
  };
  const captureGeo = () =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) =>
            change("geotagging", `${p.coords.latitude},${p.coords.longitude}`),
          (e) => setMsg(e.message),
          { enableHighAccuracy: true },
        )
      : setMsg("Geolocation not supported");

  const openCreate = () => {
    setEdit(null);
    setForm(blankCustomer());
    setCompanyAreas([]);
    setOwnerAreas([]);
    setAssignment({ users: [], requiresSelection: false, autoUserId: "" });
    setTransporterMatches([]);
    setShow(true);
    setMsg("");
  };
  const openCreateFromLead = async (leadId) => {
    try {
      const d = await api(
        `/leads/${encodeURIComponent(leadId)}/conversion-prefill`,
      );
      const p = d?.prefill || {};
      const next = {
        ...blankCustomer(),
        ...p,
        sourceLeadId: leadId,
        ownerMobile: p.ownerMobile || p.mobile || "",
        companyContactNumber: p.mobile || "",
        dealsInProducts: p.dealsInProducts || "",
      };
      setEdit(null);
      setForm(next);
      setCompanyAreas([]);
      setOwnerAreas([]);
      setTransporterMatches([]);
      setShow(true);
      setMsg(`Customer onboarding from Lead ${leadId}`);
      if (next.pincode) await lookupPincode("company", next.pincode);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const openEdit = async (row) => {
    try {
      const d = await api(`/customers/${row.globalCustomerId}`);
      const c = d.company || {},
        g = d.global || {},
        contact = c.contacts?.find((x) => x.primary) || c.contacts?.[0] || {},
        a =
          c.addresses?.find((x) => x.type === "BILLING") ||
          c.addresses?.[0] ||
          {};
      const next = {
        ...blankCustomer(),
        ownerName: c.ownerName || contact.name || "",
        ownerMobile: c.ownerMobile || contact.mobile || "",
        ownerAadhaarMasked: c.ownerAadhaarMasked || g.aadhaarMasked || "",
        ownerPan: c.ownerPan || "",
        ownerPincode: c.ownerPincode || "",
        ownerArea: c.ownerArea || "",
        ownerCity: c.ownerCity || "",
        ownerDistrict: c.ownerDistrict || "",
        ownerState: c.ownerState || "",
        ownerAddress: c.ownerAddress || "",
        legalName: c.localName || g.legalName || "",
        partyType: c.partyType || "DEBITOR",
        registrationType: c.registrationType || "UNKNOWN",
        gstin: g.gstins?.[0]?.value || "",
        pan: g.pan || "",
        email: contact.email || "",
        dealsInProducts: c.dealsInProducts || "",
        annualTurnover: c.annualTurnover || 0,
        address: a.address || g.registeredAddress || "",
        address2: c.address2 || "",
        companyContactNumber: c.companyContactNumber || contact.mobile || "",
        pincode: a.pincode || "",
        area: a.area || "",
        city: a.city || "",
        district: a.district || "",
        state: a.state || "",
        shopSize: c.shopSize || "",
        regionType: c.regionType || "LOCAL",
        paymentType: c.paymentType || "CASH",
        creditDays: c.creditDays || 0,
        creditLimit: c.creditLimit || 0,
        graceDays: c.graceDays || 0,
        assignedTransport: c.assignedTransport || "",
        assignedTransportGlobalId: c.assignedTransportGlobalId || "",
        assignedTransportBookingStationId:
          c.assignedTransportBookingStationId || "",
        assignedTransportDeliveryStationId:
          c.assignedTransportDeliveryStationId || "",
        serviceArea: c.serviceArea || "",
        salespersonId: c.salespersonId || "",
        priceList: c.priceList || "STANDARD",
        gradeCode: c.gradeCode || "",
        gradeDiscountPct: c.gradeDiscountPct || 0,
        geotagging: c.location?.latitude
          ? `${c.location.latitude},${c.location.longitude}`
          : "",
        portalLoginEnabled: Boolean(c.portalLoginEnabled),
        bankDetails: c.bankDetails?.length
          ? c.bankDetails.map((b) => ({ ...emptyBank(), ...b }))
          : [emptyBank()],
        financialYear: c.accountingProfile?.financialYear || currentFY(),
        openingBalance: c.accountingProfile?.openingBalance || 0,
        openingBalanceType: c.accountingProfile?.openingBalanceType || "DR",
      };
      setForm(next);
      setEdit(row);
      setShow(true);
      if (next.pincode) await lookupPincode("company", next.pincode);
      if (next.ownerPincode) await lookupPincode("owner", next.ownerPincode);
    } catch (e) {
      setMsg(e.message);
    }
  };
  useEffect(() => {
    if (approvalsOnly) return;
    const lookupEditId = getLookupEditId();
    const leadId = new URLSearchParams(window.location.search).get("leadId");
    if (lookupEditId) openEdit({ globalCustomerId: lookupEditId });
    else if (leadId) openCreateFromLead(leadId);
    else if (autoOpenCreate) openCreate();
  }, [autoOpenCreate, approvalsOnly]);
  const addBank = () =>
    setForm((f) => ({ ...f, bankDetails: [...f.bankDetails, emptyBank()] }));
  const updateBank = (i, k, v) =>
    setForm((f) => ({
      ...f,
      bankDetails: f.bankDetails.map((b, n) =>
        n === i ? { ...b, [k]: v } : b,
      ),
    }));
  const removeBank = (i) =>
    setForm((f) => ({
      ...f,
      bankDetails: f.bankDetails.filter((_, n) => n !== i),
    }));
  const lookupIfsc = async (i, raw) => {
    try {
      const code = normalizeIfsc(raw ?? form.bankDetails?.[i]?.ifsc);
      const row = await lookupIfscMaster(code);
      const auto = bankFieldsFromIfsc(row);
      setForm((f) => ({
        ...f,
        bankDetails: f.bankDetails.map((b, n) =>
          n === i ? { ...b, ...auto } : b,
        ),
      }));
      setMsg(`Bank details loaded from MASTER for ${code}`);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const changeBankIfsc = (i, value) => {
    const code = normalizeIfsc(value).slice(0, 11);
    updateBank(i, "ifsc", code);
    if (code.length === 11) lookupIfsc(i, code);
  };

  const save = async () => {
    try {
      const migratedEdit = Boolean(edit?.migration?.legacyId);
      if (!form.legalName.trim())
        throw new Error("Company / Customer Name is required");

      // New V2 records keep the strict onboarding rules. Previous-DMS customers are
      // already usable and may be completed one field at a time without blocking Save.
      if (
        !edit &&
        !form.gstin &&
        !form.pan &&
        !form.ownerPan &&
        !form.ownerAadhaar
      )
        throw new Error(
          "GSTIN, Company PAN, Owner PAN or Owner Aadhaar is required",
        );
      const pin = digits(form.pincode).slice(0, 6);
      if (!migratedEdit && pin.length !== 6)
        throw new Error("Enter a valid 6-digit company pincode");
      if (migratedEdit && form.pincode && pin.length !== 6)
        throw new Error("Company pincode must contain 6 digits when entered");

      const hasFirmCity = Boolean(cityKey(firmLocation.city));
      if (!migratedEdit && !hasFirmCity)
        throw new Error(
          "Set the firm's City in Company Profile before creating customers",
        );
      const nonLocal = Boolean(
        hasFirmCity &&
        form.city &&
        needsTransport(form.city, firmLocation.city),
      );
      if (!migratedEdit && nonLocal && !form.assignedTransportGlobalId)
        throw new Error(
          `Assign a transporter serving ${form.city || form.pincode} before saving this customer`,
        );
      if (!migratedEdit && nonLocal && !form.assignedTransport)
        throw new Error(
          "Selected transporter is not linked to the company transporter master",
        );
      if (!migratedEdit && nonLocal && !form.assignedTransportDeliveryStationId)
        throw new Error(
          `Select a delivery station serving ${form.city || form.pincode}`,
        );

      for (const bank of form.bankDetails.filter(
        (b) => b.accountNumber || b.accountName || b.ifsc || b.bankName,
      )) {
        // Old DMS may have account data without IFSC. Do not block unrelated profile
        // updates; if IFSC is entered, however, it must be valid.
        if (
          bank.ifsc &&
          !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(bank.ifsc))
        )
          throw new Error("Entered IFSC must be valid");
        if (!migratedEdit && !bank.ifsc)
          throw new Error("IFSC code is mandatory for every bank account");
      }

      if (!migratedEdit) {
        if (!(assignment.users || []).length)
          throw new Error(
            `Pincode ${form.pincode} is not assigned to any Sales Person. Assign the pincode first, then create the customer.`,
          );
        if (assignment.requiresSelection && !form.salespersonId)
          throw new Error("Select a Sales Person assigned to this pincode");
      }

      const payload = {
        ...form,
        regionType:
          hasFirmCity && form.city
            ? nonLocal
              ? "OUTSIDE"
              : "LOCAL"
            : form.regionType || "LOCAL",
        priceList: "STANDARD",
        aadhaar: digits(form.ownerAadhaar),
        mobile: form.companyContactNumber || form.ownerMobile,
        addresses: [
          {
            type: "BILLING",
            address: form.address,
            pincode: pin || form.pincode,
            area: form.area,
            city: form.city,
            district: form.district,
            state: form.state,
          },
        ],
        contacts: [
          {
            name: form.ownerName,
            mobile: form.companyContactNumber || form.ownerMobile,
            email: form.email,
            primary: true,
          },
        ],
        accountingProfile: {
          systemAccountCode:
            form.partyType === "CREDITOR"
              ? "SYS_SUNDRY_CREDITORS"
              : "SYS_SUNDRY_DEBTORS",
          ledgerName: `${form.legalName} A/c`,
          openingBalance: Number(form.openingBalance || 0),
          openingBalanceType: form.openingBalanceType,
          financialYear: form.financialYear,
        },
        bankDetails: form.bankDetails.filter(
          (b) => b.bankName || b.accountNumber || b.ifsc,
        ),
      };
      if (!payload.password) delete payload.password;
      const d = await api(
        edit ? `/customers/${edit.globalCustomerId}` : "/customers",
        { method: edit ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      setMsg(
        d?.message ||
          (!edit && String(user?.role).toUpperCase() === "SUPERADMIN"
            ? "Customer created and activated"
            : "Customer saved"),
      );
      setShow(false);
      setEdit(null);
      await load(1);
      if (isLookupCreate() || getLookupEditId())
        notifyLookupCreated("customer", {
          id: d?.globalCustomerId || d?._id || edit?.globalCustomerId,
          name: d?.localName || form.legalName,
        });
    } catch (e) {
      setMsg(e.message);
    }
  };
  const deleteCustomer = async (r) => {
    if (!canDeleteCustomers)
      return setMsg("You do not have Delete permission for Customers");
    if (
      !confirm(
        `Delete ${r.localName} from the active customer list?\n\nCustomers already used in invoices, receipts, payments or ledger are protected automatically.`,
      )
    )
      return;
    try {
      const d = await api(`/customers/${r.globalCustomerId}`, {
        method: "DELETE",
        body: JSON.stringify({ remarks: "Deleted from customer master" }),
      });
      setSelected((x) =>
        x.filter((id) => String(id) !== String(r.globalCustomerId)),
      );
      setMsg(d?.message || "Customer deleted from active list");
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
      await load(nextPage);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const deleteAllCustomers = async () => {
    if (!canDeleteCustomers)
      return setMsg("You do not have Delete permission for Customers");
    if (
      !confirm(
        `DELETE ALL active customers accessible to you?\n\nThis applies to the full Customer Master, not only the current page or search result.\n\nV2 will safely delete/deactivate customers that have no transaction history. Customers used in invoices, receipts, payments or ledger will be protected and skipped.`,
      )
    )
      return;
    setDeletingAll(true);
    try {
      const d = await api("/customers/delete-all", {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      const protectedCount = Number(d?.protected || 0);
      const sample = (d?.protectedCustomers || [])
        .slice(0, 8)
        .map((x) => x.name)
        .filter(Boolean);
      setMsg(
        `${d?.message || "Delete All completed"}${protectedCount && sample.length ? ` • Protected: ${sample.join(", ")}${protectedCount > sample.length ? "…" : ""}` : ""}`,
      );
      setSelected([]);
      await load(1);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setDeletingAll(false);
    }
  };
  const open360 = async (r) => {
    try {
      setView360(
        await api(
          `/customers/${r.globalCustomerId}/360?financialYear=${encodeURIComponent(fy)}`,
        ),
      );
    } catch (e) {
      setMsg(e.message);
    }
  };
  const reviewCustomer = async (r) => {
    try {
      const d = await api(`/customers/${r.globalCustomerId}`);
      setReview({ ...d.company, global: d.global });
    } catch (e) {
      setMsg(e.message);
    }
  };
  const approval = async (action) => {
    try {
      await api(`/customers/${review.globalCustomerId}/approval`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setReview(null);
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  if (show && !approvalsOnly)
    return (
      <>
        {form.sourceLeadId && (
          <div className="resultBanner good">
            Converting Sales Lead <strong>{form.sourceLeadId}</strong> →
            complete customer details → submit for verification → customer
            becomes ACTIVE only after approval.
          </div>
        )}
        {msg && <div className="resultBanner bad">{msg}</div>}
        <section className="panel">
          <div className="formTitle">
            <div>
              <h3>{edit ? "Edit Customer" : "Create Customer"}</h3>
              <span>Full old-DMS customer form in one page. No tabs.</span>
            </div>
            <div className="formTitleActions">
              <ScanAndFill
                documentType="CUSTOMER"
                targetPath="/dms/customers"
                onApply={applyCustomerScan}
              />
              <button className="iconBtn" onClick={() => setShow(false)}>
                <X />
              </button>
            </div>
          </div>
        </section>
        <style>{`
   .customerCreateColumns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start;margin-bottom:16px}
   .customerCreateColumn{display:flex;flex-direction:column;gap:16px;min-width:0}
   .customerCreateColumn>.panel{margin:0}
   @media(max-width:1100px){.customerCreateColumns{grid-template-columns:1fr}}
  `}</style>
        <div className="customerCreateColumns">
          <div className="customerCreateColumn">
            <section className="panel">
              <div className="sectionLabel">Company Information</div>
              <div className="formGrid">
                <label>
                  GSTIN *
                  <div className="gstInputRow">
                    <input
                      autoFocus
                      value={form.gstin}
                      onChange={(e) =>
                        change("gstin", e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => e.key === "Enter" && searchGst()}
                      maxLength={15}
                    />
                    <button
                      type="button"
                      className="gstLookupButton iconOnlyLookup"
                      onClick={searchGst}
                      title="Search GST"
                      aria-label="Search GST"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </label>
                <label>
                  Company / Customer Name *
                  <input
                    value={form.legalName}
                    onChange={(e) => change("legalName", e.target.value)}
                  />
                </label>
                <label>
                  Party Type
                  <select
                    value={form.partyType}
                    onChange={(e) => change("partyType", e.target.value)}
                  >
                    <option>DEBITOR</option>
                    <option>CREDITOR</option>
                    <option>ECOMMERCE</option>
                  </select>
                </label>
                <label>
                  Registration Type
                  <select
                    value={form.registrationType}
                    onChange={(e) => change("registrationType", e.target.value)}
                  >
                    <option>UNKNOWN</option>
                    <option>REGULAR</option>
                    <option>COMPOSITION</option>
                    <option>UNREGISTERED</option>
                  </select>
                </label>
                <label>
                  Company PAN
                  <input
                    value={form.pan}
                    onChange={(e) =>
                      change("pan", e.target.value.toUpperCase())
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    value={form.email}
                    onChange={(e) => change("email", e.target.value)}
                  />
                </label>
                <label>
                  Deals in Products
                  <input
                    value={form.dealsInProducts}
                    onChange={(e) => change("dealsInProducts", e.target.value)}
                  />
                </label>
                <label>
                  Annual Turnover
                  <input
                    type="number"
                    value={form.annualTurnover}
                    onChange={(e) => change("annualTurnover", e.target.value)}
                  />
                </label>
                <label>
                  Contact Number
                  <input
                    value={form.companyContactNumber}
                    onChange={(e) =>
                      change("companyContactNumber", e.target.value)
                    }
                  />
                </label>
                <label>
                  Shop Size
                  <input
                    value={form.shopSize}
                    onChange={(e) => change("shopSize", e.target.value)}
                  />
                </label>
                <label>
                  Delivery Mode (Auto)
                  <input
                    readOnly
                    value={
                      deliveryMode === "PENDING"
                        ? "Enter Pincode / City"
                        : deliveryMode === "LOCAL"
                          ? `LOCAL — ${firmLocation.city}`
                          : `TRANSPORT — ${firmLocation.city} → ${form.city}`
                    }
                  />
                  <small>
                    GST locality is separate; transport is based on city.
                  </small>
                </label>
                <label>
                  Pincode *
                  <input
                    value={form.pincode}
                    onChange={(e) => lookupPincode("company", e.target.value)}
                    maxLength={6}
                  />
                </label>
                <label>
                  Area / Post Office *
                  {companyAreas.length > 1 ? (
                    <select
                      value={form.area}
                      onChange={(e) => selectArea("company", e.target.value)}
                    >
                      <option value="">Select Area</option>
                      {companyAreas.map((a, i) => (
                        <option key={`${a.area}-${i}`} value={a.area}>
                          {a.area}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={form.area} readOnly />
                  )}
                </label>
                <label>
                  City
                  <input value={form.city} readOnly />
                </label>
                <label>
                  District
                  <input value={form.district} readOnly />
                </label>
                <label>
                  State
                  <input value={form.state} readOnly />
                </label>
                <label>
                  Address 1
                  <textarea
                    value={form.address}
                    onChange={(e) => change("address", e.target.value)}
                  />
                </label>
                <label>
                  Address 2
                  <textarea
                    value={form.address2}
                    onChange={(e) => change("address2", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <div className="sectionLabel">Assignment</div>
              {form.pincode && !(assignment.users || []).length ? (
                <div className="resultBanner bad">
                  Pincode <b>{form.pincode}</b> is not assigned to any Sales
                  Person. Go to User creation / Sales Person pincode assignment
                  first, assign this pincode, then create the customer.
                </div>
              ) : (
                <div className="formGrid">
                  <label>
                    Assigned Sales Person *
                    <div className="lookupSelectRow">
                      <select
                        value={form.salespersonId}
                        onChange={(e) =>
                          change("salespersonId", e.target.value)
                        }
                      >
                        <option value="">Select Sales Person</option>
                        {(assignment.users || []).map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name} — {u.departmentName || "Sales"}
                          </option>
                        ))}
                      </select>
                      <CreateLookupButton
                        to="/dms/users"
                        label="Create"
                        resource="user"
                        selectedValue={form.salespersonId}
                        onReturn={() =>
                          form.pincode && loadAssignment(form.pincode)
                        }
                      />
                    </div>
                  </label>
                  <label>
                    Assignment Pincode
                    <input value={form.pincode} readOnly />
                  </label>
                </div>
              )}
              {assignment.requiresSelection && (
                <div className="resultBanner good">
                  Multiple Sales Persons are assigned to this pincode. Select
                  the correct salesperson for this customer.
                </div>
              )}
            </section>
            <section className="panel">
              <div className="sectionLabel">Bank Accounts — IFSC First</div>
              {form.bankDetails.map((b, i) => (
                <div key={i} className="subCard" style={{ marginBottom: 12 }}>
                  <div className="formGrid">
                    <label>
                      IFSC Code *
                      <div className="bankIfscRow">
                        <input
                          value={b.ifsc}
                          maxLength={11}
                          onChange={(e) => changeBankIfsc(i, e.target.value)}
                          onBlur={() => b.ifsc && lookupIfsc(i, b.ifsc)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && lookupIfsc(i, b.ifsc)
                          }
                        />
                        <button
                          type="button"
                          className="gstLookupButton iconOnlyLookup"
                          onClick={() => lookupIfsc(i, b.ifsc)}
                          title="Find IFSC in MASTER"
                        >
                          <Search size={14} />
                        </button>
                      </div>
                    </label>
                    <label className="bankAutoField">
                      Bank Name
                      <input value={b.bankName} readOnly />
                    </label>
                    <label className="bankAutoField">
                      Branch / Area
                      <input
                        value={b.branchName || b.branchArea || ""}
                        readOnly
                      />
                    </label>
                    <label className="bankAutoField span2">
                      Bank Address
                      <textarea value={b.bankAddress || ""} readOnly />
                    </label>
                    <label className="bankAutoField">
                      City
                      <input value={b.bankCity || b.city || ""} readOnly />
                    </label>
                    <label className="bankAutoField">
                      State
                      <input value={b.bankState || b.state || ""} readOnly />
                    </label>
                    <label className="bankAutoField">
                      Contact No.
                      <input
                        value={b.bankContactNo || b.contactNo || ""}
                        readOnly
                      />
                    </label>
                    <label>
                      Account Number
                      <input
                        value={b.accountNumber}
                        onChange={(e) =>
                          updateBank(i, "accountNumber", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Account Name
                      <input
                        value={b.accountName}
                        onChange={(e) =>
                          updateBank(i, "accountName", e.target.value)
                        }
                      />
                    </label>
                    <div className="formActions">
                      <button
                        type="button"
                        className="btn ghost danger"
                        disabled={form.bankDetails.length === 1}
                        onClick={() => removeBank(i)}
                      >
                        <Trash2 />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn ghost" onClick={addBank}>
                <Plus />
                Add Bank Account
              </button>
            </section>
          </div>
          <div className="customerCreateColumn">
            <section className="panel">
              <div className="sectionLabel">Personal Information</div>
              <div className="formGrid">
                <label>
                  Owner Name
                  <input
                    value={form.ownerName}
                    onChange={(e) => change("ownerName", e.target.value)}
                  />
                </label>
                <label>
                  Owner Mobile
                  <input
                    value={form.ownerMobile}
                    onChange={(e) => change("ownerMobile", e.target.value)}
                  />
                </label>
                <label>
                  Aadhaar
                  <input
                    value={form.ownerAadhaar}
                    onChange={(e) =>
                      change(
                        "ownerAadhaar",
                        digits(e.target.value).slice(0, 12),
                      )
                    }
                    placeholder={edit ? form.ownerAadhaarMasked : ""}
                  />
                </label>
                <label>
                  Owner PAN
                  <input
                    value={form.ownerPan}
                    onChange={(e) =>
                      change("ownerPan", e.target.value.toUpperCase())
                    }
                  />
                </label>
                <label>
                  Owner Pincode
                  <input
                    value={form.ownerPincode}
                    onChange={(e) => lookupPincode("owner", e.target.value)}
                    maxLength={6}
                  />
                </label>
                <label>
                  Owner Area
                  {ownerAreas.length > 1 ? (
                    <select
                      value={form.ownerArea}
                      onChange={(e) => selectArea("owner", e.target.value)}
                    >
                      <option value="">Select Area</option>
                      {ownerAreas.map((a, i) => (
                        <option key={`${a.area}-${i}`} value={a.area}>
                          {a.area}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={form.ownerArea} readOnly />
                  )}
                </label>
                <label>
                  Owner City
                  <input value={form.ownerCity} readOnly />
                </label>
                <label>
                  Owner District
                  <input value={form.ownerDistrict} readOnly />
                </label>
                <label>
                  Owner State
                  <input value={form.ownerState} readOnly />
                </label>
                <label className="span2">
                  Owner Address
                  <textarea
                    value={form.ownerAddress}
                    onChange={(e) => change("ownerAddress", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <div className="sectionLabel">Commercial & Other Information</div>
              <div className="formGrid">
                <label>
                  Payment Type
                  <select
                    value={form.paymentType}
                    onChange={(e) => change("paymentType", e.target.value)}
                  >
                    <option>CASH</option>
                    <option>CREDIT</option>
                  </select>
                </label>
                {form.paymentType === "CREDIT" && (
                  <>
                    <label>
                      Credit Period (Days)
                      <input
                        type="number"
                        value={form.creditDays}
                        onChange={(e) => change("creditDays", e.target.value)}
                      />
                    </label>
                    <label>
                      Credit Limit
                      <input
                        type="number"
                        value={form.creditLimit}
                        onChange={(e) => change("creditLimit", e.target.value)}
                      />
                    </label>
                    <label>
                      Grace Days
                      <input
                        type="number"
                        value={form.graceDays}
                        onChange={(e) => change("graceDays", e.target.value)}
                      />
                    </label>
                  </>
                )}
                {transportRequired && (
                  <>
                    <label className="transportLookupLabel span2">
                      <span>
                        <Truck size={13} /> Assigned Transport *{" "}
                        {transporterBusy && <small>Matching...</small>}
                      </span>
                      <div className="transportDestinationHint">
                        Delivery:{" "}
                        {[form.area, form.city, form.state, form.pincode]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                      <div className="lookupSelectRow">
                        <select
                          value={form.assignedTransportGlobalId || ""}
                          onChange={(e) => selectTransportMatch(e.target.value)}
                          required
                        >
                          <option value="">
                            Select transporter serving{" "}
                            {form.city || form.pincode || "customer"}
                          </option>
                          {transporterMatches.map((t) => (
                            <option
                              key={t.globalTransporterId}
                              value={t.globalTransporterId}
                            >
                              {t.name} —{" "}
                              {t.deliveryStations?.[0]?.pincode === form.pincode
                                ? "Exact Pincode"
                                : t.deliveryStations?.[0]?.city ||
                                  t.deliveryStations?.[0]?.name ||
                                  "Service Area"}
                              {t.needsImport ? " • Global MASTER" : ""}
                            </option>
                          ))}
                        </select>
                        <CreateLookupButton
                          to="/dms/transporters"
                          label="Create"
                          resource="transporter"
                          selectedValue={form.assignedTransport || ""}
                          context={{
                            stationType: "DELIVERY",
                            pincode: form.pincode,
                            city: form.city,
                            state: form.state,
                            address: form.address,
                          }}
                          onReturn={async (payload) => {
                            await loadTransporters();
                            const matches = await loadTransportMatches(form);
                            const created = (matches || []).find(
                              (x) =>
                                String(x.localTransporterId || "") ===
                                  String(payload?.id || "") ||
                                String(x.globalTransporterId || "") ===
                                  String(payload?.globalTransporterId || ""),
                            );
                            if (created)
                              await selectTransportMatch(
                                created.globalTransporterId,
                                matches,
                              );
                          }}
                        />
                      </div>
                      {!transporterBusy && !transporterMatches.length && (
                        <small className="fieldHint">
                          No transporter currently serves this delivery
                          city/pincode. Use + to create one; its delivery
                          station is prefilled from this customer and saved in
                          Global MASTER.
                        </small>
                      )}
                    </label>
                    {form.assignedTransportGlobalId && (
                      <>
                        <label>
                          Booking Station
                          <select
                            value={form.assignedTransportBookingStationId || ""}
                            onChange={(e) =>
                              change(
                                "assignedTransportBookingStationId",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">
                              Auto / Select Booking Station
                            </option>
                            {(
                              transporterMatches.find(
                                (t) =>
                                  t.globalTransporterId ===
                                  form.assignedTransportGlobalId,
                              )?.bookingStations || []
                            ).map((st) => (
                              <option key={st.stationId} value={st.stationId}>
                                {st.name}
                                {st.city ? ` — ${st.city}` : ""}
                                {st.pincode ? ` (${st.pincode})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Delivery Station
                          <select
                            value={
                              form.assignedTransportDeliveryStationId || ""
                            }
                            onChange={(e) => {
                              const id = e.target.value;
                              const st = (
                                transporterMatches.find(
                                  (t) =>
                                    t.globalTransporterId ===
                                    form.assignedTransportGlobalId,
                                )?.deliveryStations || []
                              ).find((x) => x.stationId === id);
                              setForm((f) => ({
                                ...f,
                                assignedTransportDeliveryStationId: id,
                                serviceArea:
                                  st?.name || st?.city || f.serviceArea,
                              }));
                            }}
                          >
                            <option value="">Select Delivery Station *</option>
                            {(
                              transporterMatches.find(
                                (t) =>
                                  t.globalTransporterId ===
                                  form.assignedTransportGlobalId,
                              )?.deliveryStations || []
                            ).map((st) => (
                              <option key={st.stationId} value={st.stationId}>
                                {st.name}
                                {st.city ? ` — ${st.city}` : ""}
                                {st.pincode ? ` (${st.pincode})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <label>
                      Service Area
                      <input
                        value={form.serviceArea}
                        onChange={(e) => change("serviceArea", e.target.value)}
                      />
                    </label>
                  </>
                )}
                <label>
                  Customer Grade
                  <div className="lookupSelectRow">
                    <select
                      value={form.gradeCode}
                      onChange={(e) => {
                        const g = grades.find((x) => x.code === e.target.value);
                        setForm((f) => ({
                          ...f,
                          gradeCode: e.target.value,
                          gradeDiscountPct: Number(g?.discountPct || 0),
                        }));
                      }}
                    >
                      <option value="">No Grade</option>
                      {grades.map((g) => (
                        <option key={g._id} value={g.code}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                    <CreateLookupButton
                      to="/dms/customer-grades"
                      label="Create"
                      resource="grade"
                      selectedValue={
                        grades.find((g) => g.code === form.gradeCode)?._id || ""
                      }
                      onReturn={() =>
                        api("/catalog/grades?limit=200&status=ACTIVE")
                          .then((d) => setGrades(d.items || []))
                          .catch(() => {})
                      }
                    />
                  </div>
                </label>
                <label
                  className="geoIconField"
                  title="Geotag customer location"
                >
                  <span className="geoOnlyLabel">
                    <MapPin size={15} />
                  </span>
                  <div className="gstInputRow">
                    <input
                      value={form.geotagging}
                      readOnly
                      placeholder="Latitude, Longitude"
                    />
                    <button
                      type="button"
                      className="gstLookupButton iconOnlyAction"
                      onClick={captureGeo}
                      title="Capture geotag"
                      aria-label="Capture geotag"
                    >
                      <MapPin size={16} />
                    </button>
                  </div>
                </label>
                <label>
                  {edit ? "New Customer Password" : "Customer Password"}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => change("password", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <div className="sectionLabel">Opening Balance / Accounting</div>
              <div className="formGrid">
                <label>
                  Account Head
                  <input
                    disabled
                    value={
                      form.partyType === "CREDITOR"
                        ? "Sundry Creditors"
                        : "Sundry Debtors"
                    }
                  />
                </label>
                <label>
                  Opening Balance
                  <input
                    type="number"
                    value={form.openingBalance}
                    onChange={(e) => change("openingBalance", e.target.value)}
                  />
                </label>
                <label>
                  Balance Type
                  <select
                    value={form.openingBalanceType}
                    onChange={(e) =>
                      change("openingBalanceType", e.target.value)
                    }
                  >
                    <option>DR</option>
                    <option>CR</option>
                  </select>
                </label>
                <label>
                  Opening Financial Year
                  <input
                    value={form.financialYear}
                    onChange={(e) => change("financialYear", e.target.value)}
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
        {["SUPERADMIN", "MASTER"].includes(
          String(user?.role || "").toUpperCase(),
        ) && (
          <div className="resultBanner good">
            Customers created by Superadmin/Master are activated immediately and
            do not require Customer Approval.
          </div>
        )}
        <div className="formActions" style={{ marginBottom: 24 }}>
          <button className="btn ghost" onClick={() => setShow(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            {edit
              ? "Update Customer"
              : ["SUPERADMIN", "MASTER"].includes(
                    String(user?.role || "").toUpperCase(),
                  )
                ? "Create & Activate Customer"
                : "Create Customer"}
          </button>
        </div>
      </>
    );

  return (
    <>
      {!embedded && (
        <PageHeader
          title={approvalsOnly ? "Customer Approvals" : "Customers"}
          description="Full customer master and pincode-based salesperson assignment."
        />
      )}
      {msg && <div className="resultBanner good">{msg}</div>}
      {!approvalsOnly && (
        <PageHeader
          title="Customer Master"
          description="Previous DMS fields, assignment and multiple bank accounts."
          onAdd={openCreate}
          addLabel="Create Customer"
        />
      )}
      {!approvalsOnly && (
        <>
          <section className="panel" style={{ padding: 12, marginBottom: 12 }}>
            <div className="toolbar">
              <div>
                <strong>Customer Bulk Upload</strong>
                <div className="tableSubText">
                  File is reviewed first. You can edit every uploaded row before
                  anything is written to the database.
                </div>
              </div>
              <div className="toolbarActions">
                {isSuperAdmin && (
                  <button
                    className="btn ghost"
                    disabled={downloadingData}
                    onClick={downloadCustomerData}
                  >
                    <Download size={15} />
                    {downloadingData ? "Downloading..." : "Download Data"}
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={downloadCustomerBulkTemplate}
                >
                  <Download size={15} />
                  Template
                </button>
                <button
                  className="btn primary"
                  disabled={bulkBusy}
                  onClick={() => bulkUploadInput.current?.click()}
                >
                  <Upload size={15} />
                  {bulkBusy ? "Reading..." : "Bulk Upload & Review"}
                </button>
                <input
                  ref={bulkUploadInput}
                  hidden
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => previewCustomerBulk(e.target.files?.[0])}
                />
              </div>
            </div>
          </section>
          {bulkNotice && (
            <div
              className={`resultBanner ${bulkNotice.toLowerCase().includes("need correction") || bulkNotice.toLowerCase().includes("error") ? "bad" : "good"}`}
            >
              {bulkNotice}
            </div>
          )}
          <BulkTools
            endpoint="/customers"
            fields={bulkFields}
            editFields={bulkFields.filter((f) => !f.noBulkEdit)}
            selectedIds={selected}
            onClear={() => setSelected([])}
            onDone={() => load(1)}
            allowUpload={false}
            allowDelete={canDeleteCustomers}
            deleteText="Bulk Delete"
            templateName="customers-bulk-template.csv"
          />
        </>
      )}
      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder="Search customer..."
            />
          </div>
          <div className="toolbarActions">
            <button className="btn ghost" onClick={() => load()}>
              <RefreshCw />
              Refresh
            </button>
            {canDeleteCustomers && (
              <button
                className="btn dangerBtn"
                disabled={deletingAll}
                onClick={deleteAllCustomers}
              >
                <Trash2 />
                {deletingAll ? "Deleting..." : "Delete All"}
              </button>
            )}
          </div>
        </div>
        <DataTable
          rows={rows}
          selectable={!approvalsOnly}
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          rowId={(r) => r.globalCustomerId}
          columns={[
            {
              key: "localName",
              label: "Customer",
              render: (r) => (
                <div className="customerCell">
                  <EditMasterLink onClick={() => openEdit(r)}>
                    {r.localName}
                  </EditMasterLink>
                  <small>{r.displayIdentifier}</small>
                </div>
              ),
            },
            { key: "partyType", label: "Party Type" },
            {
              key: "pincode",
              label: "Pincode",
              render: (r) =>
                r.addresses?.find((a) => a.type === "BILLING")?.pincode ||
                r.addresses?.[0]?.pincode ||
                "—",
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <StatusBadge value={r.status} />,
            },
            {
              key: "approval",
              label: "Approval",
              render: (r) => <StatusBadge value={r.approval?.status || "—"} />,
            },
            {
              key: "paymentType",
              label: "Terms",
              render: (r) =>
                r.paymentType === "CREDIT"
                  ? `CREDIT • ${r.creditDays || 0}d • ₹${Number(r.creditLimit || 0).toLocaleString("en-IN")}`
                  : "CASH",
            },
            {
              key: "actions",
              label: "Actions",
              render: (r) => (
                <div className="rowActions">
                  <button title="View 360°" onClick={() => open360(r)}>
                    <Eye />
                  </button>
                  {!approvalsOnly && (
                    <button
                      title="Edit / Update Customer"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil />
                    </button>
                  )}
                  {canApprove(user) &&
                    (r.status === "PENDING_APPROVAL" || approvalsOnly) && (
                      <button
                        title="Review Customer"
                        onClick={() => reviewCustomer(r)}
                      >
                        <UserCheck />
                      </button>
                    )}
                  {!approvalsOnly && canDeleteCustomers && (
                    <button
                      title="Delete Customer"
                      onClick={() => deleteCustomer(r)}
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => load(page - 1)}>
            <ChevronLeft />
          </button>
          <span>
            Page {page} / {meta.pages || 1} • {meta.total || 0}
          </span>
          <button disabled={page >= meta.pages} onClick={() => load(page + 1)}>
            <ChevronRight />
          </button>
        </div>
      </section>

      {bulkReview && bulkStage === "QUICK" && (
        <CustomerBulkReviewModal
          review={bulkReview}
          busy={bulkBusy}
          onClose={() => {
            setBulkReview(null);
            setBulkStage("QUICK");
          }}
          onChangeRow={updateBulkReviewRow}
          onRemoveRow={removeBulkReviewRow}
          onApplyAll={applyBulkReviewValue}
          onContinue={continueToFullBulkReview}
        />
      )}
      {bulkReview && bulkStage === "FULL" && (
        <CustomerBulkFullReviewModal
          review={bulkReview}
          busy={bulkBusy}
          grades={grades}
          firmLocation={firmLocation}
          onBack={() => setBulkStage("QUICK")}
          onClose={() => {
            setBulkReview(null);
            setBulkStage("QUICK");
          }}
          onChangeRow={replaceBulkReviewRow}
          onRemoveRow={removeBulkReviewRow}
          onImport={commitCustomerBulk}
        />
      )}
      {review && (
        <div className="modalOverlay">
          <section className="panel modalPanel extraWideModal">
            <div className="formTitle">
              <div>
                <h3>Customer Approval</h3>
                <span>{review.localName}</span>
              </div>
              <button className="iconBtn" onClick={() => setReview(null)}>
                <X />
              </button>
            </div>
            <div className="approvalCards">
              <div>
                <span>Customer</span>
                <strong>{review.localName}</strong>
              </div>
              <div>
                <span>Owner</span>
                <strong>{review.ownerName || "—"}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{review.paymentType}</strong>
                <small>
                  ₹{Number(review.creditLimit || 0).toLocaleString("en-IN")}
                </small>
              </div>
            </div>
            <div className="formActions">
              <button
                className="btn ghost danger"
                onClick={() => approval("REJECT")}
              >
                Reject
              </button>
              <button
                className="btn ghost"
                onClick={() => approval("SEND_BACK")}
              >
                Send Back
              </button>
              <button
                className="btn primary"
                onClick={() => approval("APPROVE")}
              >
                Approve
              </button>
            </div>
          </section>
        </div>
      )}
      {view360 && (
        <div className="modalOverlay">
          <section className="panel modalPanel extraWideModal">
            <div className="formTitle">
              <div>
                <h3>{view360.company?.localName} — Customer 360°</h3>
              </div>
              <button className="iconBtn" onClick={() => setView360(null)}>
                <X />
              </button>
            </div>
            <div className="toolbar">
              <label>
                Financial Year{" "}
                <input value={fy} onChange={(e) => setFy(e.target.value)} />
              </label>
            </div>
            <div className="approvalCards">
              <div>
                <span>Sales</span>
                <strong>
                  ₹
                  {Number(view360.financial?.sales || 0).toLocaleString(
                    "en-IN",
                  )}
                </strong>
              </div>
              <div>
                <span>Receipts</span>
                <strong>
                  ₹
                  {Number(view360.financial?.receipts || 0).toLocaleString(
                    "en-IN",
                  )}
                </strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>
                  ₹
                  {Number(view360.financial?.outstanding || 0).toLocaleString(
                    "en-IN",
                  )}
                </strong>
              </div>
              <div>
                <span>Owner</span>
                <strong>{view360.company?.ownerName || "—"}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CustomerBulkReviewModal({
  review,
  busy,
  onClose,
  onChangeRow,
  onRemoveRow,
  onApplyAll,
  onContinue,
}) {
  const [applyField, setApplyField] = useState("");
  const [applyValue, setApplyValue] = useState("");
  const rows = review?.rows || [];
  const incompleteCount = rows.filter(
    (row) => customerBulkErrors(row).length,
  ).length;
  const selectedField = bulkUploadFields.find((f) => f.key === applyField);
  const apply = () => {
    if (!applyField || applyValue === "") return;
    onApplyAll(applyField, applyValue);
  };
  return (
    <div className="modalOverlay">
      <section
        className="panel modalPanel"
        style={{
          width: "96vw",
          maxWidth: "1600px",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="formTitle">
          <div>
            <h3>Step 1 of 2 — Quick Customer Preview</h3>
            <span>
              {review.fileName || "Uploaded file"} • {rows.length} row(s) •{" "}
              <b style={{ color: incompleteCount ? "#b54708" : "#067647" }}>
                {incompleteCount
                  ? `${incompleteCount} have missing basic fields — allowed here`
                  : "Basic fields available"}
              </b>
            </span>
          </div>
          <button className="iconBtn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="resultBanner good" style={{ marginBottom: 10 }}>
          <CheckCircle2 size={16} />
          <div>
            <strong>Nothing is saved during this preview.</strong>
            <span>
              Blank cells are allowed. Make quick spreadsheet-style corrections
              here, then continue to the full expandable customer forms.
            </span>
          </div>
        </div>
        <div className="toolbar" style={{ marginBottom: 10, flexWrap: "wrap" }}>
          <div className="toolbarActions" style={{ flexWrap: "wrap" }}>
            <select
              value={applyField}
              onChange={(e) => {
                setApplyField(e.target.value);
                setApplyValue("");
              }}
            >
              <option value="">Apply one field to all rows…</option>
              {bulkUploadFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            {selectedField && (
              <BulkReviewInput
                field={selectedField}
                value={applyValue}
                onChange={setApplyValue}
                compact
              />
            )}
            <button
              className="btn ghost"
              disabled={!applyField || applyValue === ""}
              onClick={apply}
            >
              Apply to All {rows.length}
            </button>
          </div>
          <div className="tableSubText">
            Anything left blank will simply carry forward to Step 2.
          </div>
        </div>
        <div
          className="tableWrap"
          style={{
            overflow: "auto",
            flex: 1,
            border: "1px solid var(--border, #d0d5dd)",
            borderRadius: 10,
          }}
        >
          <table
            style={{ minWidth: Math.max(1600, bulkUploadFields.length * 150) }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 4,
                    background: "var(--panel,#fff)",
                  }}
                >
                  Row
                </th>
                <th
                  style={{
                    position: "sticky",
                    left: 58,
                    zIndex: 4,
                    background: "var(--panel,#fff)",
                  }}
                >
                  Status
                </th>
                {bulkUploadFields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const errors = customerBulkErrors(row);
                return (
                  <tr
                    key={`${row.sourceRow || index}-${index}`}
                    style={
                      errors.length
                        ? { background: "rgba(181,71,8,.04)" }
                        : undefined
                    }
                  >
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        background: "inherit",
                        fontWeight: 700,
                      }}
                    >
                      {row.sourceRow || index + 2}
                    </td>
                    <td
                      style={{
                        position: "sticky",
                        left: 58,
                        zIndex: 2,
                        background: "inherit",
                        minWidth: 190,
                      }}
                    >
                      {errors.length ? (
                        <span
                          title={errors.join(" • ")}
                          style={{
                            display: "inline-flex",
                            gap: 5,
                            alignItems: "center",
                            color: "#b54708",
                          }}
                        >
                          <AlertTriangle size={14} />
                          Incomplete — can continue
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            gap: 5,
                            alignItems: "center",
                            color: "#067647",
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Looks good
                        </span>
                      )}
                    </td>
                    {bulkUploadFields.map((field) => (
                      <td
                        key={field.key}
                        style={{
                          minWidth: field.key.includes("address") ? 220 : 145,
                        }}
                      >
                        <BulkReviewInput
                          field={field}
                          value={row[field.key] ?? ""}
                          onChange={(value) =>
                            onChangeRow(index, field.key, value)
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="iconBtn"
                        title="Remove row from this import"
                        onClick={() => onRemoveRow(index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          className="formActions"
          style={{ paddingTop: 12, justifyContent: "space-between" }}
        >
          <div className="tableSubText">
            Step 1 never blocks because of empty cells. Step 2 contains the
            complete Create Customer form for every row.
          </div>
          <div className="toolbarActions">
            <button className="btn ghost" onClick={onClose}>
              Cancel Import
            </button>
            <button
              className="btn primary"
              disabled={busy || !rows.length}
              onClick={onContinue}
            >
              Continue to Full Customer Forms <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function BulkReviewInput({ field, value, onChange, compact = false }) {
  if (field.type === "select")
    return (
      <select
        style={compact ? { minWidth: 160 } : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value=""></option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {String(option).replaceAll("_", " ")}
          </option>
        ))}
      </select>
    );
  return (
    <input
      style={compact ? { minWidth: 180 } : undefined}
      type={field.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CustomerBulkFullReviewModal({
  review,
  busy,
  grades,
  firmLocation,
  onBack,
  onClose,
  onChangeRow,
  onRemoveRow,
  onImport,
}) {
  const rows = review?.rows || [];
  const [openRows, setOpenRows] = useState(() => ({ 0: true }));
  const invalidCount = rows.filter(
    (row) => customerBulkErrors(row).length,
  ).length;
  const toggle = (index) =>
    setOpenRows((prev) => ({ ...prev, [index]: !prev[index] }));
  const openAll = () =>
    setOpenRows(Object.fromEntries(rows.map((_, i) => [i, true])));
  const closeAll = () => setOpenRows({});
  return (
    <div className="modalOverlay">
      <section
        className="panel modalPanel"
        style={{
          width: "96vw",
          maxWidth: "1500px",
          height: "94vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          className="formTitle"
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--border,#d0d5dd)",
          }}
        >
          <div>
            <h3>Step 2 of 2 — Full Customer Form Review</h3>
            <span>
              {review.fileName || "Uploaded file"} • {rows.length} customer(s) •
              expand each customer and review the same details used in Create
              Customer
            </span>
          </div>
          <button className="iconBtn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div style={{ padding: "12px 18px 0" }}>
          <div className="resultBanner good">
            <CheckCircle2 size={16} />
            <div>
              <strong>Still nothing has been imported.</strong>
              <span>
                Every uploaded value is prefilled below. Complete only what you
                want now; use the expandable forms to inspect the full customer
                profile.
              </span>
            </div>
          </div>
        </div>
        <div
          className="toolbar"
          style={{ padding: "10px 18px", flexWrap: "wrap" }}
        >
          <div className="toolbarActions">
            <button className="btn ghost" onClick={openAll}>
              Expand All
            </button>
            <button className="btn ghost" onClick={closeAll}>
              Collapse All
            </button>
          </div>
          <div className="tableSubText">
            {invalidCount
              ? `${invalidCount} customer(s) still miss the minimum identity needed for final import. Other blank fields are okay.`
              : "All customers have minimum identity fields."}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "0 18px 18px" }}>
          <style>{`
    .bulkCustomerAccordion{border:1px solid var(--border,#d0d5dd);border-radius:12px;margin-bottom:12px;overflow:hidden;background:var(--panel,#fff)}
    .bulkCustomerAccordionHeader{width:100%;border:0;background:transparent;display:grid;grid-template-columns:36px minmax(220px,1.4fr) minmax(160px,1fr) minmax(140px,.8fr) minmax(150px,.8fr) 120px;gap:10px;align-items:center;text-align:left;padding:13px 14px;cursor:pointer}
    .bulkCustomerAccordionHeader:hover{background:rgba(16,24,40,.025)}
    .bulkCustomerAccordionBody{padding:14px;border-top:1px solid var(--border,#d0d5dd);background:rgba(16,24,40,.012)}
    .bulkFullColumns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
    .bulkFullColumn{display:flex;flex-direction:column;gap:14px;min-width:0}
    .bulkFullColumn>.panel{margin:0;padding:14px}
    .bulkRowStatus{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700}
    @media(max-width:1100px){.bulkFullColumns{grid-template-columns:1fr}.bulkCustomerAccordionHeader{grid-template-columns:32px 1fr 120px}.bulkHideSmall{display:none}}
   `}</style>
          {rows.map((row, index) => {
            const errors = customerBulkErrors(row);
            const open = Boolean(openRows[index]);
            return (
              <div
                className="bulkCustomerAccordion"
                key={`${row.sourceRow || index}-${index}`}
              >
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <button
                    className="bulkCustomerAccordionHeader"
                    onClick={() => toggle(index)}
                  >
                    <ChevronRight
                      size={18}
                      style={{
                        transform: open ? "rotate(90deg)" : "none",
                        transition: "transform .15s",
                      }}
                    />
                    <div>
                      <strong>
                        {row.legalName ||
                          `Customer Row ${row.sourceRow || index + 2}`}
                      </strong>
                      <div className="tableSubText">
                        Uploaded row {row.sourceRow || index + 2}
                      </div>
                    </div>
                    <div className="bulkHideSmall">
                      <strong>
                        {row.gstin ||
                          row.pan ||
                          row.ownerPan ||
                          "No GST/PAN yet"}
                      </strong>
                      <div className="tableSubText">Identity</div>
                    </div>
                    <div className="bulkHideSmall">
                      <strong>{row.pincode || "—"}</strong>
                      <div className="tableSubText">Pincode</div>
                    </div>
                    <div className="bulkHideSmall">
                      <strong>
                        {row.ownerMobile || row.companyContactNumber || "—"}
                      </strong>
                      <div className="tableSubText">Contact</div>
                    </div>
                    <div>
                      {errors.length ? (
                        <span
                          className="bulkRowStatus"
                          style={{ color: "#b42318" }}
                        >
                          <AlertTriangle size={14} />
                          Needs identity
                        </span>
                      ) : (
                        <span
                          className="bulkRowStatus"
                          style={{ color: "#067647" }}
                        >
                          <CheckCircle2 size={14} />
                          Importable
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    className="iconBtn"
                    style={{ margin: "10px 10px 10px 0", alignSelf: "center" }}
                    title="Remove customer from this import"
                    onClick={() => onRemoveRow(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {open && (
                  <div className="bulkCustomerAccordionBody">
                    <BulkCustomerExpandedForm
                      row={row}
                      index={index}
                      grades={grades}
                      firmLocation={firmLocation}
                      onChange={(next) => onChangeRow(index, next)}
                    />
                    {errors.length > 0 && (
                      <div
                        className="resultBanner bad"
                        style={{ marginTop: 12 }}
                      >
                        <AlertTriangle size={16} />
                        <div>
                          <strong>
                            Minimum identity still required for this row
                          </strong>
                          <span>{errors.join(" • ")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div
          className="formActions"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--border,#d0d5dd)",
            justifyContent: "space-between",
            background: "var(--panel,#fff)",
          }}
        >
          <button className="btn ghost" onClick={onBack}>
            <ChevronLeft size={16} />
            Back to Quick Preview
          </button>
          <div className="toolbarActions">
            <button className="btn ghost" onClick={onClose}>
              Cancel Import
            </button>
            <button
              className="btn primary"
              disabled={busy || !rows.length}
              onClick={onImport}
            >
              {busy
                ? "Importing..."
                : `Final Import ${rows.length} Customer${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function BulkCustomerExpandedForm({
  row,
  index,
  grades = [],
  firmLocation = {},
  onChange,
}) {
  const [companyAreas, setCompanyAreas] = useState([]),
    [ownerAreas, setOwnerAreas] = useState([]),
    [assignment, setAssignment] = useState({
      users: [],
      requiresSelection: false,
      autoUserId: "",
    }),
    [localMsg, setLocalMsg] = useState("");
  const patch = (changes) => onChange({ ...row, ...changes });
  const change = (key, value) => patch({ [key]: value });
  const bankDetails =
    Array.isArray(row.bankDetails) && row.bankDetails.length
      ? row.bankDetails
      : [emptyBank()];
  const updateBanks = (banks) => patch({ bankDetails: banks });
  const updateBank = (i, key, value) =>
    updateBanks(
      bankDetails.map((b, n) => (n === i ? { ...b, [key]: value } : b)),
    );
  const addBank = () => updateBanks([...bankDetails, emptyBank()]);
  const removeBank = (i) =>
    updateBanks(
      bankDetails.length === 1
        ? [emptyBank()]
        : bankDetails.filter((_, n) => n !== i),
    );
  const lookupBank = async (i, raw) => {
    try {
      const code = normalizeIfsc(raw ?? bankDetails[i]?.ifsc);
      const found = await lookupIfscMaster(code);
      const auto = bankFieldsFromIfsc(found);
      updateBanks(bankDetails.map((b, n) => (n === i ? { ...b, ...auto } : b)));
      setLocalMsg(`Bank details loaded for ${code}`);
    } catch (e) {
      setLocalMsg(e.message);
    }
  };
  const loadAssignment = async (pin) => {
    const p = digits(pin).slice(0, 6);
    if (p.length !== 6) {
      setAssignment({ users: [], requiresSelection: false, autoUserId: "" });
      return;
    }
    const a = await api(`/access/assignment-options?pincode=${p}`).catch(
      () => ({ users: [], requiresSelection: false, autoUserId: "" }),
    );
    setAssignment(a || { users: [], requiresSelection: false, autoUserId: "" });
    if (a?.autoUserId) patch({ salespersonId: a.autoUserId });
  };
  const lookupPincode = async (kind, raw) => {
    const p = digits(raw).slice(0, 6);
    const key = kind === "owner" ? "ownerPincode" : "pincode";
    patch({ [key]: p });
    if (p.length !== 6) return;
    try {
      const r = await api(`/access/pincode-lookup/${p}`);
      const areas = r.alternatives?.length ? r.alternatives : [r];
      const first = areas[0] || r;
      if (kind === "owner") {
        setOwnerAreas(areas);
        patch({
          ownerPincode: p,
          ownerArea: first.area || "",
          ownerCity: first.city || first.area || r.city || "",
          ownerDistrict: first.district || r.district || "",
          ownerState: first.state || r.state || "",
        });
      } else {
        setCompanyAreas(areas);
        const city = first.city || first.area || r.city || "";
        patch({
          pincode: p,
          area: first.area || "",
          city,
          district: first.district || r.district || "",
          state: first.state || r.state || "",
          regionType:
            firmLocation.city && city
              ? needsTransport(city, firmLocation.city)
                ? "OUTSIDE"
                : "LOCAL"
              : row.regionType || "LOCAL",
          serviceArea: row.serviceArea || first.area || "",
        });
        await loadAssignment(p);
      }
      setLocalMsg("");
    } catch (e) {
      setLocalMsg(e.message);
    }
  };
  const selectArea = (kind, value) => {
    const list = kind === "owner" ? ownerAreas : companyAreas;
    const x = list.find((a) => a.area === value);
    if (kind === "owner")
      patch({
        ownerArea: value,
        ownerCity: x?.city || value,
        ownerDistrict: x?.district || row.ownerDistrict,
        ownerState: x?.state || row.ownerState,
      });
    else {
      const city = x?.city || value;
      patch({
        area: value,
        city,
        district: x?.district || row.district,
        state: x?.state || row.state,
        regionType:
          firmLocation.city && city
            ? needsTransport(city, firmLocation.city)
              ? "OUTSIDE"
              : "LOCAL"
            : row.regionType || "LOCAL",
        serviceArea: row.serviceArea || value,
      });
    }
  };
  const captureGeo = () =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) =>
            change("geotagging", `${p.coords.latitude},${p.coords.longitude}`),
          (e) => setLocalMsg(e.message),
          { enableHighAccuracy: true },
        )
      : setLocalMsg("Geolocation not supported");
  const deliveryMode = !row.city
    ? "PENDING"
    : needsTransport(row.city, firmLocation.city)
      ? "OUTSIDE"
      : "LOCAL";
  const uploadedSalespersonMissing =
    row.salespersonId &&
    !(assignment.users || []).some(
      (u) => String(u._id) === String(row.salespersonId),
    );
  return (
    <>
      {localMsg && (
        <div
          className={`resultBanner ${localMsg.toLowerCase().includes("loaded") ? "good" : "bad"}`}
          style={{ marginBottom: 10 }}
        >
          {localMsg}
        </div>
      )}
      <div className="bulkFullColumns">
        <div className="bulkFullColumn">
          <section className="panel">
            <div className="sectionLabel">Company Information</div>
            <div className="formGrid">
              <label>
                GSTIN
                <input
                  value={row.gstin || ""}
                  onChange={(e) =>
                    change("gstin", e.target.value.toUpperCase())
                  }
                  maxLength={15}
                />
              </label>
              <label>
                Company / Customer Name
                <input
                  value={row.legalName || ""}
                  onChange={(e) => change("legalName", e.target.value)}
                />
              </label>
              <label>
                Trade Name
                <input
                  value={row.tradeName || ""}
                  onChange={(e) => change("tradeName", e.target.value)}
                />
              </label>
              <label>
                Party Type
                <select
                  value={row.partyType || "DEBITOR"}
                  onChange={(e) => change("partyType", e.target.value)}
                >
                  <option>DEBITOR</option>
                  <option>CREDITOR</option>
                  <option>ECOMMERCE</option>
                </select>
              </label>
              <label>
                Registration Type
                <select
                  value={row.registrationType || "UNKNOWN"}
                  onChange={(e) => change("registrationType", e.target.value)}
                >
                  <option>UNKNOWN</option>
                  <option>REGULAR</option>
                  <option>COMPOSITION</option>
                  <option>UNREGISTERED</option>
                </select>
              </label>
              <label>
                Company PAN
                <input
                  value={row.pan || ""}
                  onChange={(e) => change("pan", e.target.value.toUpperCase())}
                />
              </label>
              <label>
                Email
                <input
                  value={row.email || ""}
                  onChange={(e) => change("email", e.target.value)}
                />
              </label>
              <label>
                Deals in Products
                <input
                  value={row.dealsInProducts || ""}
                  onChange={(e) => change("dealsInProducts", e.target.value)}
                />
              </label>
              <label>
                Annual Turnover
                <input
                  type="number"
                  value={row.annualTurnover ?? ""}
                  onChange={(e) => change("annualTurnover", e.target.value)}
                />
              </label>
              <label>
                Contact Number
                <input
                  value={row.companyContactNumber || ""}
                  onChange={(e) =>
                    change("companyContactNumber", e.target.value)
                  }
                />
              </label>
              <label>
                Shop Size
                <input
                  value={row.shopSize || ""}
                  onChange={(e) => change("shopSize", e.target.value)}
                />
              </label>
              <label>
                Delivery Mode
                <input
                  readOnly
                  value={
                    deliveryMode === "PENDING"
                      ? "Enter Pincode / City"
                      : deliveryMode === "LOCAL"
                        ? `LOCAL — ${firmLocation.city || "Firm City"}`
                        : `TRANSPORT — ${firmLocation.city || "Firm City"} → ${row.city}`
                  }
                />
              </label>
              <label>
                Pincode
                <input
                  value={row.pincode || ""}
                  onChange={(e) => lookupPincode("company", e.target.value)}
                  maxLength={6}
                />
              </label>
              <label>
                Area / Post Office
                {companyAreas.length > 1 ? (
                  <select
                    value={row.area || ""}
                    onChange={(e) => selectArea("company", e.target.value)}
                  >
                    <option value="">Select Area</option>
                    {companyAreas.map((a, i) => (
                      <option key={`${a.area}-${i}`} value={a.area}>
                        {a.area}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={row.area || ""}
                    onChange={(e) => change("area", e.target.value)}
                  />
                )}
              </label>
              <label>
                City
                <input
                  value={row.city || ""}
                  onChange={(e) => change("city", e.target.value)}
                />
              </label>
              <label>
                District
                <input
                  value={row.district || ""}
                  onChange={(e) => change("district", e.target.value)}
                />
              </label>
              <label>
                State
                <input
                  value={row.state || ""}
                  onChange={(e) => change("state", e.target.value)}
                />
              </label>
              <label className="span2">
                Address 1
                <textarea
                  value={row.address || ""}
                  onChange={(e) => change("address", e.target.value)}
                />
              </label>
              <label className="span2">
                Address 2
                <textarea
                  value={row.address2 || ""}
                  onChange={(e) => change("address2", e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="sectionLabel">Assignment</div>
            <div className="formGrid">
              <label>
                Assigned Sales Person
                <select
                  value={row.salespersonId || ""}
                  onChange={(e) => change("salespersonId", e.target.value)}
                >
                  <option value="">Select Sales Person</option>
                  {uploadedSalespersonMissing && (
                    <option value={row.salespersonId}>
                      {row.salespersonId} — Uploaded value
                    </option>
                  )}
                  {(assignment.users || []).map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} — {u.departmentName || "Sales"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignment Pincode
                <input value={row.pincode || ""} readOnly />
              </label>
            </div>
            {row.pincode && !(assignment.users || []).length && (
              <div className="tableSubText" style={{ marginTop: 8 }}>
                No assigned Sales Person was found yet. This does not block Step
                2 review.
              </div>
            )}
          </section>
          <section className="panel">
            <div className="sectionLabel">Bank Accounts — IFSC First</div>
            {bankDetails.map((b, i) => (
              <div key={i} className="subCard" style={{ marginBottom: 12 }}>
                <div className="formGrid">
                  <label>
                    IFSC Code
                    <div className="bankIfscRow">
                      <input
                        value={b.ifsc || ""}
                        maxLength={11}
                        onChange={(e) =>
                          updateBank(
                            i,
                            "ifsc",
                            normalizeIfsc(e.target.value).slice(0, 11),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="gstLookupButton iconOnlyLookup"
                        onClick={() => lookupBank(i, b.ifsc)}
                        title="Find IFSC in MASTER"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                  </label>
                  <label>
                    Bank Name
                    <input
                      value={b.bankName || ""}
                      onChange={(e) =>
                        updateBank(i, "bankName", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Branch / Area
                    <input
                      value={b.branchName || b.branchArea || ""}
                      onChange={(e) =>
                        updateBank(i, "branchName", e.target.value)
                      }
                    />
                  </label>
                  <label className="span2">
                    Bank Address
                    <textarea
                      value={b.bankAddress || ""}
                      onChange={(e) =>
                        updateBank(i, "bankAddress", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    City
                    <input
                      value={b.bankCity || b.city || ""}
                      onChange={(e) =>
                        updateBank(i, "bankCity", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    State
                    <input
                      value={b.bankState || b.state || ""}
                      onChange={(e) =>
                        updateBank(i, "bankState", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Contact No.
                    <input
                      value={b.bankContactNo || b.contactNo || ""}
                      onChange={(e) =>
                        updateBank(i, "bankContactNo", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Account Number
                    <input
                      value={b.accountNumber || ""}
                      onChange={(e) =>
                        updateBank(i, "accountNumber", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Account Name
                    <input
                      value={b.accountName || ""}
                      onChange={(e) =>
                        updateBank(i, "accountName", e.target.value)
                      }
                    />
                  </label>
                  <div className="formActions">
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => removeBank(i)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn ghost" onClick={addBank}>
              <Plus size={15} />
              Add Bank Account
            </button>
          </section>
        </div>
        <div className="bulkFullColumn">
          <section className="panel">
            <div className="sectionLabel">Personal Information</div>
            <div className="formGrid">
              <label>
                First Name
                <input
                  value={row.firstName || ""}
                  onChange={(e) => change("firstName", e.target.value)}
                />
              </label>
              <label>
                Last Name
                <input
                  value={row.lastName || ""}
                  onChange={(e) => change("lastName", e.target.value)}
                />
              </label>
              <label>
                Owner Name
                <input
                  value={row.ownerName || ""}
                  onChange={(e) => change("ownerName", e.target.value)}
                />
              </label>
              <label>
                Owner Mobile
                <input
                  value={row.ownerMobile || ""}
                  onChange={(e) => change("ownerMobile", e.target.value)}
                />
              </label>
              <label>
                Aadhaar
                <input
                  value={row.ownerAadhaar || ""}
                  onChange={(e) =>
                    change("ownerAadhaar", digits(e.target.value).slice(0, 12))
                  }
                />
              </label>
              <label>
                Owner PAN
                <input
                  value={row.ownerPan || ""}
                  onChange={(e) =>
                    change("ownerPan", e.target.value.toUpperCase())
                  }
                />
              </label>
              <label>
                Passport Number
                <input
                  value={row.passportNumber || ""}
                  onChange={(e) => change("passportNumber", e.target.value)}
                />
              </label>
              <label>
                Owner Pincode
                <input
                  value={row.ownerPincode || ""}
                  onChange={(e) => lookupPincode("owner", e.target.value)}
                  maxLength={6}
                />
              </label>
              <label>
                Owner Area
                {ownerAreas.length > 1 ? (
                  <select
                    value={row.ownerArea || ""}
                    onChange={(e) => selectArea("owner", e.target.value)}
                  >
                    <option value="">Select Area</option>
                    {ownerAreas.map((a, i) => (
                      <option key={`${a.area}-${i}`} value={a.area}>
                        {a.area}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={row.ownerArea || ""}
                    onChange={(e) => change("ownerArea", e.target.value)}
                  />
                )}
              </label>
              <label>
                Owner City
                <input
                  value={row.ownerCity || ""}
                  onChange={(e) => change("ownerCity", e.target.value)}
                />
              </label>
              <label>
                Owner District
                <input
                  value={row.ownerDistrict || ""}
                  onChange={(e) => change("ownerDistrict", e.target.value)}
                />
              </label>
              <label>
                Owner State
                <input
                  value={row.ownerState || ""}
                  onChange={(e) => change("ownerState", e.target.value)}
                />
              </label>
              <label className="span2">
                Owner Address
                <textarea
                  value={row.ownerAddress || ""}
                  onChange={(e) => change("ownerAddress", e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="sectionLabel">Commercial & Other Information</div>
            <div className="formGrid">
              <label>
                Payment Type
                <select
                  value={row.paymentType || "CASH"}
                  onChange={(e) => change("paymentType", e.target.value)}
                >
                  <option>CASH</option>
                  <option>CREDIT</option>
                </select>
              </label>
              <label>
                Due Date
                <input
                  value={row.dueDate || ""}
                  onChange={(e) => change("dueDate", e.target.value)}
                />
              </label>
              <label>
                Credit Period (Days)
                <input
                  type="number"
                  value={row.creditDays ?? ""}
                  onChange={(e) => change("creditDays", e.target.value)}
                />
              </label>
              <label>
                Credit Limit
                <input
                  type="number"
                  value={row.creditLimit ?? ""}
                  onChange={(e) => change("creditLimit", e.target.value)}
                />
              </label>
              <label>
                Grace Days
                <input
                  type="number"
                  value={row.graceDays ?? ""}
                  onChange={(e) => change("graceDays", e.target.value)}
                />
              </label>
              <label>
                Region Type
                <select
                  value={row.regionType || "LOCAL"}
                  onChange={(e) => change("regionType", e.target.value)}
                >
                  <option>LOCAL</option>
                  <option>OUTSIDE</option>
                </select>
              </label>
              <label>
                Assigned Transport
                <input
                  value={row.assignedTransport || ""}
                  onChange={(e) => change("assignedTransport", e.target.value)}
                />
              </label>
              <label>
                Transport Global ID
                <input
                  value={row.assignedTransportGlobalId || ""}
                  onChange={(e) =>
                    change("assignedTransportGlobalId", e.target.value)
                  }
                />
              </label>
              <label>
                Booking Station ID
                <input
                  value={row.assignedTransportBookingStationId || ""}
                  onChange={(e) =>
                    change("assignedTransportBookingStationId", e.target.value)
                  }
                />
              </label>
              <label>
                Delivery Station ID
                <input
                  value={row.assignedTransportDeliveryStationId || ""}
                  onChange={(e) =>
                    change("assignedTransportDeliveryStationId", e.target.value)
                  }
                />
              </label>
              <label>
                Service Area
                <input
                  value={row.serviceArea || ""}
                  onChange={(e) => change("serviceArea", e.target.value)}
                />
              </label>
              <label>
                Customer Grade
                <select
                  value={row.gradeCode || ""}
                  onChange={(e) => {
                    const g = grades.find((x) => x.code === e.target.value);
                    patch({
                      gradeCode: e.target.value,
                      gradeDiscountPct: Number(g?.discountPct || 0),
                    });
                  }}
                >
                  <option value="">No Grade</option>
                  {grades.map((g) => (
                    <option key={g._id} value={g.code}>
                      {g.code} — {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grade Discount %
                <input
                  type="number"
                  value={row.gradeDiscountPct ?? ""}
                  onChange={(e) => change("gradeDiscountPct", e.target.value)}
                />
              </label>
              <label>
                Price List
                <input
                  value={row.priceList || "STANDARD"}
                  onChange={(e) => change("priceList", e.target.value)}
                />
              </label>
              <label>
                Category
                <input
                  value={row.category || ""}
                  onChange={(e) => change("category", e.target.value)}
                />
              </label>
              <label className="geoIconField">
                Geotagging
                <div className="gstInputRow">
                  <input
                    value={row.geotagging || ""}
                    onChange={(e) => change("geotagging", e.target.value)}
                    placeholder="Latitude, Longitude"
                  />
                  <button
                    type="button"
                    className="gstLookupButton iconOnlyAction"
                    onClick={captureGeo}
                    title="Capture geotag"
                  >
                    <MapPin size={16} />
                  </button>
                </div>
              </label>
              <label>
                Customer Password
                <input
                  type="password"
                  value={row.password || ""}
                  onChange={(e) => change("password", e.target.value)}
                />
              </label>
              <label>
                Portal Login
                <select
                  value={row.portalLoginEnabled ? "YES" : "NO"}
                  onChange={(e) =>
                    change("portalLoginEnabled", e.target.value === "YES")
                  }
                >
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
              </label>
              <label className="span2">
                Remarks
                <textarea
                  value={row.remarks || ""}
                  onChange={(e) => change("remarks", e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="sectionLabel">Opening Balance / Accounting</div>
            <div className="formGrid">
              <label>
                Account Head
                <input
                  disabled
                  value={
                    (row.partyType || "DEBITOR") === "CREDITOR"
                      ? "Sundry Creditors"
                      : "Sundry Debtors"
                  }
                />
              </label>
              <label>
                Opening Balance
                <input
                  type="number"
                  value={row.openingBalance ?? ""}
                  onChange={(e) => change("openingBalance", e.target.value)}
                />
              </label>
              <label>
                Balance Type
                <select
                  value={row.openingBalanceType || "DR"}
                  onChange={(e) => change("openingBalanceType", e.target.value)}
                >
                  <option>DR</option>
                  <option>CR</option>
                </select>
              </label>
              <label>
                Opening Financial Year
                <input
                  value={row.financialYear || ""}
                  onChange={(e) => change("financialYear", e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>
      </div>
      <BulkOriginalUploadedRow source={row._sourceData} />
    </>
  );
}

function BulkOriginalUploadedRow({ source }) {
  const entries = Object.entries(source || {});
  if (!entries.length) return null;
  const printable = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };
  return (
    <details
      style={{
        marginTop: 14,
        border: "1px solid var(--border,#d0d5dd)",
        borderRadius: 10,
        background: "var(--panel,#fff)",
      }}
    >
      <summary
        style={{ cursor: "pointer", padding: "12px 14px", fontWeight: 700 }}
      >
        Original Uploaded Row — {entries.length} source column(s)
      </summary>
      <div
        style={{
          padding: "0 14px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 10,
        }}
      >
        {entries.map(([key, value]) => (
          <label key={key} style={{ minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{key}</span>
            <textarea
              readOnly
              value={printable(value)}
              style={{ minHeight: 58, resize: "vertical" }}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
