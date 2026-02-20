from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from config import AppConfig, load_config, save_config
from db import ColumnInfo, connect, execute_script, list_columns, list_tables, ping
from migrations import apply_pending, discover_migrations, preview_pending_sql, rollback_last


class SchemaAdminApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Edufika Schema Admin")
        self.geometry("1220x780")
        self.minsize(980, 640)

        cfg = load_config()
        self.db_url_var = tk.StringVar(value=cfg.db_url)
        self.migrations_dir_var = tk.StringVar(value=cfg.migrations_dir)
        self.status_var = tk.StringVar(value="Ready.")

        self._table_refs = []
        self._build_ui()
        self._append_log("Schema Admin initialized.")
        self._append_log(f"Default migrations dir: {self.migrations_dir_var.get()}")

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=10)
        root.pack(fill=tk.BOTH, expand=True)

        conn_frame = ttk.LabelFrame(root, text="Connection")
        conn_frame.pack(fill=tk.X, pady=(0, 8))

        ttk.Label(conn_frame, text="Database URL").grid(row=0, column=0, sticky=tk.W, padx=6, pady=6)
        ttk.Entry(conn_frame, textvariable=self.db_url_var).grid(
            row=0, column=1, sticky=tk.EW, padx=6, pady=6
        )
        ttk.Button(conn_frame, text="Test", command=self._on_test_connection).grid(
            row=0, column=2, sticky=tk.EW, padx=6, pady=6
        )

        ttk.Label(conn_frame, text="Migrations Dir").grid(row=1, column=0, sticky=tk.W, padx=6, pady=6)
        ttk.Entry(conn_frame, textvariable=self.migrations_dir_var).grid(
            row=1, column=1, sticky=tk.EW, padx=6, pady=6
        )
        ttk.Button(conn_frame, text="Browse", command=self._on_browse_migrations).grid(
            row=1, column=2, sticky=tk.EW, padx=6, pady=6
        )
        conn_frame.columnconfigure(1, weight=1)

        controls = ttk.Frame(root)
        controls.pack(fill=tk.X, pady=(0, 8))
        ttk.Button(controls, text="Save Config", command=self._on_save_config).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(controls, text="Refresh Schema", command=self._on_refresh_schema).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(controls, text="Preview Pending SQL", command=self._on_preview_pending).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(controls, text="Apply Pending", command=self._on_apply_pending).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(controls, text="Dry-Run Pending", command=self._on_dry_run_pending).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(controls, text="Rollback Last", command=self._on_rollback_last).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(controls, text="Dry-Run Rollback", command=self._on_dry_run_rollback).pack(side=tk.LEFT)

        split = ttk.Panedwindow(root, orient=tk.HORIZONTAL)
        split.pack(fill=tk.BOTH, expand=True)

        left = ttk.Frame(split, padding=(0, 0, 6, 0))
        right = ttk.Frame(split, padding=(6, 0, 0, 0))
        split.add(left, weight=1)
        split.add(right, weight=3)

        table_frame = ttk.LabelFrame(left, text="Tables")
        table_frame.pack(fill=tk.BOTH, expand=True)
        self.tables_listbox = tk.Listbox(table_frame, exportselection=False)
        self.tables_listbox.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.tables_listbox.bind("<<ListboxSelect>>", self._on_table_selected)

        notebook = ttk.Notebook(right)
        notebook.pack(fill=tk.BOTH, expand=True)

        schema_tab = ttk.Frame(notebook)
        preview_tab = ttk.Frame(notebook)
        sql_tab = ttk.Frame(notebook)
        logs_tab = ttk.Frame(notebook)
        notebook.add(schema_tab, text="Schema Details")
        notebook.add(preview_tab, text="Migration Preview")
        notebook.add(sql_tab, text="Custom SQL")
        notebook.add(logs_tab, text="Logs")

        self.schema_text = tk.Text(schema_tab, wrap=tk.NONE, height=18)
        self.schema_text.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)

        self.preview_text = tk.Text(preview_tab, wrap=tk.NONE, height=18)
        self.preview_text.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)

        sql_controls = ttk.Frame(sql_tab)
        sql_controls.pack(fill=tk.X, padx=6, pady=(6, 0))
        ttk.Button(sql_controls, text="Execute SQL", command=self._on_execute_sql).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(sql_controls, text="Dry-Run SQL", command=self._on_dry_run_sql).pack(side=tk.LEFT)

        self.sql_text = tk.Text(sql_tab, wrap=tk.NONE, height=18)
        self.sql_text.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.sql_text.insert(
            "1.0",
            "-- Example:\n"
            "-- ALTER TABLE session_tokens ADD COLUMN IF NOT EXISTS note TEXT;\n",
        )

        self.logs_text = tk.Text(logs_tab, wrap=tk.WORD, state=tk.DISABLED, height=18)
        self.logs_text.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)

        status_bar = ttk.Label(root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(fill=tk.X, pady=(8, 0))

    def _append_log(self, message: str) -> None:
        self.logs_text.configure(state=tk.NORMAL)
        self.logs_text.insert(tk.END, f"{message}\n")
        self.logs_text.see(tk.END)
        self.logs_text.configure(state=tk.DISABLED)
        self.status_var.set(message)

    def _validate_db_url(self) -> str:
        db_url = self.db_url_var.get().strip()
        if not db_url:
            raise ValueError("Database URL cannot be empty.")
        return db_url

    def _migrations_dir(self) -> str:
        path = self.migrations_dir_var.get().strip()
        if not path:
            raise ValueError("Migrations directory cannot be empty.")
        return path

    def _with_connection(self, action):
        db_url = self._validate_db_url()
        conn = connect(db_url)
        try:
            return action(conn)
        finally:
            conn.close()

    def _on_save_config(self) -> None:
        try:
            cfg = AppConfig(
                db_url=self._validate_db_url(),
                migrations_dir=self._migrations_dir(),
            )
            save_config(cfg)
            self._append_log("Configuration saved.")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Save Config Failed", str(exc))
            self._append_log(f"Save config failed: {exc}")

    def _on_browse_migrations(self) -> None:
        selected = filedialog.askdirectory(initialdir=self.migrations_dir_var.get() or ".")
        if selected:
            self.migrations_dir_var.set(selected)
            self._append_log(f"Migrations directory set: {selected}")

    def _on_test_connection(self) -> None:
        try:
            version = ping(self._validate_db_url())
            self._append_log(f"Connection OK. Server: {version}")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Connection Failed", str(exc))
            self._append_log(f"Connection failed: {exc}")

    def _on_refresh_schema(self) -> None:
        try:
            tables = self._with_connection(list_tables)
            self._table_refs = tables
            self.tables_listbox.delete(0, tk.END)
            for table in tables:
                self.tables_listbox.insert(tk.END, table.label)
            self._append_log(f"Schema refreshed. Tables found: {len(tables)}")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Refresh Schema Failed", str(exc))
            self._append_log(f"Refresh schema failed: {exc}")

    def _on_table_selected(self, _event=None) -> None:
        selection = self.tables_listbox.curselection()
        if not selection:
            return
        index = int(selection[0])
        table = self._table_refs[index]
        try:
            columns = self._with_connection(lambda conn: list_columns(conn, table))
            self._render_columns(table.label, columns)
            self._append_log(f"Loaded columns for {table.label}")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Load Columns Failed", str(exc))
            self._append_log(f"Load columns failed: {exc}")

    def _render_columns(self, table_label: str, columns: list[ColumnInfo]) -> None:
        self.schema_text.delete("1.0", tk.END)
        self.schema_text.insert(tk.END, f"Table: {table_label}\n")
        self.schema_text.insert(tk.END, "-" * 72 + "\n")
        if not columns:
            self.schema_text.insert(tk.END, "No columns found.\n")
            return
        for col in columns:
            nullable = "NULL" if col.is_nullable else "NOT NULL"
            default = col.default_value if col.default_value is not None else "-"
            line = f"{col.name:<30} {col.data_type:<20} {nullable:<10} default={default}\n"
            self.schema_text.insert(tk.END, line)

    def _load_migrations(self):
        migrations_dir = self._migrations_dir()
        if not Path(migrations_dir).exists():
            raise ValueError(f"Migrations directory does not exist: {migrations_dir}")
        migrations = discover_migrations(migrations_dir)
        if not migrations:
            raise ValueError(f"No .sql migration files found in: {migrations_dir}")
        return migrations

    def _on_preview_pending(self) -> None:
        try:
            migrations = self._load_migrations()
            preview = self._with_connection(lambda conn: preview_pending_sql(conn, migrations))
            self.preview_text.delete("1.0", tk.END)
            self.preview_text.insert(tk.END, preview)
            self._append_log(f"Pending migration preview loaded ({len(migrations)} migrations discovered).")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Preview Failed", str(exc))
            self._append_log(f"Preview failed: {exc}")

    def _run_apply_pending(self, dry_run: bool) -> None:
        migrations = self._load_migrations()
        names = self._with_connection(lambda conn: apply_pending(conn, migrations, dry_run=dry_run))
        if dry_run:
            self._append_log(
                f"Dry-run pending complete. Would apply: {len(names)} migration(s): {', '.join(names) if names else '(none)'}"
            )
        else:
            self._append_log(
                f"Applied pending migrations: {len(names)} migration(s): {', '.join(names) if names else '(none)'}"
            )

    def _on_apply_pending(self) -> None:
        if not messagebox.askyesno("Apply Pending Migrations", "Apply all pending migrations to the connected database?"):
            return
        try:
            self._run_apply_pending(dry_run=False)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Apply Pending Failed", str(exc))
            self._append_log(f"Apply pending failed: {exc}")

    def _on_dry_run_pending(self) -> None:
        try:
            self._run_apply_pending(dry_run=True)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Dry-Run Pending Failed", str(exc))
            self._append_log(f"Dry-run pending failed: {exc}")

    def _run_rollback_last(self, dry_run: bool) -> None:
        migrations = self._load_migrations()
        name = self._with_connection(lambda conn: rollback_last(conn, migrations, dry_run=dry_run))
        if dry_run:
            self._append_log(f"Dry-run rollback complete. Would rollback: {name}")
        else:
            self._append_log(f"Rolled back migration: {name}")

    def _on_rollback_last(self) -> None:
        if not messagebox.askyesno(
            "Rollback Last Migration",
            "Rollback the latest applied migration?\nRequires a matching *.down.sql file.",
        ):
            return
        try:
            self._run_rollback_last(dry_run=False)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Rollback Failed", str(exc))
            self._append_log(f"Rollback failed: {exc}")

    def _on_dry_run_rollback(self) -> None:
        try:
            self._run_rollback_last(dry_run=True)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Dry-Run Rollback Failed", str(exc))
            self._append_log(f"Dry-run rollback failed: {exc}")

    def _run_custom_sql(self, dry_run: bool) -> None:
        sql = self.sql_text.get("1.0", tk.END).strip()
        if not sql:
            raise ValueError("Custom SQL is empty.")
        self._with_connection(lambda conn: execute_script(conn, sql, dry_run=dry_run))
        if dry_run:
            self._append_log("Custom SQL dry-run succeeded (transaction rolled back).")
        else:
            self._append_log("Custom SQL executed and committed.")

    def _on_execute_sql(self) -> None:
        if not messagebox.askyesno("Execute SQL", "Execute custom SQL and COMMIT changes?"):
            return
        try:
            self._run_custom_sql(dry_run=False)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Execute SQL Failed", str(exc))
            self._append_log(f"Execute SQL failed: {exc}")

    def _on_dry_run_sql(self) -> None:
        try:
            self._run_custom_sql(dry_run=True)
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Dry-Run SQL Failed", str(exc))
            self._append_log(f"Dry-run SQL failed: {exc}")


def run() -> None:
    app = SchemaAdminApp()
    app.mainloop()
