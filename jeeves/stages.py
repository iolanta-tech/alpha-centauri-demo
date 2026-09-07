"""Derive YAML-LD stages from the canonical JSON-LD document."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import DoubleQuotedScalarString

from .paths import STAGE_FILES


def _quote_at(value: object) -> object:
    if isinstance(value, dict):
        return {
            DoubleQuotedScalarString(key) if key.startswith("@") else key: _quote_at(
                item
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_quote_at(item) for item in value]
    if isinstance(value, str) and value.startswith("@"):
        return DoubleQuotedScalarString(value)
    return value


def _yaml() -> YAML:
    yaml = YAML()
    yaml.default_flow_style = False
    yaml.width = 1000
    yaml.indent(mapping=2, sequence=4, offset=2)
    return yaml


def plain_yamlld(document: dict[str, object]) -> str:
    buffer = StringIO()
    _yaml().dump(_quote_at(document), buffer)
    return buffer.getvalue()


def write_plain_yamlld(directory: Path) -> Path:
    loaded = json.loads((directory / STAGE_FILES[0]).read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise TypeError("canonical JSON-LD must be an object")
    dest = directory / STAGE_FILES[1]
    dest.write_text(plain_yamlld(loaded), encoding="utf-8")
    return dest
