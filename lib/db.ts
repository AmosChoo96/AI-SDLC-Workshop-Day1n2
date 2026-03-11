import Database from 'better-sqlite3';
import path from 'node:path';
import { calculateNextDueDate } from '@/lib/timezone';

const databasePath = path.join(process.cwd(), 'todos.db');
const db = new Database(databasePath, { timeout: 5000 });

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

try {
  db.exec(`ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';`);
} catch {
  // Column already exists for existing databases.
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT;`);
} catch {
  // Column already exists for existing databases.
}

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type Todo = {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  recurrence_pattern: RecurrencePattern | null;
  due_date: string | null;
  completed: 0 | 1;
  created_at: string;
  updated_at: string;
};

type TodoInput = {
  title: string;
  description?: string | null;
  priority?: Priority;
  recurrence_pattern?: RecurrencePattern | null;
  due_date?: string | null;
};

type TodoUpdateInput = {
  title?: string;
  description?: string | null;
  priority?: Priority;
  recurrence_pattern?: RecurrencePattern | null;
  due_date?: string | null;
  completed?: boolean;
};

const getAllStmt = db.prepare(`
  SELECT id, title, description, priority, recurrence_pattern, due_date, completed, created_at, updated_at
  FROM todos
  ORDER BY
    CASE priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      ELSE 3
    END ASC,
    datetime(created_at) DESC;
`);

const getByIdStmt = db.prepare(`
  SELECT id, title, description, priority, recurrence_pattern, due_date, completed, created_at, updated_at
  FROM todos
  WHERE id = ?;
`);

const createStmt = db.prepare(`
  INSERT INTO todos (title, description, priority, recurrence_pattern, due_date, completed, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 0, ?, ?);
`);

const updateStmt = db.prepare(`
  UPDATE todos
  SET
    title = ?,
    description = ?,
    priority = ?,
    recurrence_pattern = ?,
    due_date = ?,
    completed = ?,
    updated_at = ?
  WHERE id = ?;
`);

const deleteStmt = db.prepare(`
  DELETE FROM todos
  WHERE id = ?;
`);

const completeRecurringTx = db.transaction(
  (id: number, nowIso: string): { current: Todo; next: Todo } | undefined => {
    const current = getByIdStmt.get(id) as Todo | undefined;

    if (!current) {
      return undefined;
    }

    const completedResult = updateStmt.run(
      null,
      current.description,
      current.priority,
      current.recurrence_pattern,
      current.due_date,
      1,
      nowIso,
      id
    );

    if (completedResult.changes === 0) {
      return undefined;
    }

    const nextDueDate = calculateNextDueDate(
      current.due_date ?? nowIso,
      current.recurrence_pattern as RecurrencePattern
    );

    const insertResult = createStmt.run(
      current.title,
      current.description,
      current.priority,
      current.recurrence_pattern,
      nextDueDate,
      nowIso,
      nowIso
    );

    const updatedCurrent = getByIdStmt.get(id) as Todo;
    const nextTodo = getByIdStmt.get(Number(insertResult.lastInsertRowid)) as Todo;

    return { current: updatedCurrent, next: nextTodo };
  }
);

export const todoDB = {
  list(): Todo[] {
    return getAllStmt.all() as Todo[];
  },

  getById(id: number): Todo | undefined {
    return getByIdStmt.get(id) as Todo | undefined;
  },

  create(input: TodoInput, nowIso: string): Todo {
    const result = createStmt.run(
      input.title,
      input.description ?? null,
      input.priority ?? 'medium',
      input.recurrence_pattern ?? null,
      input.due_date ?? null,
      nowIso,
      nowIso
    );

    return this.getById(Number(result.lastInsertRowid)) as Todo;
  },

  update(id: number, input: TodoUpdateInput, nowIso: string): Todo | undefined {
    const existing = this.getById(id);

    if (!existing) {
      return undefined;
    }

    const title = input.title ?? existing.title;
    const description =
      input.description === undefined ? existing.description : input.description;
    const priority = input.priority ?? existing.priority;
    const recurrencePattern =
      input.recurrence_pattern === undefined
        ? existing.recurrence_pattern
        : input.recurrence_pattern;
    const dueDate = input.due_date === undefined ? existing.due_date : input.due_date;
    const completed =
      typeof input.completed === 'boolean'
        ? (input.completed ? 1 : 0)
        : existing.completed;

    const result = updateStmt.run(
      title,
      description,
      priority,
      recurrencePattern,
      dueDate,
      completed,
      nowIso,
      id
    );

    if (result.changes === 0) {
      return undefined;
    }

    return this.getById(id);
  },

  delete(id: number): boolean {
    const result = deleteStmt.run(id);
    return result.changes > 0;
  },

  completeRecurring(id: number, nowIso: string): { current: Todo; next: Todo } | undefined {
    return completeRecurringTx(id, nowIso);
  },
};
