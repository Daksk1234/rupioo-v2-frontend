# Old DMS GST/GSTR Report Suite → V2

Date: 2026-09-14

## Source of truth
This port was based on the old DMS GST report hub and its report components, not recreated from memory:
- GSTReportFlow.js
- GSTR1.js
- GSTR2B.js
- GSTR3B.js
- HSNReport.js
- GSTInputOutputReports.js
- TaxReport.js

## Six old-DMS reports restored
1. GSTR 1
2. GSTR 2B
3. GSTR 3B
4. HSN Wise
5. GST Input / Output
6. Tax Report

## GSTR 1 parity
- B2 tab contains B2B, B2CL and B2CS.
- Old-DMS threshold retained: unregistered invoice value > 50,000 = B2CL; <= 50,000 = B2CS.
- CDNR and CDNUR tabs retained.
- Columns retained: invoice/date/party/GSTIN/place of supply/rate/taxable/CGST/SGST/IGST/round off/grand total.
- Sales Invoice status POSTED in V2 is treated as the old DMS Completed status.

## GSTR 2B parity
- Uses posted Purchase Invoices.
- Supplier must have GSTIN and Registration Type REGULAR, matching old-DMS filtering.
- Supplier GSTIN/name, invoice/date/value, taxable, POS, reverse charge, GST rate, IGST/CGST/SGST, ITC and ineligibility columns retained.

## GSTR 3B parity
- Old Nature of Supplies table retained.
- Old Eligible ITC table retained.
- Important: the old DMS Eligible ITC table was zero-filled. V2 intentionally preserves this legacy behavior instead of inventing statutory ITC eligibility rules. Actual GST portal/2B reconciliation can later feed this table explicitly.

## HSN Wise parity
- Regular and UnRegister buckets retained.
- HSN, description, UQC, quantity, total value, rate, taxable, SGST, CGST, IGST, cess retained.
- HSN vs Sales reconciliation retained.
- V2 adaptation: historical GST rate comes from the immutable invoice item `gstRateSnapshot`; the old DMS had special historical HSN-rate recalculation logic. Snapshot use is safer in V2 because later HSN-master edits must not rewrite historical invoice tax.

## GST Input / Output parity
- Modes: All, GST Input, GST Output.
- Purchase invoices feed input GST; sales invoices feed output GST.
- Available GST = Total Input - Total Output.

## Tax Report parity
- Total Tax Input
- Total Tax Output
- Balance Tax

## Exports
- Excel is generated server-side as XLSX.
- CSV is available per visible section.
- Print / PDF uses the browser print pipeline.

## Routes
- /dms/gst-reports
- /dms/gstr1
- /dms/gstr2b
- /dms/gstr3b
- /dms/hsn-wise-report
- /dms/gst-input-output
- /dms/tax-report

## Backend API
- GET /api/reports/gst/:kind
- GET /api/reports/gst-export/:kind.xlsx

## Permissions
No new permission catalogue keys were invented. Existing keys are reused:
- dms.all_gstr.gstr_1
- dms.all_gstr.gstr_2b
- dms.all_gstr.gstr_3b
- dms.all_gstr.hsn_wise_report
- dms.finance_reports.tax_report
