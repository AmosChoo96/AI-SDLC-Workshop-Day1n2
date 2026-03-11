'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Todo = {
  id: number;
  title: string;
  description: string | null;
  priority: 'high' | 'medium' | 'low';
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  due_date: string | null;
  completed: 0 | 1;
  created_at: string;
  updated_at: string;
};

type TodoDraft = {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  recurrence_pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  due_date: string;
};

const emptyDraft: TodoDraft = {
  title: '',
  description: '',
  priority: 'medium',
  recurrence_pattern: 'none',
  due_date: '',
};

function toLocalInputDateTime(isoText: string): string {
  const date = new Date(isoText);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputDateTime(localText: string): string {
  return new Date(localText).toISOString();
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const editingTodo = useMemo(
    () => todos.find((todo) => todo.id === editingId) ?? null,
    [editingId, todos]
  );

  useEffect(() => {
    void fetchTodos();
  }, []);

  async function fetchTodos() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/todos', { method: 'GET' });
      const payload = (await response.json()) as { data?: Todo[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch todos.');
      }

      setTodos(payload.data ?? []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'Failed to fetch todos.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setDraft({
      title: todo.title,
      description: todo.description ?? '',
      priority: todo.priority,
      recurrence_pattern: todo.recurrence_pattern ?? 'none',
      due_date: todo.due_date ? toLocalInputDateTime(todo.due_date) : '',
    });
    resetFeedback();
  }

  function stopEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function validateDraft(current: TodoDraft): string | null {
    const trimmed = current.title.trim();

    if (!trimmed) {
      return 'Title is required.';
    }

    if (trimmed.length > 120) {
      return 'Title must be 120 characters or less.';
    }

    if (current.description.length > 500) {
      return 'Description must be 500 characters or less.';
    }

    return null;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();

    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    const optimisticTodo: Todo = {
      id: -Date.now(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      recurrence_pattern:
        draft.recurrence_pattern === 'none' ? null : draft.recurrence_pattern,
      due_date: draft.due_date ? fromLocalInputDateTime(draft.due_date) : null,
      completed: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const previousTodos = todos;
    setTodos((current) => [optimisticTodo, ...current]);
    setIsSubmitting(true);
    setDraft(emptyDraft);

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: optimisticTodo.title,
          description: optimisticTodo.description,
          priority: optimisticTodo.priority,
          recurrence_pattern: optimisticTodo.recurrence_pattern,
          due_date: optimisticTodo.due_date,
        }),
      });

      const payload = (await response.json()) as {
        data?: Todo;
        next_todo?: Todo;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to create todo.');
      }

      setTodos((current) =>
        current.map((todo) => (todo.id === optimisticTodo.id ? payload.data! : todo))
      );
      setMessage('Todo created.');
    } catch (createError) {
      setTodos(previousTodos);
      setError(
        createError instanceof Error ? createError.message : 'Failed to create todo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(todo: Todo) {
    resetFeedback();

    const previousTodos = todos;
    const nextCompleted = todo.completed ? 0 : 1;

    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, completed: nextCompleted } : item
      )
    );

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: Boolean(nextCompleted) }),
      });

      const payload = (await response.json()) as { data?: Todo; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to update todo.');
      }

      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? payload.data! : item))
      );

      if (payload.next_todo) {
        setTodos((current) => [payload.next_todo as Todo, ...current]);
      }

      setMessage('Todo updated.');
    } catch (updateError) {
      setTodos(previousTodos);
      setError(
        updateError instanceof Error ? updateError.message : 'Failed to update todo.'
      );
    }
  }

  async function handleDelete(todo: Todo) {
    resetFeedback();

    const previousTodos = todos;
    setTodos((current) => current.filter((item) => item.id !== todo.id));

    try {
      const response = await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to delete todo.');
      }

      if (editingId === todo.id) {
        stopEdit();
      }

      setMessage('Todo deleted.');
    } catch (deleteError) {
      setTodos(previousTodos);
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete todo.'
      );
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTodo) {
      return;
    }

    resetFeedback();
    const validationError = validateDraft(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    const previousTodos = todos;
    const optimisticUpdate: Todo = {
      ...editingTodo,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      recurrence_pattern:
        draft.recurrence_pattern === 'none' ? null : draft.recurrence_pattern,
      due_date: draft.due_date ? fromLocalInputDateTime(draft.due_date) : null,
      updated_at: new Date().toISOString(),
    };

    setTodos((current) =>
      current.map((item) => (item.id === editingTodo.id ? optimisticUpdate : item))
    );
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: optimisticUpdate.title,
          description: optimisticUpdate.description,
          priority: optimisticUpdate.priority,
          recurrence_pattern: optimisticUpdate.recurrence_pattern,
          due_date: optimisticUpdate.due_date,
        }),
      });

      const payload = (await response.json()) as { data?: Todo; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to update todo.');
      }

      setTodos((current) =>
        current.map((item) => (item.id === editingTodo.id ? payload.data! : item))
      );
      setMessage('Todo updated.');
      stopEdit();
    } catch (updateError) {
      setTodos(previousTodos);
      setError(
        updateError instanceof Error ? updateError.message : 'Failed to update todo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleTodos =
    priorityFilter === 'all'
      ? todos
      : todos.filter((todo) => todo.priority === priorityFilter);

  return (
    <main>
      <div className="container stack">
        <header className="stack">
          <h1>Todo App - Core Feature 1</h1>
          <p className="muted">
            Create, read, update and delete todos with validation, Singapore
            timestamps and optimistic UI updates.
          </p>
        </header>

        <section className="card stack">
          <h2>{editingTodo ? 'Edit Todo' : 'Create Todo'}</h2>
          <form className="stack" onSubmit={editingTodo ? handleSaveEdit : handleCreate}>
            <input
              placeholder="Title"
              value={draft.title}
              maxLength={120}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
            <textarea
              placeholder="Description (optional)"
              value={draft.description}
              maxLength={500}
              rows={3}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
            <div className="field-block">
              <p className="field-label">Priority</p>
              <select
                value={draft.priority}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priority: event.target.value as 'high' | 'medium' | 'low',
                  }))
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="field-block">
              <p className="field-label">Recurrence</p>
              <select
                value={draft.recurrence_pattern}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    recurrence_pattern: event.target.value as
                      | 'none'
                      | 'daily'
                      | 'weekly'
                      | 'monthly'
                      | 'yearly',
                  }))
                }
              >
                <option value="none">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="field-block">
              <p className="field-label">Due Date</p>
              <input
                type="datetime-local"
                value={draft.due_date}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, due_date: event.target.value }))
                }
              />
            </div>
            <div className="row">
              <button className="primary" type="submit" disabled={isSubmitting}>
                {editingTodo ? 'Save Changes' : 'Add Todo'}
              </button>
              {editingTodo ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={stopEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {error ? <div className="error">{error}</div> : null}
          {message ? <div className="success">{message}</div> : null}
        </section>

        <section className="card stack">
          <div className="row between">
            <h2>Todos</h2>
            <div className="row">
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value as 'all' | 'high' | 'medium' | 'low'
                  )
                }
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button className="secondary" onClick={() => void fetchTodos()}>
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? <p className="muted">Loading...</p> : null}

          {!isLoading && todos.length === 0 ? (
            <p className="muted">No todos yet. Create your first one above.</p>
          ) : null}

          {visibleTodos.map((todo) => (
            <article
              key={todo.id}
              className={`todo ${todo.completed ? 'done' : ''}`}
            >
              <div className="row between">
                <div className="row">
                  <h3>{todo.title}</h3>
                  <span className={`badge ${todo.priority}`}>
                    {todo.priority.toUpperCase()}
                  </span>
                </div>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={() => void handleToggle(todo)}
                  >
                    {todo.completed ? 'Mark Incomplete' : 'Mark Complete'}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => startEdit(todo)}
                    disabled={editingId === todo.id}
                  >
                    Edit
                  </button>
                  <button
                    className="danger"
                    onClick={() => void handleDelete(todo)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {todo.description ? <p>{todo.description}</p> : null}

              <p className="muted">
                Due:{' '}
                {todo.due_date
                  ? new Date(todo.due_date).toLocaleString('en-SG', {
                      timeZone: 'Asia/Singapore',
                    })
                  : 'No due date'}
              </p>

              <p className="muted">
                Recurrence:{' '}
                {todo.recurrence_pattern
                  ? todo.recurrence_pattern[0].toUpperCase() +
                    todo.recurrence_pattern.slice(1)
                  : 'None'}
              </p>

              <p className="muted">
                Updated:{' '}
                {new Date(todo.updated_at).toLocaleString('en-SG', {
                  timeZone: 'Asia/Singapore',
                })}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
