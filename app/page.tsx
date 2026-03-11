"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Todo = {
  id: number;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  recurrence_pattern: "daily" | "weekly" | "monthly" | "yearly" | null;
  due_date: string | null;
  completed: 0 | 1;
  created_at: string;
  updated_at: string;
};

type TodoDraft = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  recurrence_pattern: "none" | "daily" | "weekly" | "monthly" | "yearly";
  due_date: string;
};

type FilterPreset = {
  name: string;
  search: string;
  priority: "all" | "high" | "medium" | "low";
  completion: "all" | "completed" | "incomplete";
  dateFrom: string;
  dateTo: string;
};

const emptyDraft: TodoDraft = {
  title: "",
  description: "",
  priority: "medium",
  recurrence_pattern: "none",
  due_date: "",
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
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<
    "all" | "completed" | "incomplete"
  >("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const editingTodo = useMemo(
    () => todos.find((todo) => todo.id === editingId) ?? null,
    [editingId, todos],
  );

  useEffect(() => {
    void fetchTodos();
    loadPresets();
  }, []);

  function loadPresets() {
    try {
      const saved = localStorage.getItem("filterPresets");
      if (saved) {
        setPresets(JSON.parse(saved) as FilterPreset[]);
      }
    } catch {
      // Ignore errors loading presets
    }
  }

  function savePresets(updatedPresets: FilterPreset[]) {
    try {
      localStorage.setItem("filterPresets", JSON.stringify(updatedPresets));
      setPresets(updatedPresets);
    } catch {
      // Ignore errors saving presets
    }
  }

  async function fetchTodos() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/todos", { method: "GET" });
      const payload = (await response.json()) as {
        data?: Todo[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to fetch todos.");
      }

      setTodos(payload.data ?? []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch todos.",
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
      description: todo.description ?? "",
      priority: todo.priority,
      recurrence_pattern: todo.recurrence_pattern ?? "none",
      due_date: todo.due_date ? toLocalInputDateTime(todo.due_date) : "",
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
      return "Title is required.";
    }

    if (trimmed.length > 120) {
      return "Title must be 120 characters or less.";
    }

    if (current.description.length > 500) {
      return "Description must be 500 characters or less.";
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
        draft.recurrence_pattern === "none" ? null : draft.recurrence_pattern,
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
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(payload.error || "Failed to create todo.");
      }

      setTodos((current) =>
        current.map((todo) =>
          todo.id === optimisticTodo.id ? payload.data! : todo,
        ),
      );
      setMessage("Todo created.");
    } catch (createError) {
      setTodos(previousTodos);
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create todo.",
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
        item.id === todo.id ? { ...item, completed: nextCompleted } : item,
      ),
    );

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: Boolean(nextCompleted) }),
      });

      const payload = (await response.json()) as {
        data?: Todo;
        next_todo?: Todo;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to update todo.");
      }

      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? payload.data! : item)),
      );

      if (payload.next_todo) {
        setTodos((current) => [payload.next_todo as Todo, ...current]);
      }

      setMessage("Todo updated.");
    } catch (updateError) {
      setTodos(previousTodos);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update todo.",
      );
    }
  }

  async function handleDelete(todo: Todo) {
    resetFeedback();

    const previousTodos = todos;
    setTodos((current) => current.filter((item) => item.id !== todo.id));

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete todo.");
      }

      if (editingId === todo.id) {
        stopEdit();
      }

      setMessage("Todo deleted.");
    } catch (deleteError) {
      setTodos(previousTodos);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete todo.",
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
        draft.recurrence_pattern === "none" ? null : draft.recurrence_pattern,
      due_date: draft.due_date ? fromLocalInputDateTime(draft.due_date) : null,
      updated_at: new Date().toISOString(),
    };

    setTodos((current) =>
      current.map((item) =>
        item.id === editingTodo.id ? optimisticUpdate : item,
      ),
    );
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/todos/${editingTodo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: optimisticUpdate.title,
          description: optimisticUpdate.description,
          priority: optimisticUpdate.priority,
          recurrence_pattern: optimisticUpdate.recurrence_pattern,
          due_date: optimisticUpdate.due_date,
        }),
      });

      const payload = (await response.json()) as {
        data?: Todo;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to update todo.");
      }

      setTodos((current) =>
        current.map((item) =>
          item.id === editingTodo.id ? payload.data! : item,
        ),
      );
      setMessage("Todo updated.");
      stopEdit();
    } catch (updateError) {
      setTodos(previousTodos);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update todo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport(format: "json" | "csv") {
    try {
      const response = await fetch(`/api/todos/export?format=${format}`);
      if (!response.ok) {
        setError("Failed to export todos.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `todos-${new Date().toISOString().split("T")[0]}.${format === "json" ? "json" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage(`Exported as ${format.toUpperCase()}`);
    } catch {
      setError(`Failed to export as ${format.toUpperCase()}`);
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as unknown;

        const response = await fetch("/api/todos/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const payload = (await response.json()) as {
          imported?: number;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to import todos.");
        }

        setMessage(`Successfully imported ${payload.imported || 0} todos`);
        void fetchTodos();
      } catch {
        setError("Failed to import todos. Please check the file format.");
      }
    };
    input.click();
  }

  const visibleTodos = useMemo(() => {
    let filtered = todos;

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((todo) => todo.priority === priorityFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((todo) =>
        todo.title.toLowerCase().includes(query),
      );
    }

    // Completion filter
    if (completionFilter === "completed") {
      filtered = filtered.filter((todo) => todo.completed);
    } else if (completionFilter === "incomplete") {
      filtered = filtered.filter((todo) => !todo.completed);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((todo) => {
        if (!todo.due_date) return false;
        const dueDate = new Date(todo.due_date);
        if (dateFrom) {
          const from = new Date(dateFrom);
          if (dueDate < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (dueDate > to) return false;
        }
        return true;
      });
    }

    return filtered;
  }, [todos, priorityFilter, searchQuery, completionFilter, dateFrom, dateTo]);

  function handleSavePreset() {
    if (!presetName.trim()) {
      setError("Preset name is required.");
      return;
    }

    const newPreset: FilterPreset = {
      name: presetName,
      search: searchQuery,
      priority: priorityFilter,
      completion: completionFilter,
      dateFrom,
      dateTo,
    };

    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    setPresetName("");
    setShowSavePreset(false);
    setMessage("Filter preset saved.");
  }

  function applyPreset(preset: FilterPreset) {
    setSearchQuery(preset.search);
    setPriorityFilter(preset.priority);
    setCompletionFilter(preset.completion);
    setDateFrom(preset.dateFrom);
    setDateTo(preset.dateTo);
  }

  function deletePreset(name: string) {
    const updatedPresets = presets.filter((p) => p.name !== name);
    savePresets(updatedPresets);
  }

  const hasActiveFilters =
    searchQuery || priorityFilter !== "all" || completionFilter !== "all" || dateFrom || dateTo;

  function clearAllFilters() {
    setSearchQuery("");
    setPriorityFilter("all");
    setCompletionFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <main>
      <div className="container stack">
        <header className="stack">
          <div className="row between">
            <div>
              <h1>Todo App</h1>
              <p className="muted">
                Organize your tasks with powerful filtering, search, and calendar view.
              </p>
            </div>
            <div className="row">
              <Link href="/calendar">
                <button className="secondary">📅 Calendar</button>
              </Link>
              <button className="secondary" onClick={() => handleExport("json")}>
                Export JSON
              </button>
              <button className="secondary" onClick={() => handleExport("csv")}>
                Export CSV
              </button>
              <button className="secondary" onClick={handleImport}>
                Import
              </button>
            </div>
          </div>
        </header>

        <section className="card stack">
          <h2>{editingTodo ? "Edit Todo" : "Create Todo"}</h2>
          <form
            className="stack"
            onSubmit={editingTodo ? handleSaveEdit : handleCreate}
          >
            <input
              placeholder="Title"
              value={draft.title}
              maxLength={120}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <textarea
              placeholder="Description (optional)"
              value={draft.description}
              maxLength={500}
              rows={3}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            <div className="field-block">
              <p className="field-label">Priority</p>
              <select
                value={draft.priority}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priority: event.target.value as "high" | "medium" | "low",
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
                      | "none"
                      | "daily"
                      | "weekly"
                      | "monthly"
                      | "yearly",
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
                  setDraft((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
              />
            </div>
            <div className="row">
              <button className="primary" type="submit" disabled={isSubmitting}>
                {editingTodo ? "Save Changes" : "Add Todo"}
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
            <button className="secondary" onClick={() => void fetchTodos()}>
              Refresh
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder="🔍 Search todos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value as "all" | "high" | "medium" | "low",
                )
              }
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button
              className="secondary"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                backgroundColor: showAdvanced ? "#3B82F6" : undefined,
                color: showAdvanced ? "white" : undefined,
              }}
            >
              {showAdvanced ? "▼" : "▶"} Advanced
            </button>

            {hasActiveFilters && (
              <>
                <button
                  className="secondary"
                  style={{ backgroundColor: "#EF4444", color: "white" }}
                  onClick={clearAllFilters}
                >
                  Clear All
                </button>
                <button
                  className="secondary"
                  style={{ backgroundColor: "#10B981", color: "white" }}
                  onClick={() => setShowSavePreset(true)}
                >
                  💾 Save Filter
                </button>
              </>
            )}
          </div>

          {showAdvanced && (
            <div
              style={{
                backgroundColor: "#F3F4F6",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div className="row between">
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem" }}>
                      Completion Status
                    </label>
                    <select
                      value={completionFilter}
                      onChange={(e) =>
                        setCompletionFilter(
                          e.target.value as "all" | "completed" | "incomplete",
                        )
                      }
                    >
                      <option value="all">All Todos</option>
                      <option value="incomplete">Incomplete Only</option>
                      <option value="completed">Completed Only</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem" }}>
                      Due Date From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem" }}>
                      Due Date To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {presets.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #D1D5DB" }}>
                  <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem", color: "#6B7280" }}>
                    Saved Filter Presets
                  </p>
                  <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    {presets.map((preset) => (
                      <div
                        key={preset.name}
                        className="row"
                        style={{
                          backgroundColor: "white",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.25rem",
                          border: "1px solid #D1D5DB",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          className="secondary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                          onClick={() => applyPreset(preset)}
                        >
                          {preset.name}
                        </button>
                        <button
                          className="secondary"
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#EF4444",
                            color: "white",
                          }}
                          onClick={() => deletePreset(preset.name)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showSavePreset && (
            <div
              style={{
                backgroundColor: "#FEF3C7",
                padding: "1rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <div className="row">
                <input
                  type="text"
                  placeholder="Preset name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="secondary"
                  onClick={handleSavePreset}
                  style={{ backgroundColor: "#10B981", color: "white" }}
                >
                  Save
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setShowSavePreset(false);
                    setPresetName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isLoading ? <p className="muted">Loading...</p> : null}

          {!isLoading && visibleTodos.length === 0 ? (
            <p className="muted">No todos match your criteria.</p>
          ) : null}

          {visibleTodos.map((todo) => (
            <article
              key={todo.id}
              className={`todo ${todo.completed ? "done" : ""}`}
            >
              <div className="row between">
                <div className="row">
                  <input
                    type="checkbox"
                    checked={Boolean(todo.completed)}
                    onChange={() => void handleToggle(todo)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  <h3 style={{ margin: 0 }}>{todo.title}</h3>
                  <span className={`badge ${todo.priority}`}>
                    {todo.priority.toUpperCase()}
                  </span>
                </div>
                <div className="row">
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

              {todo.due_date && (
                <p className="muted">
                  Due:{" "}
                  {new Date(todo.due_date).toLocaleString("en-SG", {
                    timeZone: "Asia/Singapore",
                  })}
                </p>
              )}

              {todo.recurrence_pattern && (
                <p className="muted">
                  Recurrence: {todo.recurrence_pattern[0].toUpperCase() + todo.recurrence_pattern.slice(1)}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
