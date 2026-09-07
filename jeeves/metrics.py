"""Source-character metrics for semantically equivalent stages."""

from __future__ import annotations

import json
from pathlib import Path

from .paths import STAGE_FILES

METRICS_DATASET = "urn:alpha-centauri-demo:metrics"
METRICS_VOCABULARY = "urn:alpha-centauri-demo:metric:"


def measure_file(path: Path) -> dict[str, int]:
    text = path.read_text(encoding="utf-8")
    encoded = text.encode("utf-8")
    return {"characters": len(text), "utf8_bytes": len(encoded)}


def measure_stages(examples: Path) -> dict[str, dict[str, int]]:
    return {name: measure_file(examples / name) for name in STAGE_FILES}


def with_savings(
    metrics: dict[str, dict[str, int]],
) -> dict[str, dict[str, float | int | None]]:
    baseline = metrics["01-canonical.jsonld"]["characters"]
    baseline_bytes = metrics["01-canonical.jsonld"]["utf8_bytes"]
    rows: dict[str, dict[str, float | int | None]] = {}
    previous_bytes: int | None = None
    for name, row in metrics.items():
        characters = row["characters"]
        utf8_bytes = row["utf8_bytes"]
        saved = baseline - characters
        saved_bytes = baseline_bytes - utf8_bytes
        percent = (saved / baseline) * 100 if baseline else 0
        byte_percent = (saved_bytes / baseline_bytes) * 100 if baseline_bytes else 0
        previous_byte_delta = (
            utf8_bytes - previous_bytes if previous_bytes is not None else None
        )
        rows[name] = {
            **row,
            "saved_characters": saved,
            "saved_percent": round(percent, 1),
            "saved_bytes": saved_bytes,
            "saved_byte_percent": round(byte_percent, 1),
            "previous_byte_delta": previous_byte_delta,
        }
        previous_bytes = utf8_bytes
    return rows


def metrics_jsonld(
    metrics: dict[str, dict[str, float | int | None]],
) -> dict[str, object]:
    """Represent the generated measurements as a JSON-LD dataset."""
    stages: list[dict[str, object]] = []
    for position, filename in enumerate(STAGE_FILES, start=1):
        row = metrics[filename]
        stage: dict[str, object] = {
            "@id": f"urn:alpha-centauri-demo:metric-stage:{filename}",
            "sourceFile": filename,
            "position": position,
            "characters": row["characters"],
            "utf8Bytes": row["utf8_bytes"],
            "savedCharacters": row["saved_characters"],
            "savedPercent": row["saved_percent"],
            "savedBytes": row["saved_bytes"],
            "savedBytePercent": row["saved_byte_percent"],
        }
        if row["previous_byte_delta"] is not None:
            stage["previousByteDelta"] = row["previous_byte_delta"]
        stages.append(stage)
    return {
        "@context": {
            "schema": "https://schema.org/",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "metric": METRICS_VOCABULARY,
            "stage": {"@id": "metric:stage", "@type": "@id"},
            "sourceFile": "metric:sourceFile",
            "position": {"@id": "metric:position", "@type": "xsd:integer"},
            "characters": {"@id": "metric:characters", "@type": "xsd:integer"},
            "utf8Bytes": {"@id": "metric:utf8Bytes", "@type": "xsd:integer"},
            "savedCharacters": {
                "@id": "metric:savedCharacters",
                "@type": "xsd:integer",
            },
            "savedPercent": {"@id": "metric:savedPercent", "@type": "xsd:decimal"},
            "savedBytes": {"@id": "metric:savedBytes", "@type": "xsd:integer"},
            "savedBytePercent": {
                "@id": "metric:savedBytePercent",
                "@type": "xsd:decimal",
            },
            "previousByteDelta": {
                "@id": "metric:previousByteDelta",
                "@type": "xsd:integer",
            },
        },
        "@id": METRICS_DATASET,
        "@type": "schema:Dataset",
        "stage": stages,
    }


def write_metrics_jsonld(
    path: Path,
    metrics: dict[str, dict[str, float | int | None]],
) -> None:
    path.write_text(
        json.dumps(metrics_jsonld(metrics), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
