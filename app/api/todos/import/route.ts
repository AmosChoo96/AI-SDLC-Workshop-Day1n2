import { NextRequest, NextResponse } from "next/server";
import { todoDB } from "@/lib/db";
import { toSingaporeIso, getSingaporeNow } from "@/lib/timezone";

type ImportTodo = {
  title?: string;
  description?: string | null;
  priority?: "high" | "medium" | "low";
  recurrence_pattern?: "daily" | "weekly" | "monthly" | "yearly" | null;
  due_date?: string | null;
  completed?: number | boolean;
  created_at?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Import data must be an array of todos" },
        { status: 400 },
      );
    }

    let importedCount = 0;
    const nowIso = toSingaporeIso(getSingaporeNow());

    for (const item of body) {
      const todo = item as ImportTodo;

      // Validate required fields
      if (!todo.title || typeof todo.title !== "string") {
        continue;
      }

      const title = todo.title.trim();
      if (!title) {
        continue;
      }

      // Validate optional fields
      const priority = ["high", "medium", "low"].includes(
        todo.priority as string,
      )
        ? todo.priority
        : "medium";

      const recurrencePattern = [
        "daily",
        "weekly",
        "monthly",
        "yearly",
        null,
      ].includes(todo.recurrence_pattern as string)
        ? todo.recurrence_pattern
        : null;

      const completed =
        typeof todo.completed === "boolean"
          ? todo.completed
            ? 1
            : 0
          : typeof todo.completed === "number"
            ? todo.completed
            : 0;

      try {
        todoDB.create(
          {
            title,
            description:
              todo.description && typeof todo.description === "string"
                ? todo.description.trim() || null
                : null,
            priority: priority as "high" | "medium" | "low",
            recurrence_pattern: recurrencePattern as
              | "daily"
              | "weekly"
              | "monthly"
              | "yearly"
              | null,
            due_date:
              todo.due_date && typeof todo.due_date === "string"
                ? todo.due_date
                : null,
          },
          nowIso,
        );

        importedCount++;
      } catch {
        // Skip items that fail to import
        continue;
      }
    }

    return NextResponse.json(
      { success: true, imported: importedCount },
      { status: 200 },
    );
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import todos." },
      { status: 500 },
    );
  }
}
