const f=(key,label,type="text",options=[])=>({key,label,type,options});
const status=["DRAFT","PENDING","APPROVED","ACTIVE","POSTED","COMPLETED","ON_HOLD","CANCELLED","INACTIVE"];

const common=[f("title","Name / Title"),f("reference","Reference"),f("status","Status","select",status),f("notes","Notes","textarea")];
const document=[f("title","Party / Description"),f("reference","Document No."),f("date","Date","date"),f("amount","Amount","number"),f("status","Status","select",status),f("notes","Remarks","textarea")];
const stock=[f("title","Product / Item"),f("reference","Reference"),f("quantity","Quantity","number"),f("warehouse","Warehouse"),f("status","Status","select",status),f("notes","Remarks","textarea")];
const money=[f("title","Party / Account"),f("reference","Voucher No."),f("date","Date","date"),f("amount","Amount","number"),f("mode","Mode","select",["CASH","BANK","UPI","CHEQUE","CARD","OTHER"]),f("status","Status","select",status),f("notes","Narration","textarea")];
const report=[f("title","Report Run"),f("reference","Period / Reference"),f("date","As On","date"),f("status","Status","select",["READY","REVIEW","FINAL"]),f("notes","Notes","textarea")];

export const resourceSchemas={
  "/master/pincodes":[f("title","Area / Post Office"),f("reference","Pincode"),f("city","City"),f("district","District"),f("state","State"),f("country","Country"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/master/hsn":[f("reference","HSN No"),f("title","Product Description"),f("gstRate","GST %","number"),f("cessRate","Cess","number")],
  "/master/units":[f("title","Unit Name"),f("reference","Unit Code"),f("uqc","UQC"),f("decimals","Decimals","number"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/master/accounts":[f("title","Account / Group Name"),f("reference","System Code"),f("nature","Nature","select",["ASSET","LIABILITY","INCOME","EXPENSE","EQUITY"]),f("parentCode","Parent Code"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/master/barcodes":[f("title","Product / Trade Item"),f("reference","GTIN / Barcode"),f("brand","Brand"),f("sku","SKU"),f("type","Type","select",["EAN13","GTIN14","CODE128","QR","INTERNAL"]),f("status","Status","select",["AVAILABLE","RESERVED","ALLOCATED","ACTIVE","DISCONTINUED","BLOCKED"])],
  "/master/customers":[f("title","Legal / Customer Name"),f("reference","GSTIN / PAN / Aadhaar"),f("mobile","Mobile"),f("email","Email"),f("status","Status","select",["VERIFIED","PENDING","ACTIVE","INACTIVE"]),f("notes","Notes","textarea")],
  "/master/transporters":[f("title","Transporter Name"),f("reference","GSTIN / PAN"),f("station","Station"),f("contact","Contact"),f("mobile","Mobile"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/master/permissions":[f("title","Permission / Rule"),f("reference","Permission Code"),f("module","Module"),f("action","Action"),f("locked","Locked","select",["YES","NO"]),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/master/gst-api":[f("title","GST API Configuration / Check"),f("reference","Provider / GSTIN"),f("environment","Environment","select",["SANDBOX","PRODUCTION"]),f("status","Status","select",["ACTIVE","INACTIVE","ERROR"]),f("notes","Notes","textarea")],
  "/master/storage":[f("title","Storage Location"),f("reference","Storage Key"),f("type","Type","select",["NAS","CLOUD","LOCAL","BACKUP"]),f("capacityGb","Capacity GB","number"),f("status","Status","select",["ACTIVE","WARNING","OFFLINE"]),f("notes","Notes","textarea")],
  "/master/audit":report,

  "/dms/transporters":[f("title","Transporter Name"),f("reference","GSTIN / Code"),f("station","Booking / Delivery Station"),f("contact","Contact Person"),f("mobile","Mobile"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/dms/territories":[f("title","Territory Name"),f("reference","Territory Code"),f("pincodes","Pincodes"),f("assignedTo","Primary Salesperson"),f("manager","Manager"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/dms/visits":[f("title","Customer / Lead"),f("reference","Visit ID"),f("date","Visit Date","datetime-local"),f("purpose","Purpose","select",["ORDER","COLLECTION","LEAD","FOLLOW_UP","KYC","SERVICE","OTHER"]),f("duration","Duration Minutes","number"),f("gpsVerified","GPS Verified","select",["YES","NO"]),f("otpVerified","OTP Verified","select",["YES","NO","NOT_REQUIRED"]),f("status","Status","select",["PLANNED","CHECKED_IN","COMPLETED","CANCELLED"]),f("notes","Outcome / Next Action","textarea")],
  "/dms/quotation":document,
  "/dms/sales-orders":document,
  "/dms/dispatch":[f("title","Order / Customer"),f("reference","Dispatch No."),f("date","Dispatch Date","datetime-local"),f("quantity","Packages / Qty","number"),f("transporter","Transporter"),f("status","Status","select",["PICKING","PACKED","HANDED_OVER","IN_TRANSIT","DELIVERED","CANCELLED"]),f("notes","Remarks","textarea")],
  "/dms/sales-returns":document,
  "/dms/credit-notes":document,
  "/dms/purchase-request":document,
  "/dms/rfq":document,
  "/dms/purchase-orders":document,
  "/dms/grn":[f("title","Supplier / PO"),f("reference","GRN No."),f("date","Receipt Date","date"),f("quantity","Received Quantity","number"),f("status","Status","select",["DRAFT","RECEIVED","QC_PENDING","ACCEPTED","REJECTED"]),f("notes","Remarks","textarea")],
  "/dms/purchase-invoices":document,
  "/dms/purchase-returns":document,
  "/dms/stock":stock,
  "/dms/warehouses":[f("title","Warehouse Name"),f("reference","Warehouse Code"),f("address","Address"),f("pincode","Pincode"),f("manager","Manager"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/dms/stock-transfer":[f("title","Product / Transfer"),f("reference","Transfer No."),f("date","Date","date"),f("quantity","Quantity","number"),f("from","From Warehouse"),f("to","To Warehouse"),f("status","Status","select",["DRAFT","DISPATCHED","RECEIVED","CANCELLED"]),f("notes","Remarks","textarea")],
  "/dms/closing-stock":stock,
  "/dms/stock-ageing":report,
  "/dms/receipts":money,
  "/dms/payments":money,
  "/dms/banking":money,
  "/dms/expenses":[...money.slice(0,4),f("category","Expense Category"),f("allocation","Allocation","select",["DIRECT","TURNOVER","QUANTITY","GROSS_PROFIT","EMPLOYEE_COUNT","MANUAL","NONE"]),...money.slice(4)],
  "/dms/ledger":report,
  "/dms/trial-balance":report,
  "/dms/trading":report,
  "/dms/pnl":report,
  "/dms/balance-sheet":report,
  "/dms/cma":report,
  "/dms/gst-dashboard":report,
  "/dms/gst-reports":report,
  "/dms/gstr1":report,
  "/dms/gstr2b":report,
  "/dms/gstr3b":report,
  "/dms/hsn-wise-report":report,
  "/dms/gst-input-output":report,
  "/dms/tax-report":report,
  "/dms/gstr9":report,
  "/dms/family":[f("title","Family Member / Account"),f("reference","Account / Ref"),f("type","Type","select",["BANK","CASH","CREDIT_CARD","INVESTMENT","LOAN","ASSET","INCOME","EXPENSE"]),f("date","Date","date"),f("amount","Amount","number"),f("status","Status","select",["ACTIVE","CLOSED"]),f("notes","Remarks","textarea")],
  "/dms/settings":common,

  "/hr/attendance":[f("title","Employee"),f("reference","Attendance Ref"),f("date","Date","date"),f("checkIn","Check In","time"),f("checkOut","Check Out","time"),f("status","Status","select",["PRESENT","ABSENT","HALF_DAY","LEAVE","WEEK_OFF","HOLIDAY"]),f("gpsVerified","GPS Verified","select",["YES","NO"]),f("notes","Remarks","textarea")],
  "/hr/shifts":[f("title","Shift Name"),f("reference","Shift Code"),f("startTime","Start Time","time"),f("endTime","End Time","time"),f("lateAfter","Late After Minutes","number"),f("halfDayAfter","Half Day After Minutes","number"),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/hr/leave":[f("title","Employee / Leave"),f("reference","Leave Ref"),f("date","From Date","date"),f("toDate","To Date","date"),f("leaveType","Leave Type","select",["CASUAL","SICK","EARNED","UNPAID","OTHER"]),f("quantity","Days","number"),f("status","Status","select",["REQUESTED","APPROVED","REJECTED","CANCELLED"]),f("notes","Reason","textarea")],
  "/hr/holidays":[f("title","Holiday Name"),f("date","Date","date"),f("type","Type","select",["NATIONAL","REGIONAL","COMPANY","OPTIONAL"]),f("status","Status","select",["ACTIVE","INACTIVE"])],
  "/hr/payroll":[f("title","Employee / Payroll"),f("reference","Payroll Ref"),f("month","Month","month"),f("amount","Gross / Net Amount","number"),f("deduction","Deduction","number"),f("status","Status","select",["DRAFT","CALCULATED","APPROVED","PAID"]),f("notes","Remarks","textarea")],
  "/hr/loans":[f("title","Employee"),f("reference","Loan / Advance Ref"),f("date","Date","date"),f("amount","Principal Amount","number"),f("emi","EMI","number"),f("interest","Interest %","number"),f("status","Status","select",["REQUESTED","APPROVED","ACTIVE","CLOSED","REJECTED"]),f("notes","Remarks","textarea")],
  "/hr/expenses":[f("title","Employee / Expense"),f("reference","Claim Ref"),f("date","Date","date"),f("amount","Claim Amount","number"),f("category","Category","select",["TRAVEL","FOOD","FUEL","HOTEL","CONVEYANCE","OTHER"]),f("status","Status","select",["REQUESTED","APPROVED","REJECTED","REIMBURSED"]),f("notes","Remarks","textarea")],
  "/hr/ledger":report,
  "/hr/performance":[f("title","Employee"),f("reference","Review Period"),f("salesScore","Sales Score","number"),f("attendanceScore","Attendance Score","number"),f("behaviourScore","Manager Rating","number"),f("overall","Overall Score","number"),f("status","Status","select",["DRAFT","REVIEWED","FINAL"]),f("notes","Remarks","textarea")],
  "/hr/documents":[f("title","Employee / Document"),f("reference","Document Ref"),f("type","Document Type"),f("expiryDate","Expiry Date","date"),f("status","Status","select",["PENDING","VERIFIED","REJECTED","EXPIRED"]),f("notes","Remarks","textarea")],

  "/production/planning":[f("title","Product / Plan"),f("reference","Plan No."),f("date","Plan Date","date"),f("quantity","Planned Qty","number"),f("machine","Machine"),f("shift","Shift"),f("status","Status","select",["DRAFT","APPROVED","ACTIVE","COMPLETED"]),f("notes","Remarks","textarea")],
  "/production/bom":[f("title","Finished Product"),f("reference","BOM Code"),f("version","Version"),f("components","Components / Formula","textarea"),f("status","Status","select",["DRAFT","ACTIVE","INACTIVE"])],
  "/production/work-orders":[f("title","Product"),f("reference","Work Order"),f("date","Scheduled Date","date"),f("quantity","Order Qty","number"),f("machine","Machine"),f("shift","Shift"),f("status","Status","select",["DRAFT","RELEASED","IN_PROGRESS","PAUSED","COMPLETED","CANCELLED"]),f("notes","Remarks","textarea")],
  "/production/raw-material":stock,
  "/production/wip":stock,
  "/production/execution":[f("title","Work Order / Product"),f("reference","Batch / Production Ref"),f("date","Date","datetime-local"),f("quantity","Produced Qty","number"),f("rejectedQty","Rejected Qty","number"),f("machine","Machine"),f("operator","Operator"),f("status","Status","select",["STARTED","PAUSED","COMPLETED"]),f("notes","Remarks","textarea")],
  "/production/finished-goods":stock,
  "/production/scrap":[f("title","Scrap / Material"),f("reference","Scrap Ref"),f("date","Date","date"),f("quantity","Qty","number"),f("type","Type","select",["REUSABLE","SALEABLE","REJECTED","DISPOSAL"]),f("status","Status","select",["OPEN","REUSED","SOLD","DISPOSED"]),f("notes","Remarks","textarea")],
  "/production/quality":[f("title","Product / Batch"),f("reference","QC Ref"),f("date","QC Date","date"),f("stage","Stage","select",["INCOMING","IN_PROCESS","FINISHED_GOODS"]),f("quantity","Checked Qty","number"),f("rejectedQty","Rejected Qty","number"),f("status","Status","select",["PENDING","PASSED","FAILED","HOLD","RELEASED"]),f("notes","Observations","textarea")],
  "/production/machines":[f("title","Machine Name"),f("reference","Machine Code"),f("capacity","Capacity"),f("location","Location"),f("status","Status","select",["RUNNING","IDLE","MAINTENANCE","BREAKDOWN","INACTIVE"]),f("notes","Remarks","textarea")],
  "/production/maintenance":[f("title","Machine"),f("reference","Maintenance Ref"),f("date","Scheduled / Breakdown Date","datetime-local"),f("type","Type","select",["PREVENTIVE","BREAKDOWN","INSPECTION"]),f("duration","Downtime Hours","number"),f("status","Status","select",["PLANNED","IN_PROGRESS","COMPLETED","CANCELLED"]),f("notes","Work Done / Parts","textarea")]
};

export const reportLikePaths=new Set([
  "/master/audit","/dms/health","/dms/stock-ageing","/dms/ledger","/dms/trial-balance","/dms/trading","/dms/pnl","/dms/balance-sheet","/dms/cma","/dms/gst-dashboard","/dms/gstr1","/dms/gstr2b","/dms/gstr3b","/dms/gstr9","/hr/ledger"
]);

export function fieldsFor(page){return resourceSchemas[page.path]||common;}
export function resourceName(page){return page.path.split("/").filter(Boolean).slice(1).join("-");}
