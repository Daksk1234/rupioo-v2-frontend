import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeIndianRupee,
  Banknote,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  Landmark,
  PackageSearch,
  Percent,
  ReceiptIndianRupee,
  RotateCcw,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Target,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import GstReportsPage from "./GstReportsPage.jsx";
import ReportsPage from "./ReportsPage.jsx";

const GST_REPORTS = {
  GSTR1: "GSTR1",
  GSTR2B: "GSTR2B",
  GSTR3B: "GSTR3B",
  HSNWISE: "HSN",
  GSTINPUTOUTPUT: "INPUTOUTPUT",
  TAX: "TAX",
};

const REPORT_GROUPS = [
  {
    key: "GST",
    label: "GST",
    icon: Percent,
    description: "GST return, HSN, tax and input/output reports already made in the GST report module.",
    reports: [
      { key: "GSTR1", label: "GSTR1", status: "WORKING GST MODULE", gstReport: GST_REPORTS.GSTR1, path: "/dms/gstr1" },
      { key: "GSTR2B", label: "GSTR2B", status: "WORKING GST MODULE", gstReport: GST_REPORTS.GSTR2B, path: "/dms/gstr2b" },
      { key: "GSTR3B", label: "GSTR3B", status: "WORKING GST MODULE", gstReport: GST_REPORTS.GSTR3B, path: "/dms/gstr3b" },
      { key: "HSNWISE", label: "HSN WISE", status: "WORKING GST MODULE", gstReport: GST_REPORTS.HSNWISE, path: "/dms/hsn-wise-report" },
      { key: "GSTINPUTOUTPUT", label: "GST INPUT / OUTPUT", status: "WORKING GST MODULE", gstReport: GST_REPORTS.GSTINPUTOUTPUT, path: "/dms/gst-input-output" },
      { key: "TAX", label: "TAX", status: "WORKING GST MODULE", gstReport: GST_REPORTS.TAX, path: "/dms/tax-report" },
    ],
  },
  {
    key: "SALES",
    label: "SALES",
    icon: ShoppingCart,
    description: "Sales performance, customer/product analysis, target and activity reports.",
    reports: [
      { key: "SALES", label: "SALES", icon: ReceiptIndianRupee, path: "/dms/sales-list", status: "PAGE LINKED" },
      { key: "PARTY_PRODUCT", label: "PARTY AND PRODUCT WISE", icon: FileSpreadsheet, path: "/dms/list-of-sales-with-product", status: "PAGE LINKED" },
      { key: "TARGET", label: "TARGET", icon: Target, path: "/dms/targets", status: "PAGE LINKED" },
      { key: "DEAD_PARTY", label: "DEAD PARTY", icon: TrendingDown, status: "PLACEHOLDER" },
      { key: "PROMOTIONAL_ACTIVITY", label: "PROMOTIONAL ACTIVITY", icon: FileBarChart, status: "PLACEHOLDER" },
      { key: "SALES_RETURN", label: "SALES RETURN", icon: RotateCcw, path: "/dms/sales-returns", status: "PAGE LINKED" },
      { key: "CREDIT_NOTE", label: "CREDIT NOTE", icon: ReceiptIndianRupee, path: "/dms/credit-notes", status: "PAGE LINKED" },
      { key: "DISPATCH_DELIVERY", label: "DISPATCH / DELIVERY", icon: ShoppingCart, path: "/dms/dispatch", status: "PAGE LINKED" },
      { key: "CUSTOMER_OUTSTANDING", label: "CUSTOMER OUTSTANDING", icon: BadgeIndianRupee, status: "PLACEHOLDER" },
      { key: "SALES_PERSON_WISE", label: "SALESPERSON WISE", icon: Target, status: "PLACEHOLDER" },
    ],
  },
  {
    key: "PURCHASES",
    label: "PURCHASES",
    icon: ShoppingBasket,
    description: "Purchase invoices, supplier/product analysis and return reports.",
    reports: [
      { key: "PURCHASES", label: "PURCHASES", icon: ReceiptIndianRupee, path: "/dms/purchase-invoices", status: "PAGE LINKED" },
      { key: "PARTY_PRODUCT", label: "PARTY AND PRODUCT WISE", icon: FileSpreadsheet, status: "PLACEHOLDER" },
      { key: "RETURN", label: "RETURN", icon: RotateCcw, path: "/dms/purchase-returns", status: "PAGE LINKED" },
      { key: "PURCHASE_ORDER", label: "PURCHASE ORDER", icon: ClipboardList, path: "/dms/purchase-orders", status: "PAGE LINKED" },
      { key: "GRN", label: "GOODS RECEIPT / GRN", icon: Boxes, path: "/dms/grn", status: "PAGE LINKED" },
      { key: "DEBIT_NOTE", label: "DEBIT NOTE", icon: ReceiptIndianRupee, path: "/dms/debit-notes", status: "PAGE LINKED" },
      { key: "SUPPLIER_OUTSTANDING", label: "SUPPLIER OUTSTANDING", icon: BadgeIndianRupee, status: "PLACEHOLDER" },
    ],
  },
  {
    key: "STOCK",
    label: "STOCK",
    icon: Warehouse,
    description: "Stock movement, ageing, shortages, wastage and valuation reports.",
    reports: [
      { key: "ALL_IN_ONE", label: "ALL IN ONE", icon: FileBarChart, status: "OLD ALL REPORTS", openCatalog: true },
      { key: "OPENING", label: "OPENING", icon: Boxes, status: "PLACEHOLDER" },
      { key: "INWARD", label: "INWARD", icon: ShoppingBasket, status: "PLACEHOLDER" },
      { key: "OUTWARD", label: "OUTWARD", icon: ShoppingCart, status: "PLACEHOLDER" },
      { key: "CLOSING", label: "CLOSING", icon: ClipboardList, path: "/dms/closing-stock", status: "PAGE LINKED" },
      { key: "LOW", label: "LOW", icon: TrendingDown, status: "PLACEHOLDER" },
      { key: "DAMAGED", label: "DAMAGED", icon: PackageSearch, status: "PLACEHOLDER" },
      { key: "OVERDUE", label: "OVERDUE", icon: PackageSearch, status: "PLACEHOLDER" },
      { key: "STOCK_DIFFERENCE", label: "STOCK DIFFERENCE", icon: FileSpreadsheet, status: "PLACEHOLDER" },
      { key: "DEAD_STOCK", label: "DEAD STOCK", icon: TrendingDown, path: "/dms/stock-ageing", status: "PAGE LINKED" },
      { key: "WASTAGE", label: "WASTAGE", icon: RotateCcw, status: "PLACEHOLDER" },
      { key: "WAREHOUSE_WISE", label: "WAREHOUSE WISE", icon: Warehouse, path: "/dms/warehouses", status: "PAGE LINKED" },
      { key: "STOCK_TRANSFER", label: "STOCK TRANSFER", icon: Boxes, path: "/dms/stock-transfer", status: "PAGE LINKED" },
      { key: "CURRENT_STOCK", label: "CURRENT STOCK", icon: Boxes, path: "/dms/stock", status: "PAGE LINKED" },
    ],
  },
  {
    key: "FINANCE",
    label: "FINANCE",
    icon: Landmark,
    description: "Bank, party locking, receipt/payment and ledger-control reports.",
    reports: [
      { key: "BANK_STATEMENT", label: "BANK STATEMENT", icon: Banknote, path: "/dms/banking", status: "PAGE LINKED" },
      { key: "LOCK_PARTY", label: "LOCK PARTY", icon: Landmark, status: "PLACEHOLDER" },
      { key: "RECEIPT_PAYMENT", label: "RECEIPT / PAYMENT", icon: BadgeIndianRupee, path: "/dms/banking", status: "PAGE LINKED" },
      { key: "EXPENSE", label: "EXPENSE", icon: BadgeIndianRupee, path: "/dms/expenses", status: "PAGE LINKED" },
      { key: "CASH_BANK_BOOK", label: "CASH / BANK BOOK", icon: BookOpenCheck, status: "PLACEHOLDER" },
      { key: "PARTY_RECONCILIATION", label: "PARTY RECONCILIATION", icon: FileSpreadsheet, status: "PLACEHOLDER" },
    ],
  },
  {
    key: "BOOK_OF_ACCOUNTS",
    label: "BOOK OF ACCOUNTS",
    icon: BookOpenCheck,
    description: "Opening/closing, final accounts, statutory and bank-CMA reports.",
    reports: [
      { key: "OPENING_CLOSING_CUSTOMER", label: "OPENING & CLOSING REPORT CUSTOMER WISE", icon: FileSpreadsheet, status: "PLACEHOLDER" },
      { key: "PROFIT_LOSS", label: "PROFIT & LOSS", icon: FileBarChart, path: "/dms/pnl", status: "PAGE LINKED" },
      { key: "TRADING", label: "TRADING", icon: FileBarChart, path: "/dms/trading", status: "PAGE LINKED" },
      { key: "BALANCE_SHEET", label: "BALANCE SHEET", icon: FileBarChart, path: "/dms/balance-sheet", status: "PAGE LINKED" },
      { key: "CMA_DATA", label: "CMA DATA", icon: FileBarChart, path: "/dms/cma", status: "PAGE LINKED" },
      { key: "TRIAL_BALANCE", label: "TRIAL BALANCE", icon: FileSpreadsheet, path: "/dms/trial-balance", status: "PAGE LINKED" },
      { key: "LEDGER", label: "LEDGER", icon: BookOpenCheck, path: "/dms/ledger", status: "PAGE LINKED" },
      { key: "DAY_BOOK", label: "DAY BOOK", icon: ClipboardList, status: "PLACEHOLDER" },
      { key: "SUNDRY_DEBTORS_CREDITORS", label: "SUNDRY DEBTORS / CREDITORS", icon: BadgeIndianRupee, status: "PLACEHOLDER" },
    ],
  },
  {
    key: "ALL_EXISTING_REPORTS",
    label: "ALL EXISTING REPORTS",
    icon: FileBarChart,
    description: "The previous All Reports page is kept here so all old report catalogue items remain available.",
    reports: [{ key: "CATALOG", label: "OPEN FULL REPORT CATALOG", icon: FileBarChart, status: "WORKING CATALOG", openCatalog: true }],
  },
];

function NormalizedKey(value = "") {
  return String(value).replace(/[^A-Z0-9]+/gi, "_").toUpperCase();
}

function ReportCard({ report, onOpen }) {
  const Icon = report.icon || FileSpreadsheet;
  const isReady = report.path || report.gstReport || report.openCatalog;
  return (
    <article className="allReportCard">
      <div className="allReportIcon"><Icon size={18} /></div>
      <div className="allReportBody">
        <strong>{report.label}</strong>
        <span>{report.status || (isReady ? "READY" : "PLACEHOLDER")}</span>
        {!isReady && <small>Frontend placeholder added. Backend/report logic can be connected later.</small>}
      </div>
      <div className="allReportActions">
        {report.path && <Link to={report.path}>OPEN PAGE</Link>}
        {(report.gstReport || report.openCatalog) && <button type="button" onClick={() => onOpen(report)}>VIEW HERE</button>}
        {!isReady && <button type="button" disabled>COMING SOON</button>}
      </div>
    </article>
  );
}

export default function AllReportsPage() {
  const [activeGroup, setActiveGroup] = useState(REPORT_GROUPS[0].key);
  const [activeSubtab, setActiveSubtab] = useState(REPORT_GROUPS[0].reports[0].key);
  const [query, setQuery] = useState("");

  const active = REPORT_GROUPS.find((group) => group.key === activeGroup) || REPORT_GROUPS[0];
  const ActiveIcon = active.icon || FileBarChart;
  const activeReport = active.reports.find((report) => report.key === activeSubtab) || active.reports[0];

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return active.reports;
    return active.reports.filter((report) => `${report.label} ${report.status || ""}`.toLowerCase().includes(term));
  }, [active.reports, query]);

  const openReport = (report) => {
    setActiveSubtab(report.key);
  };

  const switchGroup = (key) => {
    const next = REPORT_GROUPS.find((group) => group.key === key) || REPORT_GROUPS[0];
    setActiveGroup(key);
    setActiveSubtab(next.reports[0]?.key || "");
    setQuery("");
  };

  return (
    <>
      <style>{`
        .allReportsShell{display:flex;flex-direction:column;gap:14px}.allReportsTopTabs{display:flex;gap:8px;overflow:auto;padding:5px 0 9px}.allReportsTopTabs button{border:1px solid var(--line,#e5e7ef);background:#fff;color:#2e3149;border-radius:14px;padding:10px 13px;font-size:10px;font-weight:900;display:flex;align-items:center;gap:7px;white-space:nowrap}.allReportsTopTabs button.active{background:#6264ed;color:#fff;border-color:#6264ed;box-shadow:0 10px 24px rgba(98,100,237,.18)}.allReportsToolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.allReportsToolbar .reportSearch{margin:0;max-width:430px;flex:1}.allReportsSubtabs{display:flex;gap:7px;flex-wrap:wrap}.allReportsSubtabs button{border:1px solid var(--line,#e5e7ef);background:#f8f9fc;border-radius:999px;padding:8px 11px;font-size:9px;font-weight:900;color:#4b4f65}.allReportsSubtabs button.active{background:#111827;color:#fff;border-color:#111827}.allReportsIntro{background:#fff;border:1px solid var(--line,#e5e7ef);border-radius:18px;padding:16px;display:flex;gap:12px;align-items:flex-start}.allReportsIntro svg{background:#f0f1ff;color:#6264ed;border-radius:13px;padding:9px;width:42px;height:42px;flex:0 0 auto}.allReportsIntro h3{margin:0 0 4px;font-size:16px}.allReportsIntro p{margin:0;color:var(--muted,#74788b);font-size:10px;line-height:1.5}.allReportsGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.allReportCard{background:#fff;border:1px solid var(--line,#e5e7ef);border-radius:16px;padding:13px;display:grid;grid-template-columns:34px 1fr;gap:10px;min-height:118px}.allReportIcon{width:34px;height:34px;border-radius:12px;background:#f4f5ff;color:#6264ed;display:grid;place-items:center}.allReportBody{display:flex;flex-direction:column;gap:4px}.allReportBody strong{font-size:11px}.allReportBody span{font-size:8px;color:#6264ed;font-weight:900}.allReportBody small{font-size:8px;color:var(--muted,#74788b);line-height:1.45}.allReportActions{grid-column:1/-1;display:flex;gap:7px;justify-content:flex-end;align-items:center;margin-top:4px}.allReportActions a,.allReportActions button{border:1px solid var(--line,#e5e7ef);background:#f8f9fc;color:#25283f;text-decoration:none;border-radius:9px;padding:8px 10px;font-size:8px;font-weight:900}.allReportActions button:not(:disabled){background:#111827;color:#fff;border-color:#111827}.allReportActions button:disabled{opacity:.55;cursor:not-allowed}.embeddedReportPanel{border:1px solid var(--line,#e5e7ef);background:#fff;border-radius:18px;padding:14px;margin-top:12px}.embeddedReportPanel>.pageHeader{margin-bottom:12px}.allReportsNote{font-size:9px;color:var(--muted,#74788b);line-height:1.5;margin:4px 0 0}@media(max-width:1050px){.allReportsGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.allReportsGrid{grid-template-columns:1fr}.allReportsToolbar{align-items:stretch}.allReportsToolbar .reportSearch{max-width:none}.allReportsIntro{flex-direction:column}}
      `}</style>

      <PageHeader
        title="All Reports"
        description="Single tabbed report centre for GST, Sales, Purchases, Stock, Finance and Book of Accounts. Existing GST reports and the old All Reports catalogue are preserved here."
        actions={false}
      />

      <div className="allReportsShell">
        <div className="allReportsTopTabs" role="tablist" aria-label="Report categories">
          {REPORT_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <button
                key={group.key}
                type="button"
                className={activeGroup === group.key ? "active" : ""}
                onClick={() => switchGroup(group.key)}
              >
                <Icon size={15} /> {group.label}
              </button>
            );
          })}
        </div>

        <section className="allReportsIntro">
          <ActiveIcon />
          <div>
            <h3>{active.label}</h3>
            <p>{active.description}</p>
            <p className="allReportsNote">Tabs are added in frontend now. Linked pages open existing modules; placeholder reports can be connected to backend later without changing this layout.</p>
          </div>
        </section>

        <div className="allReportsToolbar">
          <div className="reportSearch">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${active.label.toLowerCase()} reports...`} />
          </div>
          <div className="allReportsSubtabs" role="tablist" aria-label={`${active.label} reports`}>
            {active.reports.map((report) => (
              <button
                key={report.key}
                type="button"
                className={activeSubtab === report.key ? "active" : ""}
                onClick={() => setActiveSubtab(report.key)}
              >
                {report.label}
              </button>
            ))}
          </div>
        </div>

        <div className="allReportsGrid">
          {filteredReports.map((report) => (
            <ReportCard key={`${active.key}-${report.key}`} report={report} onOpen={openReport} />
          ))}
        </div>

        {activeReport?.gstReport && (
          <section className="embeddedReportPanel" key={`gst-${activeReport.gstReport}-${NormalizedKey(activeReport.label)}`}>
            <GstReportsPage initialReport={activeReport.gstReport} />
          </section>
        )}

        {activeReport?.openCatalog && (
          <section className="embeddedReportPanel" key={`catalog-${active.key}-${activeReport.key}`}>
            <ReportsPage />
          </section>
        )}
      </div>
    </>
  );
}
