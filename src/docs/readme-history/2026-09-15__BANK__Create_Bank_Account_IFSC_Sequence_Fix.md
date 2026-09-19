# Create Bank Account IFSC Sequence Fix — 2026-09-15

## Problem
Create Bank Account attempted IFSC lookup immediately when the 11th character was typed. This made the account-creation sequence fragile and left the page dependent on one lookup route.

## New sequence
1. Account Holder Name
2. Account Number
3. Account Type
4. IFSC
5. Fetch Bank Details
6. Additional Bank Details
7. Financial Year Opening Balances

## IFSC lookup fallback order
1. `/api/banks/ifsc-lookup/:ifsc`
2. `/api/reference/ifsc/:ifsc`
3. `/api/reference/ifsc?q=:ifsc` exact-match fallback

No database or transporter logic is changed by this patch.
