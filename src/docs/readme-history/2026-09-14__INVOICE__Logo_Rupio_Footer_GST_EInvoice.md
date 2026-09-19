# Master Invoice — Logo, Rupio Footer & GST e-Invoice

## Standard
The V2 Master Invoice Template now includes:

- Company Logo uploaded from **Superadmin Profile → Edit Profile → Company Logo**.
- Authorized Signature uploaded from the same profile.
- Fixed footer on every PDF page: **THIS INVOICE IS GENERATED IN RUPIO | rupiooin@gmail.com**.
- Separate GST e-Invoice block with **Status, IRN, Ack No., Ack Date and IRP Signed QR**.
- Payment UPI QR remains separate from the GST e-Invoice QR.

## GST e-Invoice data
Sales invoices store an `eInvoice` object with:

```json
{
  "status": "NOT_GENERATED | PENDING | GENERATED | CANCELLED",
  "irn": "",
  "ackNo": "",
  "ackDate": "",
  "signedQrPayload": ""
}
```

These fields can be entered manually now. A later GST/IRP API integration can populate the same fields automatically without redesigning the invoice PDF.

## Important
The GST e-Invoice QR is **not** the payment QR. The GST QR is generated from the IRP signed QR payload. The payment QR remains based on the company Primary Bank UPI ID and invoice amount.
