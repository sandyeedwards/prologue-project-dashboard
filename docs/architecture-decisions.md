# Architecture decisions

Version: 1.1

## AD-001: One full-stack TypeScript application

Use a Next.js App Router application for the web interface and server endpoints. This keeps the initial system small, deployable as one Node.js service, and appropriate for the expected low simultaneous-user count.

## AD-002: PostgreSQL persistence

Use PostgreSQL for synchronized Teamwork records, mappings, application roles, overrides, saved views, synchronization history, and snapshots. The schema is added in Step 5.

## AD-003: Central Teamwork dataset

One centrally authorized Teamwork administrator connection supplies all dashboard data. Employees do not query reporting data with their own Teamwork tokens.

## AD-004: Teamwork employee login

Use Teamwork OAuth for employee identity. After callback, the application verifies that the user belongs to Prologue's owner company and is not a client user. Application roles remain Viewer, Manager, and Administrator in the dashboard database. Authentication is added in Step 8.

## AD-005: Read-only integration

The application will not implement Teamwork mutation operations. All Teamwork connector calls are GET requests. Configuration changes and overrides affect only the dashboard database.

## AD-006: Missing financial inputs are null

A missing task-list budget or Finance expense is not equivalent to zero. Missing values are stored as `null`, shown as incomplete, and surfaced through data-quality warnings. An audited dashboard override may be used only when Teamwork returns no value.

## AD-007: Task-list budgets represent target cost

When returned, a Teamwork task-list budget represents Prologue's target delivery cost for that task list. It does not represent allocated client revenue. Task-list profit and margin therefore remain unavailable unless a separate revenue allocation is introduced later.

## AD-008: Partial coverage is not a complete total

When an operational group contains several task lists, its complete target cost is calculated only when every included task list has a numeric target-cost source. A known subtotal and coverage count may be displayed, but the subtotal is not labeled as the complete group target cost and does not drive target-cost variance.

The same principle applies to expected non-labor expenses. When required expense coverage is incomplete, actual cost, profit, and margin are marked provisional.

## AD-009: Operational groups are configurable mappings

Mobilization, Fieldwork, and Modeling are reporting groups above Teamwork task lists. Name-pattern matching provides the initial classification, with administrator overrides for exceptions.

## AD-010: Historical actual labor uses time-entry cost

Use the cost total attached to each time entry when returned. Current employee cost rates are used for projected remaining work, not to rewrite historical actual cost.

## AD-011: Node.js LTS baseline

Use Node.js 24 LTS for local development, continuous integration, and production containers. Node.js 22 LTS remains accepted during the initial build period. Node.js 20 is not used because it is end-of-life.

## AD-012: Versioned full-file replacements

Each implementation revision is delivered as a complete versioned package. Changed documents and code files are supplied in full; the user is not expected to locate and replace partial text blocks. Local secret files such as `.env` are preserved separately and never included in replacement packages.
