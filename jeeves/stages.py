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


def _norway_document(source: Path, version: tuple[int, int]) -> dict[object, object]:
    """Load the Norway source with one explicit YAML version."""
    yaml = YAML(typ="safe")
    yaml.version = version
    document = yaml.load(source.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise TypeError("Norway YAML-LD source must be an object")
    return document


def norway_jsonld(source: Path) -> str:
    """Return the YAML 1.2 JSON-LD equivalent of the Norway source."""
    document = _norway_document(source, (1, 2))
    if document.get("country") != "NO":
        raise ValueError("Norway YAML-LD source must preserve country as the string NO")
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def write_norway_jsonld(source: Path, destination: Path) -> Path:
    """Materialize the JSON-LD counterpart shown beside the Norway source."""
    destination.write_text(norway_jsonld(source), encoding="utf-8")
    return destination


def norway_yaml_11_jsonld(source: Path) -> str:
    """Return the legacy YAML 1.1 interpretation used to illustrate the problem."""
    document = _norway_document(source, (1, 1))
    if document.get("country") is not False:
        raise ValueError("YAML 1.1 must resolve NO as false in the Norway example")
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def write_norway_yaml_11_jsonld(source: Path, destination: Path) -> Path:
    """Materialize the deliberately incorrect YAML 1.1 interpretation."""
    destination.write_text(norway_yaml_11_jsonld(source), encoding="utf-8")
    return destination
