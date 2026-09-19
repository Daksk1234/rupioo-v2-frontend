RUPIO DMS V2 - OLD DMS SALES INVOICE UI + DYNAMIC PAYMENT QR

1. Replace your existing LastestInvoice.js with the supplied LastestInvoice.js.
2. In the WEB frontend project folder run:

   npm install qrcode

3. Restart the frontend:

   npm start
   OR your existing START_FRONTEND.bat

PAYMENT QR SOURCE
- Companydetail.bankDetails
- selected bank = Companydetail.selectedBank, otherwise first bank
- UPI ID = bank.upiId
- GPay/PhonePe = bank.gpay_PhonepayNumber
- Amount = outstanding/pending/due amount when available; otherwise invoice grandTotal
- Note/reference = Invoice <invoice number>
- Currency = INR

QR CONTENT EXAMPLE
upi://pay?pa=<UPI>&pn=<COMPANY>&am=<AMOUNT>&cu=INR&tn=Invoice%20<NO>

No backend change is required for the QR if Companydetail already contains the UPI fields.
