# PRP 10: Calendar View

## Feature Overview

Provide a monthly calendar visualization of todos by due date, including month navigation and Singapore public holiday context.

## User Stories

- As a user, I can view todos arranged by calendar day.
- As a user, I can navigate between months.
- As a user, I can quickly identify days with many due tasks.
- As a user in Singapore, I can see public holidays in the calendar context.

## Technical Requirements

- Calendar layout:
  - Monthly grid (7 columns, week rows).
  - Leading/trailing day alignment for month boundaries.
- Data mapping:
  - Group todos by due date day in Singapore timezone.
  - Show day-level indicators and/or todo list snippets.
- Navigation:
  - Previous month / next month controls.
  - Jump to current month action.
- Holiday integration:
  - Read Singapore public holidays from `holidays` table when available.
  - Distinct visual marker for holiday dates.

## API and Data Notes

- Existing todos endpoint may be reused for first version.
- Optional dedicated endpoint for month-bounded queries in larger datasets.
- Date calculations must use Singapore timezone helpers.

## UI Requirements

- `/calendar` page route.
- Month-year header with navigation controls.
- Per-day cell includes:
  - date number
  - todo count or top items
  - holiday indicator/title when relevant

## Acceptance Criteria

- Calendar renders correctly for any month/year.
- Todos appear on correct calendar day in SG timezone.
- Month navigation updates view accurately.
- Holidays are shown when holiday data exists.

## Edge Cases

- Todos without due date should not appear on date cells.
- Leap year February and month transitions.
- Months starting on Sunday/Monday depending on chosen week start.

## Out of Scope

- Drag-and-drop scheduling
- Week/day agenda views
- Shared team calendars

## Testing Guidance

- Verify month rendering for 28/29/30/31-day months.
- Verify timezone placement around UTC date boundaries.
- Verify holiday markers for seeded Singapore holidays.
- Verify navigation persistence and URL state (if used).
