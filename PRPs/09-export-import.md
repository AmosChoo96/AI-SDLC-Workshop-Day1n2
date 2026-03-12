# PRP 09: Export & Import

## Feature Overview

Enable users to back up and restore todo data via JSON export/import, preserving relationships and validating payloads safely.

## User Stories

- As a user, I can export my todos to a JSON file.
- As a user, I can import a valid backup JSON to restore data.
- As a user, imported data keeps related records linked correctly.

## Technical Requirements

- Export:
  - Provide endpoint to serialize todos and related entities.
  - Include schema version metadata.
  - Return downloadable JSON payload.
- Import:
  - Accept JSON payload and validate structure before write.
  - Remap IDs to avoid collisions.
  - Preserve relationships (todo-to-subtask, todo-to-tags, etc.).
  - Handle partial invalid records by failing safely or reporting per strategy.
- Validation:
  - Ensure required fields exist and types are correct.
  - Reject malformed or unsupported schema version.
  - Cap payload size to avoid abuse.

## Suggested API Contract

- `GET /api/todos/export`
  - Response includes:
    - `version`
    - `exported_at`
    - `todos` (+ related objects when features exist)
- `POST /api/todos/import`
  - Request body: exported JSON format.
  - Response includes import summary (`created`, `skipped`, `errors`).

## Data Integrity Rules

- Never overwrite existing rows by raw IDs from import.
- Build old-to-new ID maps during import.
- Insert parent entities before dependent entities.
- Wrap import in transaction for consistency.

## UI Requirements

- Export button to download JSON.
- Import control to select JSON file and submit.
- Clear success/error summary after import.

## Acceptance Criteria

- Export output can be re-imported into a clean database.
- ID remapping prevents primary key collisions.
- Relationships remain correct after import.
- Invalid payloads are rejected with clear error messages.

## Edge Cases

- Empty export/import payload.
- Duplicate entities inside import payload.
- Importing into non-empty dataset.

## Out of Scope

- CSV import/export
- Cloud sync
- Incremental merge conflict resolution UI

## Testing Guidance

- Round-trip test: export -> clear DB -> import -> verify counts and relationships.
- Import malformed JSON and wrong schema version.
- Import with duplicate IDs and ensure remapping works.
