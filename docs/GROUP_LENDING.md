# Group lending and the solidarity mechanism

Migration: `database/migrations/0028_group_lending.sql` (rollback in `rollback/0028_group_lending.down.sql`).
Rules shared by server and screens: `shared/lending/groups.ts`. Server: `src/groups/service.ts`, `src/groups/rules.ts`.

## The approach: one loan per member under the group

Each member applies for a **group product** (a loan product whose lending type is `GROUP`) in their own name.
The loan records the group it was taken under (`loans.group_id`). The group itself never borrows.

Why this approach rather than one loan to the group:

- Each member's schedule, payments, penalties, receipts and arrears stay on their own loan, using the same
  repayment engine (waterfall, penalties, reversals) as individual loans. Nothing is apportioned after the fact.
- Joint liability is expressed explicitly, through consent and the solidarity fund (below), instead of through a
  shared balance that hides who is behind.
- A member who leaves the group keeps a clear loan history.

Consequences, applied everywhere:

- A group product can only be applied for by an active member of an **active** group in the member's branch.
- **Approval needs consent**: every other active member must have consented, and none may have declined. Consent
  is the guarantor record. Officers record it at a meeting, or members give it in the portal. A member may change
  their answer until the loan is decided.
- Approval and release re-check that the group is active, the borrower is still a member, and the group is not
  blocked.

## Groups

- **Statuses:** `FORMING` → `ACTIVE` ⇄ `SUSPENDED`. Any status except `DISSOLVED` can go → `DISSOLVED`. The server
  enforces this (`groupTransition`). An illegal move returns 409 `BAD_TRANSITION`.
- **Activation** (and reinstatement) needs at least 3 active members, all KYC-verified, with a leader, a secretary
  and a treasurer.
- **Suspend, reinstate and dissolve** are manager actions (`approve_sensitive_operations`), each with a reason.
- **Dissolving** needs no open group loan, no unpaid cover and an empty fund. Members are released.
- **Members:**
  - Only KYC-verified members of the group's branch can join, and each member belongs to one active group.
  - A group has at most one leader, one secretary and one treasurer. Giving a role to someone hands the old holder's
    role over (they swap).
  - A member with an open group loan, or who owes the fund, cannot leave. An active group keeps its officers and its
    minimum size.
- **Schedule and assignment:**
  - The meeting day, time (24-hour), frequency and place are set on the group.
  - The loan officer is a staff member assigned to the group's branch.
  - The **arrears limit** (days) is also set per group; the default is 7.
- **Meetings:** one per group per date, with attendance (present, absent, excused) for every active member.
- **Migration from the old jsonb:**
  - Members move to `group_members`. Entries for unknown borrowers are skipped.
  - A member listed in two groups stays in the first.
  - A duplicate leader, secretary or treasurer becomes a member.
  - Groups that were already "Active" stay active even if they are below the minimum. The minimum applies when a
    group is activated or reinstated.

## The solidarity mechanism

### Overdue alerts

The overdue check (`runOverdueCheck`, every 6 hours and on demand) calls `alertOverdueGroups`. For each overdue
installment of a group loan it notifies:

- the leader,
- every other member,
- the branch staff.

It also writes an audit row. `group_overdue_alerts` is keyed on loan and installment, so each installment alerts the
group once.

### The solidarity fund

Each group has a fund, held in **GL 2040 Group Solidarity Fund Payable**. Its balance on the group row is a cache of
`group_fund_transactions`, which are never deleted. `reconcileGroupFunds` checks the cache against the history and
against GL 2040.

| Movement | When | Journal |
|---|---|---|
| Contribution | member pays in (usually in a group collection) | Dr 1010/1020 cash · Cr 2040 |
| Cover | a manager uses the fund for a member's **overdue** amount | Dr 2040 · Cr 1116 / 4010 / 1110 (the payment's waterfall) |
| Cover repayment | the member pays the fund back | Dr 1010/1020 · Cr 2040 |
| Refund | fund paid out (e.g. before dissolving) | Dr 2040 · Cr 1010/1020 |

A cover runs in one transaction:

1. It posts an ordinary loan payment with method `SOLIDARITY_FUND`, so the member's installments are paid by the
   normal waterfall.
2. It creates a `solidarity_covers` row with the amount the member **owes back**.
3. It writes a `COVER` fund transaction.
4. It writes an audit row, and notifies the member, the leader and the branch.

The amount is at most what is overdue, and at most what the fund holds. It is idempotent on its key.

A payment made by the fund cannot be reversed with the ordinary reversal (409 `COVER_PAYMENT`). It belongs to the
cover.

### Choosing the fund over compulsory savings

The spec allows covering from "the group's compulsory savings or solidarity fund". Covers come **only from the
solidarity fund**. Compulsory savings accounts (B4) stay member-owned and are not drawn on to pay another member's
loan.

### The block on new loans

`groupBlock` blocks the group from new loans while either of these holds:

- any active member's group loan has an installment unpaid for **more than the group's arrears limit**, or
- any member **still owes the fund** for a cover.

Once the fund has covered a member, their loan is current, but the group's money is still out. So the group stays
blocked until the cover is repaid. "Until the arrears are cleared" means until both the loan arrears and the cover
are settled.

The block is checked when a group product is applied for (`GROUP_IN_ARREARS`), when it is approved, and when it is
released. Individual products are not affected.

## Group collection (batch posting)

`postCollection` takes one line per member: a loan payment, a fund contribution and/or a cover repayment. It posts
every line in **one database transaction**: all lines are recorded, or none are.

- It is idempotent on its key. A repeat returns the same collection.
- Each loan payment gets its own receipt.
- When a bank or e-wallet transfer covers several loan payments, each payment's reference is suffixed `/n` so
  receipts stay unique.

## Permissions

| Action | Permission |
|---|---|
| Form, edit and activate groups; members and roles; meetings; record consent at a meeting | `manage_loan_applications` |
| Suspend, reinstate, dissolve; cover from the fund; refund the fund | `approve_sensitive_operations` |
| Group collection; cover repayment | `process_loan_repayments` |
| View | any of `view_client_info`, `manage_loan_applications`, `process_loan_applications`, `process_loan_repayments`, `view_all_records` |

Branch staff only see their branch's groups. A member sees their own group in the portal:

- names, roles and whether each member is up to date (not the amounts),
- their own covers,
- the loans waiting for their consent.
