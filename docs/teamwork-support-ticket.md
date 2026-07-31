# Teamwork support ticket - Finance API records not returned

Use this complete text only if the production OAuth connector continues to return empty collections for values visibly saved in Teamwork.

## Subject

Saved task-list budgets and project budget expenses are not returned by documented Teamwork API endpoints

## Message

Hello Teamwork Support,

We are building an internal, read-only reporting integration for our Teamwork site:

```text
prologuesystems.teamwork.com
```

For the following project and active financial budget, values are visible and saved in the Teamwork Finance interface:

```text
Project: 26-120 - Four Seasons Jackson Hole - BDT
Project ID: 1226371
Project budget ID: 316621
```

However, the documented read endpoints return HTTP 200 with empty collections.

Task-list budget request:

```text
GET /projects/api/v3/projects/budgets/316621/tasklists/budgets.json
```

Observed response collection:

```text
tasklistBudgets: []
```

Budget-expense request:

```text
GET /projects/api/v3/projects/budgets/316621/expenses.json
```

Observed response collection:

```text
budgetExpenses: []
```

The authenticated account is an owner-company site administrator and can view the same financial information in the Teamwork interface. Other project, task, time-entry, user-cost, and project-budget endpoints work successfully.

Could you confirm:

1. Whether these are the correct public API endpoints for Finance task-list budgets and Finance budget expenses on a Scale account.
2. Whether an additional request parameter, OAuth scope, or permission is required.
3. Whether the records visible in the Teamwork interface may be stored under a different budget period or object type than these endpoints return.
4. Whether this is a known API issue.

We can provide sanitized request metadata and timestamps if needed. We will not send access tokens or client secrets.

Thank you.
