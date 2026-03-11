import { NextRequest, NextResponse } from "next/server";
import { todoDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format") || "json";

    if (!["json", "csv"].includes(format)) {
      return NextResponse.json(
        { error: "Format must be 'json' or 'csv'" },
        { status: 400 },
      );
    }

    const todos = todoDB.list();

    if (format === "json") {
      const json = JSON.stringify(todos, null, 2);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            `attachment; filename="todos-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // CSV format
    const headers = [
      "ID",
      "Title",
      "Completed",
      "Due Date",
      "Priority",
      "Recurring",
      "Pattern",
      "Reminder",
      "Created At",
    ];
    const rows = todos.map((todo) => [
      todo.id,
      `"${(todo.title || "").replace(/"/g, '""')}"`,
      todo.completed ? "true" : "false",
      todo.due_date || "",
      todo.priority || "",
      todo.recurrence_pattern ? "true" : "false",
      todo.recurrence_pattern || "",
      "",
      todo.created_at,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition":
          `attachment; filename="todos-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export todos." },
      { status: 500 },
    );
  }
}
