# User Master — Roleless Ledger Accounts

Date: 2026-09-15

## Requirement
Some accounting records created from User Master are not actual application users/employees and must not require a Role, Department or hierarchy. Examples include partner/capital accounts and expense ledgers such as Travelling Expense or Fuel.

## New behavior
- Account Type is evaluated before Role.
- Standalone ledger/account heads automatically enter **Ledger Account mode**.
- Ledger Account mode hides Personal KYC, Bank, Assignment, Official employee fields, Last Working Details, References, Branch and System Login.
- Visible fields are reduced to Account/Ledger Name, Account Type, Opening Financial Year, Opening Balance, DR/CR, Ledger Name and Status.
- Backend stores these records with `role: LEDGER_ACCOUNT`, no roleId/departmentId/assignedToUserId, no app permissions and System Login disabled.
- Company Ledger accounting mapping and opening balance continue to be created through the existing User accounting sync.
- Staff-related account heads (`SYS_STAFF_ADVANCE`, `SYS_SALARY_PAYABLE`, `SYS_REIMBURSEMENT_PAYABLE`) retain the normal user Role/hierarchy workflow.
- Existing ledger records can be edited without Role validation, and can be activated without a Role.

## Files
- `frontend/src/pages/UsersAccessPage.jsx`
- `backend/src/routes/access.js`
