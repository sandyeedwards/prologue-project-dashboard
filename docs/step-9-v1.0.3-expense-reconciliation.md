# Step 9 v1.0.3 expense reconciliation

This correction addresses a unit mismatch between Teamwork expense endpoints.

## Confirmed Jackson Hole example

- `Priority Area 1`: Teamwork budget-expense value `195000` = `$1,950.00`
- `Priority Area 2`: Teamwork budget-expense value `157500` = `$1,575.00`
- Stored expense total: `$3,525.00`

The legacy `/expenses.json` endpoint returns decimal currency values and is not divided by 100. The budget-expense endpoint returns minor units and is divided by 100 before persistence.

## Reconciliation policy

- Historical labor costs are not rescaled.
- Active expense rows are summed once.
- Duplicate expense IDs returned by both endpoints prefer the budget-expense record.
- Actual project cost equals internal labor plus active expenses.
- Expense rows are displayed on the project detail page for review.
- Expenses are linked to a task list by an explicit Teamwork relationship or a unique exact task-list-name match within the project.
- A linked task list containing an outsourced-modeling task marks the expense as outsourced modeling.

## Upgrade behavior

`npm run step9:setup` refreshes the financial sources and recalculates the project metrics. Existing inflated expense values are overwritten by the corrected normalized values. No database migration or Teamwork reauthorization is required.
