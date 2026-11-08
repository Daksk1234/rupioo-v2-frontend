import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Landmark,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import BookMonthAccordion from "../components/BookMonthAccordion.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import { api, getUser } from "../lib/api.js";
import { mayEditPostedVoucher, mayDeletePostedVoucher } from "../lib/voucherEditPermissions.js";
import {isBookSuperadmin,bookCorrectionSourceKey,deleteBookRow} from '../lib/superadminBookCorrection.js';
import { useBankCashColumnEditor } from "../lib/useBankCashColumnEditor.jsx";
import {
  fetchTransactionParties,
  partyOptionLabel,
} from "../lib/partyDirectory.js";
import {
  currentFinancialYear,
  financialYearOptions,
} from "../lib/financialYear.js";
import "../profile-bank.css";
import "../transaction-books.css";
import { exportTransactionList } from "../lib/transactionExport.js";
import { fetchCompanyBankAccounts } from "../lib/companyBankOptions.js";
import {
  fetchAccountPaths,
  accountPathHeaders,
  accountPathForParty,
} from "../lib/accountHierarchyPaths.js";

const money = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const fyMonthOrder = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];
const currentMonthName = () => monthNames[new Date().getMonth()];
const monthBounds = (fy, monthName) => {
  const startYear = Number(String(fy || "").slice(0, 4));
  const monthIndex = monthNames.indexOf(monthName);
  if (!Number.isFinite(startYear)) return { fromDate: "", toDate: "" };
  if (monthName === "ALL")
    return { fromDate: `${startYear}-04-01`, toDate: `${startYear + 1}-03-31` };
  if (monthIndex < 0) return { fromDate: "", toDate: "" };
  const year = monthIndex >= 3 ? startYear : startYear + 1;
  const mm = String(monthIndex + 1).padStart(2, "0");
  const last = String(new Date(year, monthIndex + 1, 0).getDate()).padStart(
    2,
    "0",
  );
  return { fromDate: `${year}-${mm}-01`, toDate: `${year}-${mm}-${last}` };
};
// Bank statement view: credit=inflow, debit=outflow. Positive balance is Cr;
// negative balance is Dr (overdraft). This does NOT change journal Dr/Cr.
const bankBalance = (v) =>
  `${money(Math.abs(Number(v || 0)))} ${Number(v || 0) < 0 ? "Dr" : "Cr"}`;
// Treat statement dates as calendar days. Never convert them through the
// browser's time zone (which can move a date to the previous/next day).
const dateInputValue = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
};
const fmtDate = (value) => {
  const day = dateInputValue(value);
  if (!day) return "—";
  const [year, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}/${year}`;
};
const bankPartyRef = (b) => `BANK:${String(b?.bankAccountId || "")}`;
const bankPartyLabel = (b) =>
  `${b?.accountHolderName || b?.bankName || "Bank Account"} • BANK ACCOUNT • ${b?.bankName || "Bank"}${b?.accountNumber ? ` • ${String(b.accountNumber).slice(-4)}` : ""}`;
const partyRef = (p) =>
  String(p?.partyRef || p?.globalCustomerId || p?._id || "");
const financePartyLabel = (p) => {
  if (String(p?.partyKind || "").toUpperCase() === "USER") {
    const account = String(
      p?.accountHierarchy ||
        p?.tallyAccountTypeName ||
        p?.accountType ||
        p?.tallyAccountTypeCode ||
        "USER",
    ).trim();
    return `${p?.name || "User"} • USER${account ? ` • ${account}` : ""}`;
  }
  return partyOptionLabel(p);
};
const apiErrorText = (e) => {
  const rows = e?.details?.errors;
  if (Array.isArray(rows) && rows.length)
    return `${e.message}: ${rows
      .slice(0, 8)
      .map((x) => `Row ${x.row || "?"}: ${x.error || "Invalid"}`)
      .join(" • ")}`;
  return e?.message || "Request failed";
};

export default function BankTransactionPage({ statementPage = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const superadmin=isBookSuperadmin(user);
  const selectedFy = currentFinancialYear();
  const years = financialYearOptions(user, { count: 10 });
  const [fy, setFy] = useState(selectedFy);
  const [openMonth, setOpenMonth] = useState("");
  const [monthSummaries, setMonthSummaries] = useState([]);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [submittedQ, setSubmittedQ] = useState("");
  const detailSeq=useRef(0), summarySeq=useRef(0);
  const [banks, setBanks] = useState([]),
    [parties, setParties] = useState([]),
    [rows, setRows] = useState([]),
    [totals, setTotals] = useState({ debit: 0, credit: 0, possiblyTruncated: false }),
    [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [bankFilter, setBankFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState("ALL"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]);
  const [show, setShow] = useState(statementPage),
    [uploadBank, setUploadBank] = useState(""),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null),
    [assignments, setAssignments] = useState({}),
    [reviewFilter, setReviewFilter] = useState("ALL"),
    [draftRows, setDraftRows] = useState([]);
  const [msg, setMsg] = useState(""),
    [error, setError] = useState("");

  const inline = useBankCashColumnEditor({channel: "bank", user, rows, financialYear: fy,
    onSaved: () => refreshBooks(), setError, setMessage: setMsg});

  // Never carry an unsaved correction over to another bank/FY/filter.
  useEffect(() => { inline.cancel(); }, [fy, bankFilter, typeFilter, submittedQ]);

  const loadBanks = () =>
    fetchCompanyBankAccounts(fy)
      .then((items) => {
        setBanks(items);
        const mainNumber = String(
          user?.companyProfile?.bankDetails?.accountNumber || "",
        ).replace(/\s/g, "");
        const primary =
          items.find((x) => x.isPrimary) ||
          (mainNumber
            ? items.find(
                (x) =>
                  String(x.accountNumber || "").replace(/\s/g, "") ===
                  mainNumber,
              )
            : null) ||
          items[0];
        setBankFilter((current) =>
          items.some((b) => String(b.bankAccountId) === String(current))
            ? current
            : primary?.bankAccountId || "",
        );
        setUploadBank((current) =>
          items.some((b) => String(b._id) === String(current))
            ? current
            : primary?._id || "",
        );
      })
      .catch((e) => setError(e.message));
  const loadParties = () =>
    Promise.all([
      fetchTransactionParties(500),
      api("/access/users/options"),
      fetchAccountPaths().catch(() => new Map()),
    ])
      .then(([customers, users, accountPaths]) => {
        const combined = [
          ...(customers || [])
            .filter((x) =>
              String(x.systemKey || "").toUpperCase() !== "CASH" &&
              String(x.accountingProfile?.systemAccountCode || "").toUpperCase() !== "SYS_CASH"
            )
            .map((x) => ({
              ...x,
              partyKind: "CUSTOMER",
              partyRef: String(x.globalCustomerId || x._id || ""),
            })),
          ...(users || [])
            .filter(
              (x) =>
                x.ledgerNodeKind !== "GROUP" &&
                String(x.systemKey || "").toUpperCase() !== "CASH" &&
                String(x.accountingProfile?.systemAccountCode || "").toUpperCase() !== "SYS_CASH",
            )
            .map((x) => ({
              ...x,
              partyKind: "USER",
              partyRef: `USER:${x._id}`,
              accountHierarchy: (accountPaths.get(`USER:${x._id}`) || [])
                .filter(Boolean)
                .join(" > "),
            })),
        ].filter((x) => partyRef(x));
        combined.sort((a, b) =>
          financePartyLabel(a).localeCompare(financePartyLabel(b), "en", {
            sensitivity: "base",
          }),
        );
        setParties(combined);
      })
      .catch(() => setParties([]));
  const load = useCallback(async (next = 1) => {
    if (!bankFilter || !openMonth) return;
    const seq=++detailSeq.current;
    setDetailBusy(true);
    try {
      setError("");
      const { fromDate, toDate } = monthBounds(fy, openMonth);
      const d = await api(`/banks/transactions?financialYear=${encodeURIComponent(fy)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&bankAccountId=${encodeURIComponent(bankFilter)}&type=${encodeURIComponent(typeFilter)}&q=${encodeURIComponent(submittedQ)}&page=${next}&limit=50`);
      if(seq!==detailSeq.current)return;
      setRows(d.items || []);
      setMeta(d.meta || { page: next, pages: 1, total: 0 });
      setPage(d.meta?.page || next);
      setSelected([]);
    } catch (e) {if(seq===detailSeq.current){setError(apiErrorText(e));setRows([]);}}
    finally {if(seq===detailSeq.current)setDetailBusy(false);}
  },[bankFilter,openMonth,fy,typeFilter,submittedQ]);
  const loadSummary = useCallback(async () => {
    if(!bankFilter)return;
    const seq=++summarySeq.current;
    setSummaryBusy(true);
    try {
      setError("");
      const {fromDate,toDate}=monthBounds(fy,"ALL");
      // The month headers are always the true FY account totals.
      // Type and search filters apply only to the expanded transactions.
      const d=await api(`/banks/transactions?financialYear=${encodeURIComponent(fy)}&fromDate=${fromDate}&toDate=${toDate}&bankAccountId=${encodeURIComponent(bankFilter)}&type=ALL&q=&page=1&limit=10&groupByMonth=1`);
      if(seq!==summarySeq.current)return;
      setMonthSummaries(d.monthlySummaries||[]);
      setTotals(d.totals||{debit:0,credit:0,possiblyTruncated:false});
    }catch(e){if(seq===summarySeq.current){setError(apiErrorText(e));setMonthSummaries([]);}}
    finally{if(seq===summarySeq.current)setSummaryBusy(false);}
  },[fy,bankFilter]);
  const refreshBooks=async()=>{await loadSummary();if(openMonth)await load(1);};
  const toggleSelected = (id) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const toggleAll = (checked, ids) =>
    setSelected((cur) =>
      checked
        ? [...new Set([...cur, ...ids])]
        : cur.filter((x) => !ids.includes(x)),
    );
  const bulkDelete = async () => {
    if(superadmin){
      const chosen=rows.filter(r=>selected.includes(String(r._listId||r._id)));
      if(!chosen.length)return setError('Select entries from the expanded month before deleting');
      const reason=window.prompt(`Remove ${chosen.length} BANK transactions from the active book? Original records and a correction audit are retained.
Reason:`);
      if(reason===null)return;
      if(reason.trim().length<5)return setError('Enter a reason of at least five characters');
      setBusy(true);setError('');let completed=0;const failures=[];
      for(const row of chosen){
        try{await api('/transactions/book-corrections',{method:'POST',body:JSON.stringify({
          book:'BANK',sourceKey:bookCorrectionSourceKey(row,'bank'),financialYear:fy,
          date:String(row.date||'').slice(0,10),debit:0,credit:0,deleted:true,
          remarks:row.remarks||'',partyName:row.matchedPartyName||'',reason:reason.trim(),
        })});completed++;}
        catch(e){failures.push(`${row.transactionId}: ${e.message}`);}
      }
      setBusy(false);setSelected([]);
      setMsg(`${completed} BANK entries removed; audit and balanced correction saved.`);
      if(failures.length)setError(failures.join(' | '));
      await refreshBooks();return;
    }
    if (!selected.length)
      return setError("Select at least one bank transaction");
    if (
      !confirm(
        `Delete ${selected.length} selected bank transaction(s)? Their linked receipt/payment and accounting entries will also be deleted.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const d = await api("/banks/transactions/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ financialYear: fy, ids: selected }),
      });
      setMsg(`${d.deleted || 0} selected bank transaction(s) deleted`);
      await refreshBooks();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    loadBanks();
    loadParties();
  }, [fy]);
  useEffect(()=>{
    detailSeq.current++;
    setOpenMonth("");setRows([]);setSelected([]);
    setMeta({page:1,pages:1,total:0});
    loadSummary();
  },[loadSummary]);
  useEffect(()=>{
    detailSeq.current++;
    if(openMonth)load(1);
  },[load]);

  const bankPartyOptions = useMemo(
    () =>
      banks
        .filter((b) => String(b._id) !== String(uploadBank) && b.bankAccountId)
        .map((b) => ({
          ref: bankPartyRef(b),
          label: bankPartyLabel(b),
          bank: b,
        })),
    [banks, uploadBank],
  );
  const labelById = useMemo(() => {
    const m = new Map();
    for (const p of parties) m.set(partyRef(p), financePartyLabel(p));
    for (const b of bankPartyOptions) m.set(b.ref, b.label);
    m.set("CASH:COMPANY", "Company Cash-in-Hand (Contra)");
    return m;
  }, [parties, bankPartyOptions]);
  const idByLabel = useMemo(() => {
    const m = new Map();
    for (const p of parties) m.set(financePartyLabel(p), partyRef(p));
    for (const b of bankPartyOptions) m.set(b.label, b.ref);
    m.set("Suspense Account", "SUSPENSE");
    m.set("Company Cash-in-Hand (Contra)", "CASH:COMPANY");
    return m;
  }, [parties, bankPartyOptions]);

  const openUpload = () => {
    navigate("/dms/banking/statement-upload");
    setShow(true);
    setPreview(null);
    setAssignments({});
    setDraftRows([]);
    setFile(null);
    setReviewFilter("ALL");
    setError("");
    setMsg("");
    if (!uploadBank && banks.length)
      setUploadBank(banks.find((x) => x.isPrimary)?._id || banks[0]._id);
  };
  const downloadTemplate = () => {
    const csv = "Date,Party Name,Remarks,Mode,Debit,Credit\n";
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    a.href = url;
    a.download = "bank-statement-bulk-upload-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const previewStatement = async () => {
    if (!uploadBank) return setError("Select Bank Account");
    if (!file) return setError("Choose bank statement file");
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api(`/banks/${uploadBank}/statement-preview`, {
        method: "POST",
        body: fd,
      });
      setPreview(d);
      setDraftRows(
        (d.reviewRows || []).map((r) => ({
          ...r,
          date: dateInputValue(r.date),
          mode: r.mode || "BANK",
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          runningBalance: Number(r.runningBalance || 0),
        })),
      );
      if (d.financialYear) setFy(d.financialYear);
      const next = {};
      for (const r of d.reviewRows || [])
        next[r.rowNo] = {
          partyGlobalId: r.matchedPartyGlobalId || "SUSPENSE",
          partyLabel: r.matchedPartyGlobalId
            ? labelById.get(String(r.matchedPartyGlobalId)) ||
              r.matchedPartyName ||
              "Suspense Account"
            : "Suspense Account",
        };
      setAssignments(next);
      setMsg(
        `Review ready: ${d.autoMatchedRows || 0} matched • ${d.unmatchedRows || 0} suspense • ${d.duplicateRows || 0} duplicates skipped • Running Balance calculated automatically${d.ignoredTemplateRows ? ` • ${d.ignoredTemplateRows} old template sample rows ignored` : ""}${d.ignoredOpeningRows ? ` • old opening row ignored` : ""}`,
      );
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const changeParty = (rowNo, label) => {
    const id = idByLabel.get(label);
    setAssignments((cur) => ({
      ...cur,
      [rowNo]: {
        partyGlobalId: id || "SUSPENSE",
        partyLabel: label || "Suspense Account",
      },
    }));
  };
  const changeReviewField = (rowNo, key, value) =>
    setDraftRows((cur) =>
      cur.map((r) =>
        Number(r.rowNo) === Number(rowNo) ? { ...r, [key]: value } : r,
      ),
    );
  const changeReviewType = (rowNo, type) =>
    setDraftRows((cur) =>
      cur.map((r) => {
        if (Number(r.rowNo) !== Number(rowNo)) return r;
        const amount = Math.max(Number(r.debit || 0), Number(r.credit || 0));
        return {
          ...r,
          transactionType: type,
          debit: type === "PAYMENT" ? amount : 0,
          credit: type === "RECEIPT" ? amount : 0,
        };
      }),
    );
  const changeReviewAmount = (rowNo, key, value) =>
    setDraftRows((cur) =>
      cur.map((r) => {
        if (Number(r.rowNo) !== Number(rowNo)) return r;
        const amount = value === "" ? 0 : Number(value || 0);
        if (key === "debit")
          return {
            ...r,
            debit: amount,
            credit: amount > 0 ? 0 : Number(r.credit || 0),
            transactionType: amount > 0 ? "PAYMENT" : r.transactionType,
          };
        return {
          ...r,
          credit: amount,
          debit: amount > 0 ? 0 : Number(r.debit || 0),
          transactionType: amount > 0 ? "RECEIPT" : r.transactionType,
        };
      }),
    );
  const reviewPayload = () =>
    draftRows.map((r) => ({
      rowNo: Number(r.rowNo),
      date: r.date,
      transactionType: r.transactionType,
      remarks: r.remarks || "",
      mode: r.mode || "BANK",
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      partyGlobalId: assignments[r.rowNo]?.partyGlobalId || "SUSPENSE",
    }));
  const persistReview = async (showSuccess = true) => {
    const d = await api(
      `/banks/${uploadBank}/statement-review/${preview.importId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          financialYear: preview.financialYear || fy,
          rows: reviewPayload(),
        }),
      },
    );
    if (d.reviewRows) {
      setDraftRows(
        d.reviewRows.map((r) => ({
          ...r,
          date: dateInputValue(r.date),
          mode: r.mode || "BANK",
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          runningBalance: Number(r.runningBalance || 0),
        })),
      );
      setPreview((cur) => ({ ...cur, ...d, reviewRows: d.reviewRows }));
      const next = {};
      for (const r of d.reviewRows)
        next[r.rowNo] = {
          partyGlobalId: r.matchedPartyGlobalId || "SUSPENSE",
          partyLabel: r.matchedPartyGlobalId
            ? labelById.get(String(r.matchedPartyGlobalId)) ||
              r.matchedPartyName ||
              "Suspense Account"
            : "Suspense Account",
        };
      setAssignments(next);
    }
    if (showSuccess) setMsg("Review changes saved");
    return d;
  };
  const saveReview = async () => {
    if (!preview?.importId) return;
    setBusy(true);
    setError("");
    try {
      await persistReview(true);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const submitStatement = async () => {
    if (!preview?.importId) return;
    setBusy(true);
    setError("");
    try {
      await persistReview(false);
      const payload = Object.entries(assignments).map(([rowNo, x]) => ({
        rowNo: Number(rowNo),
        partyGlobalId: x.partyGlobalId || "SUSPENSE",
      }));
      const d = await api(
        `/banks/${uploadBank}/statement-submit/${preview.importId}`,
        {
          method: "POST",
          body: JSON.stringify({
            financialYear: preview.financialYear || fy,
            assignments: payload,
          }),
        },
      );
      setMsg(
        `Statement submitted: ${d.postedRows || 0} transactions • ${d.postedReceipts ?? 0} receipts • ${d.postedPayments ?? 0} payments • ${d.unmatchedRows || 0} Suspense${d.errorRows ? ` • ${d.errorRows} rejected (see server errors)` : ""}`,
      );
      setShow(false);
      setPreview(null);
      setDraftRows([]);
      setFile(null);
      navigate("/dms/banking");
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const filteredReview = draftRows.filter(
    (r) =>
      reviewFilter === "ALL" ||
      (reviewFilter === "SUSPENSE"
        ? (assignments[r.rowNo]?.partyGlobalId || "SUSPENSE") === "SUSPENSE"
        : (assignments[r.rowNo]?.partyGlobalId || "SUSPENSE") !== "SUSPENSE"),
  );
  const suspenseCount = Object.values(assignments).filter(
    (x) => (x.partyGlobalId || "SUSPENSE") === "SUSPENSE",
  ).length;
  const receiptCount = draftRows.filter(
    (x) => x.transactionType === "RECEIPT",
  ).length;
  const paymentCount = draftRows.filter(
    (x) => x.transactionType === "PAYMENT",
  ).length;

  const activeBank = banks.find(
    (b) => String(b.bankAccountId) === String(bankFilter),
  );
  const bankOpening = activeBank
    ? Math.abs(Number(activeBank.fyOpeningBalance ?? activeBank.openingBalance ?? 0)) *
      ((activeBank.fyOpeningBalanceType ?? activeBank.openingBalanceType) === "DR" ? -1 : 1)
    : 0;
  const rebuildBankBalances = async () => {
    if (!bankFilter) return setError("Select a bank account first");
    if (!window.confirm(`Recalculate all BANK running balances for FY ${fy} from stored transactions? This does not change journals.`)) return;
    setBusy(true); setError(""); setMsg("");
    try {
      const result = await api('/banks/transactions/rebuild-running', {
        method: 'POST', body: JSON.stringify({financialYear:fy,bankAccountId:bankFilter}),
      });
      setMsg(`Rebuilt ${result.updated || 0} BANK running balances from Debit/Credit movements.`);
      await refreshBooks();
    } catch(e) {setError(e.message || 'Unable to rebuild balances');}
    finally {setBusy(false);}
  };
  const downloadStatement = async (format, printWindow) => {
    if (!bankFilter) return setError("Choose one bank account first");
    setError("");
    try {
      const accountPaths = await fetchAccountPaths().catch(() => new Map());
      const all = [];
      const limit = 200;
      let totalPages = 1;
      for (let p = 1; p <= totalPages; p++) {
        if (p > 100) throw new Error("Export exceeds 20,000 transactions");
        const { fromDate, toDate } = monthBounds(fy, "ALL");
        const d = await api(
          `/banks/transactions?financialYear=${encodeURIComponent(fy)}&fromDate=${fromDate}&toDate=${toDate}&bankAccountId=${encodeURIComponent(bankFilter)}&type=${encodeURIComponent(typeFilter)}&q=${encodeURIComponent(q)}&page=${p}&limit=${limit}`,
        );
        all.push(...(d.items || []));
        totalPages = Math.max(1,Number(d.meta?.pages||1));
      }
      const heads = [
        "Date",
        "Party",
        ...accountPathHeaders,
        "Remarks",
        "Debit",
        "Credit",
        "Running Balance",
      ];
      const records = [
        [
          "Opening Balance",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          `${money(Math.abs(bankOpening))} ${bankOpening < 0 ? "Dr" : "Cr"}`,
        ],
        ...all.map((x) => [
          fmtDate(x.date),
          x.partyNameDisplay || x.matchedPartyName || "",
          ...accountPathForParty(accountPaths, x.matchedPartyGlobalId),
          x.remarks || "",
          Number(x.debit || 0).toFixed(2),
          Number(x.credit || 0).toFixed(2),
          Number(x.runningBalance || 0).toFixed(2),
        ]),
      ];
      await exportTransactionList(
        "Bank",
        format,
        heads,
        records,
        `${fy}-Full-FY-${activeBank?.accountNumber || ""}`,
        printWindow,
      );
    } catch (e) {
      setError(apiErrorText(e));
    }
  };

  const deleteDirectBankVoucher=async(row,kind,id)=>{
    const reason=window.prompt(`Delete ${row.transactionId || "this voucher"} from Bank Book? The voucher and journal will be voided, not physically erased.\nEnter reason (at least 5 characters):`);
    if(reason===null)return;
    if(reason.trim().length<5)return setError("Enter a deletion reason of at least 5 characters");
    setBusy(true);setError("");
    try{
      await api(`/transactions/vouchers/${kind}/${encodeURIComponent(id)}/void`,{
        method:"POST",body:JSON.stringify({financialYear:fy,reason:reason.trim()}),
      });
      setMsg(`${row.transactionId || "Voucher"} voided; bank balance recalculated`);
      await refreshBooks();
    }catch(e){setError(apiErrorText(e));}
    finally{setBusy(false);}
  };
  const deleteSuperadminBankRow=async(row)=>{
    setBusy(true);setError('');
    try{const result=await deleteBookRow({row,channel:'bank',financialYear:fy});
      if(!result.cancelled){setMsg('Removed from BANK book with balanced, audited correction.');await refreshBooks();}}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const columns = [
    { key: "date", label: "Date", headerContent: inline.header("date", "Date"),
      render: (r) => inline.cell(r, "date", fmtDate(r.date)) },
    {
      key: "matchedPartyName",
      label: "Party", headerContent: inline.header("party", "Party"),
      render: (r) => {
        const display = (() => {
        const ref = String(r.matchedPartyGlobalId || "");
        if (!ref) return <span className="suspenseText">Suspense Account</span>;
        if (ref.startsWith("USER:"))
          return (
            <EditMasterLink to="/dms/users" id={ref.slice(5)} resource="user">
              {r.partyNameDisplay || r.matchedPartyName || "—"}
            </EditMasterLink>
          );
        if (ref.startsWith("BANK:"))
          return (
            <span>
              {r.partyNameDisplay || r.matchedPartyName || "Bank Account"}
            </span>
          );
        return (
          <EditMasterLink to="/dms/customers" id={ref} resource="customer">
            {r.partyNameDisplay || r.matchedPartyName || "—"}
          </EditMasterLink>
        );
        })();
        return inline.cell(r, "party", display);
      },
    },
    {
      key: "remarks",
      label: "Remarks", headerContent: inline.header("remarks", "Remarks"),
      width: 520,
      render: (r) => inline.cell(r, "remarks", <span className="financeRemarkCell">{r.remarks || r.partyName || "—"}</span>),
    },
    {
      key: "debit",
      label: "Debit", headerContent: inline.header("debit", "Debit"),
      render: (r) => inline.cell(r, "debit", Number(r.debit || 0) ? money(r.debit) : "—"),
    },
    {
      key: "credit",
      label: "Credit", headerContent: inline.header("credit", "Credit"),
      render: (r) => inline.cell(r, "credit", Number(r.credit || 0) ? money(r.credit) : "—"),
    },
    {
      key: "runningBalance",
      label: "Running Bal.",
      render: (r) => bankBalance(r.runningBalance),
    },
    {
      key: "edit", label: "Edit", width: 76,
      render: (r) => {
        if(superadmin)return <button type="button" className="btn ghost" disabled={inline.editing||inline.loading}
          aria-label={`Edit ${r.transactionId}`} title="Edit displayed BANK rows" onClick={inline.beginAll}><Pencil size={15}/></button>;
        // Source-of-truth edits are supported for direct posted DMS vouchers.
        // A submitted bank-statement row is not a direct voucher: changing it
        // without reversing its imported journal would corrupt reconciliation.
        const source=String(r._listId||"");
        const match=/^(RCT|PAY):(.+)$/.exec(source);
        if(!match || r._directVoucherEditable === false) return <span title="Imported statements, OTP receipts and contra entries must be corrected in their source workflow">—</span>;
        const kind=match[1]==="RCT"?"receipts":"payments";
        if(!mayEditPostedVoucher(user,kind,"bank"))return <span title="Edit Posted Voucher permission is not assigned">—</span>;
        return <button type="button" className="btn ghost" aria-label={`Edit ${r.transactionId}`} title="Edit posted voucher" onClick={()=>navigate(`/dms/transactions/edit/${kind}/${encodeURIComponent(match[2])}?fy=${encodeURIComponent(fy)}&back=bank`)}><Pencil size={15}/></button>;
      },
    },
    {
      key: "delete", label: "Delete", width: 72,
      render: (r) => {
        if(superadmin)return <button type="button" className="btn ghost danger transactionBulkDeleteIcon"
          disabled={busy} title="Remove from active BANK book (audited)" aria-label={`Delete ${r.transactionId}`}
          onClick={()=>deleteSuperadminBankRow(r)}><Trash2 size={15}/></button>;
        const match=/^(RCT|PAY):(.+)$/.exec(String(r._listId||""));
        if(!match)return <span title="Imported statements and contra require their source workflow">—</span>;
        const kind=match[1]==="RCT"?"receipts":"payments";
        if(!mayDeletePostedVoucher(user,kind,"bank"))return "—";
        return <button className="btn ghost danger transactionBulkDeleteIcon" disabled={busy}
          aria-label={`Delete ${r.transactionId}`} title="Void direct voucher (audit retained)"
          onClick={()=>deleteDirectBankVoucher(r,kind,match[2])}><Trash2 size={15}/></button>;
      },
    },
  ];

  return (
    <>
      {msg && <div className="resultBanner good">{msg}</div>}
      {error && <div className="resultBanner bad">{error}</div>}

      {!statementPage && (
        <section className="panel transactionLedgerPanel">
          <div className="toolbar financeUnifiedToolbar transactionSingleToolbar">
            <select
              value={fy}
              onChange={(e) => {
                setFy(e.target.value);
              }}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select
              aria-label="Bank Account"
              value={bankFilter}
              onChange={(e) => {
                setBankFilter(e.target.value);
              }}
            >
              {!banks.length && <option value="">No bank accounts</option>}
              {banks.map((b) => (
                <option key={b._id} value={b.bankAccountId}>
                  {b.bankName} • {b.accountNumber}
                  {b.isPrimary ? " • Main" : ""}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>ALL</option>
              <option>RECEIPT</option>
              <option>PAYMENT</option>
            </select>
            <div className="searchBox">
              <Search size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSubmittedQ(q)}
                placeholder="Party, remarks, mode, voucher…"
              />
            </div>
            <button className="btn ghost" onClick={() => {setSubmittedQ(q);refreshBooks();}}>
              <RefreshCw size={15} />
              Refresh
            </button>
            {(["MASTER","SUPERADMIN","COMPANY_ADMIN","DMS_ADMIN","ADMIN","ADMINISTRATOR"].includes(String(user?.role||"").toUpperCase())) &&
              <button className="btn ghost" disabled={busy || !bankFilter} onClick={rebuildBankBalances} title="Recalculate historical bank balances, including balances saved by older versions">Rebuild Running Balances</button>}
            <select
              aria-label="Download Bank Transactions"
              value=""
              onChange={(e) => {
                const value = e.target.value;
                e.target.value = "";
                if (value === "template") downloadTemplate();
                else if (value)
                  downloadStatement(
                    value,
                    value === "print" ? window.open("", "_blank") : null,
                  );
              }}
            >
              <option value="">Download ▾</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="print">Print</option>
              <option value="template">Template</option>
            </select>
            <button className="btn ghost" onClick={openUpload}>
              <Upload size={15} />
              Bulk Upload Statement
            </button>
            <button
              className="btn primary"
              onClick={() => navigate("/dms/banking/add")}
            >
              <span>+</span> Add Transaction
            </button>
            <button className="btn ghost" onClick={() => navigate("/dms/transactions/contra")}>Cash / Bank Contra</button>
            {!inline.editing ? <button type="button" className="btn ghost" disabled={inline.loading || detailBusy || !rows.length}
              onClick={inline.begin} title="Click the Date, Party, Remarks, Debit or Credit headings to select columns, then Edit">{inline.loading ? "Loading…" : `Edit Columns${inline.selectedColumns.length ? ` (${inline.selectedColumns.length})` : ''}`}</button>
              : <>
                <button type="button" className="btn primary" disabled={inline.loading} onClick={inline.save}>Save All Changes{inline.changedCount ? ` (${inline.changedCount})` : ''}</button>
                <button type="button" className="btn ghost" disabled={inline.loading} onClick={inline.cancel}>Cancel Editing</button>
              </>}
            {(user?.role === "MASTER" || (user?.permissions || []).includes("*") || (user?.permissions || []).includes("dms.finance_reports.bank_statement.delete")) && <button
              type="button"
              className="btn ghost danger transactionBulkDeleteIcon"
              disabled={!selected.length || busy}
              onClick={bulkDelete}
              aria-label={`Bulk delete ${selected.length} selected bank transactions`}
              title={`Bulk delete selected (${selected.length})`}
            >
              <Trash2 size={16} />
            </button>}
          </div>
          <small className="bookInlineHelp">{superadmin?'Superadmin: click any column headings or a row Edit icon, edit in the table, then Save All Changes. Corrections are balanced and audited; original imported and statutory records remain preserved.':'Select column headings to edit permitted DMS vouchers. Calculated Running Balance is read-only.'}</small>
          <div className="cashbookBalanceStrip bankTotalsBar">
            <span>Bank Opening <strong>{`${money(Math.abs(bankOpening))} ${bankOpening < 0 ? "Cr" : "Dr"}`}</strong></span>
            <span>Debit Total <strong>{money(totals.debit)}</strong></span>
            <span>Credit Total <strong>{money(totals.credit)}</strong></span>
            <span>Account <strong>{activeBank?.accountNumber || "—"}</strong></span>
            {totals.possiblyTruncated && <small title="Too many rows for the existing bank list limit. Narrow the filters for complete totals.">Totals may be limited to the first 5,000 matching entries.</small>}
            <div className="bankColumnEditorSlot" data-bank-column-editor-anchor="true" aria-label="Bank columns editor"/>
          </div>
          {monthSummaries.length ? <BookMonthAccordion
            months={monthSummaries}
            openMonth={openMonth}
            onToggle={month => {inline.cancel();setOpenMonth(month);}}
            loading={detailBusy}
            balanceFormat={bankBalance}
            renderDetail={() => <>
              <DataTable
                rows={rows}
                columns={columns}
                empty="No matching transactions in this month"
                rowId={(r) => r._listId || r._id}
                className="transactionCenteredTable"
                selectable
                selectedIds={selected}
                onToggle={toggleSelected}
                onToggleAll={toggleAll}
                mobileCards
                stickyFirstColumn
              />
              <div className="bookMonthPager">
                <span>{meta.total || 0} matching transactions · Page {meta.page || page} of {Math.max(1,meta.pages||1)}</span>
                <div>
                  <button type="button" className="btn ghost" disabled={detailBusy || (meta.page||page)<=1} onClick={()=>load((meta.page||page)-1)}><ChevronLeft size={15}/>Previous</button>
                  <button type="button" className="btn ghost" disabled={detailBusy || (meta.page||page)>=(meta.pages||1)} onClick={()=>load((meta.page||page)+1)}>Next<ChevronRight size={15}/></button>
                </div>
              </div>
            </>}
          /> : <div className="bookMonthEmpty">{summaryBusy?"Loading financial-year months…": bankFilter?"No monthly summary available.":"Select a bank account."}</div>}
          <div className="bookMonthPager"><span>Showing April–March · Click a month to see its receipts and payments. Search/type filters apply inside expanded months.</span></div>
        </section>
      )}

      {show && (
        <div className="transactionStatementFullPage">
          <section className="panel financeReviewModal">
            <div className="transactionSingleToolbar">
              <button
                className="btn ghost"
                onClick={() => navigate("/dms/banking")}
              >
                Back to Bank
              </button>
              <select
                aria-label="Download Statement Upload Template"
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  e.target.value = "";
                  if (value === "template") downloadTemplate();
                }}
              >
                <option value="">Download ▾</option>
                <option value="template">Template</option>
              </select>
            </div>
            <div className="statementWizardSteps">
              <span className={!preview ? "active" : "done"}>1 Upload</span>
              <span className={preview ? "active" : ""}>
                2 Review Party Mapping
              </span>
              <span>3 Submit</span>
            </div>
            {!preview && (
              <>
                <div className="statementUploadHero">
                  <FileSpreadsheet size={28} />
                  <div>
                    <strong>Simple Bank Statement Format</strong>
                    <span>
                      Date · Party Name (optional) · Remarks · Mode (BANK/CASH)
                      · Debit · Credit
                    </span>
                    <small>
                      Do not upload Running Balance. The system calculates it
                      automatically from the bank opening balance and
                      transaction history.
                    </small>
                  </div>
                </div>
                <div className="formGrid compactGrid financeUploadGrid">
                  <label>
                    Financial Year
                    <input readOnly value="Auto from statement dates" />
                    <small>The Date column decides FY automatically.</small>
                  </label>
                  <label>
                    Bank Account *
                    <select
                      value={uploadBank}
                      onChange={(e) => setUploadBank(e.target.value)}
                    >
                      <option value="">Select Bank</option>
                      {banks.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} •{" "}
                          {String(b.accountNumber || "").slice(-4)}
                          {b.isPrimary ? " • Primary" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wideField">
                    Statement File *
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <div className="financeDetectionNote">
                  <Search size={16} />
                  <span>
                    <strong>AI Narration Matching:</strong> Party Name may be
                    blank. The system reads the complete Remarks/Narration,
                    checks exact bank account numbers, Customer names, User
                    names and Admin-created Bank Accounts, then uses AI fallback
                    for unresolved candidate matches when AI is configured. If
                    it is still uncertain, it keeps the row in{" "}
                    <b>Suspense Account</b> for review.
                  </span>
                </div>
                <div className="formActions">
                  <button
                    className="btn ghost"
                    onClick={() => navigate("/dms/banking")}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    disabled={!file || !uploadBank || busy}
                    onClick={previewStatement}
                  >
                    <Upload size={15} />
                    {busy ? "Reading…" : "Upload & Review"}
                  </button>
                </div>
              </>
            )}
            {preview && (
              <>
                <div className="statementReviewSummary">
                  <div>
                    <small>Financial Year</small>
                    <strong>{preview.financialYear || fy}</strong>
                  </div>
                  <div>
                    <small>Rows to Post</small>
                    <strong>{preview.reviewRows?.length || 0}</strong>
                  </div>
                  <div>
                    <small>Receipts</small>
                    <strong>{receiptCount}</strong>
                  </div>
                  <div>
                    <small>Payments</small>
                    <strong>{paymentCount}</strong>
                  </div>
                  <div className={suspenseCount ? "warning" : ""}>
                    <small>Suspense</small>
                    <strong>{suspenseCount}</strong>
                  </div>
                  <div>
                    <small>Duplicates Skipped</small>
                    <strong>{preview.duplicateRows || 0}</strong>
                  </div>
                  <div>
                    <small>Closing Balance</small>
                    <strong>{bankBalance(preview.closingBalance)}</strong>
                  </div>
                </div>
                <div className="statementReviewToolbar">
                  <div>
                    <strong>Review & Edit Bank Statement</strong>
                    <span>
                      The matcher scans the complete narration for Customer
                      names, User names, saved account numbers and Admin-created
                      Bank Accounts. Every transaction field below can be
                      corrected before posting.
                    </span>
                  </div>
                  <select
                    value={reviewFilter}
                    onChange={(e) => setReviewFilter(e.target.value)}
                  >
                    <option value="ALL">All Rows</option>
                    <option value="SUSPENSE">Suspense Only</option>
                    <option value="MATCHED">Matched Only</option>
                  </select>
                </div>
                <datalist id="finance-party-options">
                  <option value="Suspense Account" />
                  <option value="Company Cash-in-Hand (Contra)" />
                  {parties.map((p) => (
                    <option key={partyRef(p)} value={financePartyLabel(p)} />
                  ))}
                  {bankPartyOptions.map((b) => (
                    <option key={b.ref} value={b.label} />
                  ))}
                </datalist>
                <div className="statementReviewTableWrap">
                  <table className="statementReviewTable editableStatementTable">
                    <thead>
                      <tr>
                        <th>Date</th>
                        {/* <th>Type</th> */}
                        <th>Remarks / Narration</th>
                        <th>Detected / Selected Party</th>
                        {/* <th>Match</th> */}
                        {/* <th>Mode</th> */}
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Auto Run. Bal.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReview.map((r) => {
                        const a = assignments[r.rowNo] || {
                          partyGlobalId: "SUSPENSE",
                          partyLabel: "Suspense Account",
                        };
                        const suspense =
                          (a.partyGlobalId || "SUSPENSE") === "SUSPENSE";
                        return (
                          <tr
                            key={r.rowNo}
                            className={
                              suspense
                                ? "reviewSuspenseRow"
                                : "reviewMatchedRow"
                            }
                          >
                            <td>
                              <input
                                className="reviewDateInput"
                                type="date"
                                value={dateInputValue(r.date)}
                                onChange={(e) =>
                                  changeReviewField(
                                    r.rowNo,
                                    "date",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            {/* <td>
                              <select
                                className="reviewTypeInput"
                                value={
                                  r.transactionType ||
                                  (Number(r.credit || 0) > 0
                                    ? "RECEIPT"
                                    : "PAYMENT")
                                }
                                onChange={(e) =>
                                  changeReviewType(r.rowNo, e.target.value)
                                }
                              >
                                <option value="RECEIPT">Receipt</option>
                                <option value="PAYMENT">Payment</option>
                              </select>
                            </td> */}
                            <td>
                              <textarea
                                className="reviewRemarksInput"
                                rows={2}
                                value={r.remarks || ""}
                                onChange={(e) =>
                                  changeReviewField(
                                    r.rowNo,
                                    "remarks",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <div className="partyReviewBox">
                                {suspense ? (
                                  <AlertTriangle size={14} />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                <input
                                  list="finance-party-options"
                                  value={a.partyLabel || ""}
                                  onChange={(e) =>
                                    changeParty(r.rowNo, e.target.value)
                                  }
                                  onBlur={(e) => {
                                    if (!idByLabel.has(e.target.value))
                                      changeParty(r.rowNo, "Suspense Account");
                                  }}
                                />
                              </div>
                            </td>
                            {/* <td>
                              <div className="matchConfidence">
                                <strong>
                                  {suspense
                                    ? "Review"
                                    : `${r.matchConfidence || 0}%`}
                                </strong>
                                <span>
                                  {String(r.detectionSource || "").replaceAll(
                                    "_",
                                    " ",
                                  )}
                                </span>
                              </div>
                            </td> */}
                            {/* <td>
                              <select
                                className="reviewModeInput"
                                value={r.mode || "BANK"}
                                onChange={(e) =>
                                  changeReviewField(
                                    r.rowNo,
                                    "mode",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="BANK">Bank</option>
                                <option value="CASH">Cash</option>
                              </select>
                            </td> */}
                            <td>
                              <input
                                className="reviewNumberInput"
                                type="number"
                                step="0.01"
                                min="0"
                                value={Number(r.debit || 0) || ""}
                                onChange={(e) =>
                                  changeReviewAmount(
                                    r.rowNo,
                                    "debit",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="reviewNumberInput"
                                type="number"
                                step="0.01"
                                min="0"
                                value={Number(r.credit || 0) || ""}
                                onChange={(e) =>
                                  changeReviewAmount(
                                    r.rowNo,
                                    "credit",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <div className="matchConfidence">
                                <strong>{bankBalance(r.runningBalance)}</strong>
                                <span>AUTO</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="financeSafetyNote">
                  <b>Running Balance is system controlled.</b> It is
                  recalculated from the Bank Account FY opening balance plus all
                  bank transactions. If you edit Date, Debit or Credit, use{" "}
                  <b>Save Review Changes</b> to immediately refresh the
                  calculated balances. Submit also recalculates once more before
                  posting. Rows left on Suspense are posted to Suspense only
                  when no reliable party/account match is available.
                </div>
                <div className="formActions">
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => {
                      setPreview(null);
                      setAssignments({});
                      setDraftRows([]);
                    }}
                  >
                    Back
                  </button>
                  <span className="formActionSpacer" />
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={saveReview}
                  >
                    {busy ? "Saving…" : "Save Review Changes"}
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={submitStatement}
                  >
                    {busy
                      ? "Posting…"
                      : `Submit Statement (${draftRows.length})`}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
