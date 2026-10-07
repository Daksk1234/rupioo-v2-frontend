import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import GstReportsPage from "./GstReportsPage.jsx";
import SalesReportsPage from "./SalesReportsPage.jsx";
import PurchaseReportsPage from "./PurchaseReportsPage.jsx";
import StockReportsPage from "./StockReportsPage.jsx";
import FinanceReportsPage from "./FinanceReportsPage.jsx";

const GROUPS = [
  {
    key: "GST",
    label: "GST",
    reports: [
      { label: "GSTR1", gstReport: "GSTR1" },
      { label: "GSTR2B", gstReport: "GSTR2B" },
      { label: "GSTR3B", gstReport: "GSTR3B" },
      { label: "HSN WISE", gstReport: "HSN" },
      { label: "GST INPUT / OUTPUT", gstReport: "INPUTOUTPUT" },
      { label: "TAX", gstReport: "TAX" },
      { label: "GSTR-9", gstReport: "GSTR9" },
      { label: "GSTR-9C", gstReport: "GSTR9C" },
      { label: "GST COMPLIANCE HEALTH" },
    ],
  },
  {
    key: "SALES",
    label: "SALES",
    reports: [
      { label: "SALES SUMMARY", salesReport: "SUMMARY" },
      { label: "PARTY AND PRODUCT WISE", salesReport: "PARTY_PRODUCT" },
      { label: "LOCK PARTY", salesReport: "LOCK_PARTY" },
      { label: "DEAD PARTY", salesReport: "DEAD_PARTY" },
      { label: "TARGET" },
      { label: "COLLECTION ACHIEVEMENT" },
      { label: "PROMOTIONAL ACTIVITY" },
    ],
  },
  {
    key: "PURCHASES",
    label: "PURCHASES",
    reports: [
      { label: "PURCHASE SUMMARY", purchaseReport: "SUMMARY" },
      { label: "PARTY AND PRODUCT WISE", purchaseReport: "PARTY_PRODUCT" },
      { label: "SUPPLIER PERFORMANCE" },
      { label: "LANDED COST ANALYSIS" },
    ],
  },
  {
    key: "STOCK",
    label: "STOCK",
    reports: [
      { label: "ALL IN ONE", stockReport: "ALL_IN_ONE" },
      { label: "OPENING", stockReport: "OPENING" },
      { label: "INWARD", stockReport: "INWARD" },
      { label: "OUTWARD", stockReport: "OUTWARD" },
      { label: "CLOSING", stockReport: "CLOSING" },
      { label: "STOCK MOVEMENT" },
      { label: "STOCK AGEING" },
      { label: "LOW STOCK", stockReport: "LOW_STOCK" },
      { label: "DAMAGED" },
      { label: "OVERDUE", stockReport: "OVERDUE" },
      { label: "STOCK DIFFERENCE" },
      { label: "DEAD STOCK", stockReport: "DEAD_STOCK" },
      { label: "WASTAGE" },
    ],
  },
  {
    key: "FINANCE",
    label: "FINANCE",
    reports: [
      { label: "BANK STATEMENT" },
      { label: "CUSTOMER CREDIT EXPOSURE", financeReport: "CREDIT_EXPOSURE" },
      { label: "RECEIPT & BOUNCE", financeReport: "RECEIPT_BOUNCE" },
      { label: "CASH FLOW", financeReport: "CASH_FLOW" },
      { label: "FUND FLOW", financeReport: "FUND_FLOW" },
      { label: "WORKING CAPITAL", financeReport: "WORKING_CAPITAL" },
      { label: "RATIO ANALYSIS", financeReport: "RATIO_ANALYSIS" },
    ],
  },
  {
    key: "BOOKS",
    label: "BOOK OF ACCOUNTS",
    reports: [
      { label: "OPENING & CLOSING REPORT CUSTOMER WISE" },
      { label: "TRIAL BALANCE" },
      { label: "TRADING" },
      { label: "PROFIT & LOSS" },
      { label: "BALANCE SHEET" },
      { label: "PROVISIONAL BALANCE SHEET" },
      { label: "BREAK-EVEN" },
      { label: "CMA OPERATING STATEMENT" },
      { label: "CMA BALANCE SHEET ANALYSIS" },
      { label: "CMA DATA" },
    ],
  },
  {
    key: "CUSTOMER",
    label: "CUSTOMER",
    reports: [
      { label: "CUSTOMER HEALTH" },
      { label: "CUSTOMER CREDIT EXPOSURE" },
      { label: "CUSTOMER RATING TREND" },
    ],
  },
  {
    key: "MANAGEMENT",
    label: "MANAGEMENT",
    reports: [
      { label: "EXECUTIVE COMPANY HEALTH" },
      { label: "PRODUCT PROFITABILITY" },
      { label: "MARGIN COLOUR MIX" },
      { label: "LEAD FUNNEL" },
      { label: "VISIT ACHIEVEMENT" },
      { label: "TRANSPORTER NETWORK" },
      { label: "AUDIT TRAIL" },
    ],
  },
];

export default function ReportCenterPage() {
  const location = useLocation();
  const requestedGroup = useMemo(() => {
    const key = String(new URLSearchParams(location.search).get("group") || "GST").toUpperCase();
    return GROUPS.some((item) => item.key === key) ? key : "GST";
  }, [location.search]);

  const initialGroup = GROUPS.find((item) => item.key === requestedGroup) || GROUPS[0];
  const [activeGroup, setActiveGroup] = useState(initialGroup.key);
  const [activeReport, setActiveReport] = useState(initialGroup.reports[0] || null);
  const [monthlyExpandable, setMonthlyExpandable] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("rupioo.reportMonthlyExpandable") !== "false";
  });

  const group = useMemo(
    () => GROUPS.find((item) => item.key === activeGroup) || GROUPS[0],
    [activeGroup],
  );

  useEffect(() => {
    const next = GROUPS.find((item) => item.key === requestedGroup) || GROUPS[0];
    setActiveGroup(next.key);
    setActiveReport(next.reports[0] || null);
  }, [requestedGroup]);

  useEffect(() => {
    const onMonthlyExpandableChange = (event) => {
      if (typeof event?.detail?.checked === "boolean") {
        setMonthlyExpandable(event.detail.checked);
      }
    };
    window.addEventListener("rupioo:report-monthly-expandable-change", onMonthlyExpandableChange);
    return () => window.removeEventListener("rupioo:report-monthly-expandable-change", onMonthlyExpandableChange);
  }, []);

  const openReport = (report) => setActiveReport(report);

  return (
    <>
      <style>{`
        .simpleReports{display:flex;flex-direction:column;gap:12px}
        .simpleReportSubtabs{display:flex;gap:7px;flex-wrap:wrap;padding:11px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px}
        .simpleReportSubtabs button{border:1px solid var(--border,#dfe4ea);background:var(--surface,#fff);color:inherit;border-radius:7px;padding:7px 11px;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer}
        .simpleReportSubtabs button.active{background:var(--primary,#1d4ed8);border-color:var(--primary,#1d4ed8);color:#fff}
        .simpleReportBody{min-height:220px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:12px}
        .simpleReportPlaceholder{min-height:220px;display:flex;align-items:center;justify-content:center;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:20px;text-align:center}
        .simpleReportPlaceholder strong{font-size:1.05rem}
        @media(max-width:700px){.simpleReportSubtabs{flex-wrap:nowrap;overflow-x:auto}.simpleReportSubtabs button{flex:0 0 auto;white-space:nowrap}.simpleReportBody,.simpleReportPlaceholder{min-height:180px}}
      `}</style>

      <div className="simpleReports">
        <PageHeader title="REPORTS" actions={false} />

        <div className="simpleReportSubtabs">
          {group.reports.map((report) => (
            <button
              key={report.label}
              type="button"
              className={report.label === activeReport?.label ? "active" : ""}
              onClick={() => openReport(report)}
            >
              {report.label}
            </button>
          ))}
        </div>

        <div className="simpleReportBody">
          {activeGroup === "GST" && activeReport?.gstReport ? (
            <GstReportsPage
              key={activeReport.gstReport}
              initialReport={activeReport.gstReport}
              hideReportTabs
            />
          ) : activeGroup === "SALES" && activeReport?.salesReport ? (
            <SalesReportsPage key={activeReport.salesReport} reportType={activeReport.salesReport} monthlyExpandable={monthlyExpandable} />
          ) : activeGroup === "PURCHASES" && activeReport?.purchaseReport ? (
            <PurchaseReportsPage key={activeReport.purchaseReport} reportType={activeReport.purchaseReport} monthlyExpandable={monthlyExpandable} />
          ) : activeGroup === "STOCK" && activeReport?.stockReport ? (
            <StockReportsPage key={activeReport.stockReport} reportType={activeReport.stockReport} />
          ) : activeGroup === "FINANCE" && activeReport?.financeReport ? (
            <FinanceReportsPage key={activeReport.financeReport} reportType={activeReport.financeReport} />
          ) : (
            <div className="simpleReportPlaceholder">
              <strong>{activeReport?.label || "SELECT A REPORT"}</strong>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
