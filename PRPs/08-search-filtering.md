# PRP 08: Search & Filtering

## Feature Overview

Add fast, real-time search and multi-criteria filtering so users can quickly find relevant todos across larger lists.

## User Stories

- As a user, I can search todos by text while typing.
- As a user, I can combine text search with priority/tag/status filters.
- As a user, I can find matching todos without waiting for page reload.

## Technical Requirements

- Search behavior:
  - Real-time filtering on input changes.
  - Case-insensitive match.
  - Match against `title` and `description` at minimum.
- Advanced search:
  - Include title + tags when tag system exists.
  - Support partial text matches.
- Multi-criteria filtering:
  - Filter by completion status (`all`, `active`, `completed`).
  - Filter by priority (`all`, `high`, `medium`, `low`).
  - Filter by recurrence (`all`, `none`, `daily`, `weekly`, `monthly`, `yearly`) once recurrence exists.
- Performance:
  - Client-side filtering for normal todo volumes.
  - Debounce text input only if needed; default is immediate for small datasets.

## API and Data Notes

- No mandatory new API endpoints required for initial version.
- Use already-fetched todo list and derive visible items in client state.
- If dataset grows significantly, optionally add server-side query endpoint later.

## UI Requirements

- Search input placed above todo list.
- Clear filter controls with reset option.
- Empty state for no results (different from no data state).

## Acceptance Criteria

- Typing in search input updates visible list immediately.
- Combined filters produce deterministic results.
- Search and filters work together with existing sorting.
- No noticeable lag for expected local dataset size.

## Edge Cases

- Empty query should show full list (subject to active non-text filters).
- Whitespace-only query should be treated as empty.
- Filtering should still work when there are zero todos.

## Out of Scope

- Fuzzy ranking algorithms
- Saved search presets
- Full-text index in SQLite

## Testing Guidance

- Search by title and description terms.
- Combine search + status + priority filters.
- Validate no-results message.
- Validate behavior with mixed casing.
