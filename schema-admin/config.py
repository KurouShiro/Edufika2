from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AppConfig:
    db_url: str
    migrations_dir: str


def _default_migrations_dir() -> str:
    base = Path(__file__).resolve().parent
    default_path = (base.parent / "edufika-session-api" / "src" / "db" / "migrations").resolve()
    return str(default_path)


def default_config() -> AppConfig:
    return AppConfig(
        db_url="postgres://postgres:postgres@localhost:5432/edufika",
        migrations_dir=_default_migrations_dir(),
    )


def _config_path() -> Path:
    return Path(__file__).resolve().parent / ".schema_admin.json"


def load_config() -> AppConfig:
    path = _config_path()
    if not path.exists():
        return default_config()

    try:
        node = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default_config()

    fallback = default_config()
    return AppConfig(
        db_url=str(node.get("db_url") or fallback.db_url),
        migrations_dir=str(node.get("migrations_dir") or fallback.migrations_dir),
    )


def save_config(cfg: AppConfig) -> None:
    payload = {
        "db_url": cfg.db_url,
        "migrations_dir": cfg.migrations_dir,
    }
    _config_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")
