"""Plain YAML-LD is generated from the canonical JSON-LD document."""

from __future__ import annotations

import json

from ruamel.yaml import YAML

from jeeves.paths import EXAMPLES, STAGE_FILES
from jeeves.stages import plain_yamlld, write_plain_yamlld


DOLLAR_CONVENIENCE_CONTEXT = "https://json-ld.org/contexts/dollar-convenience.jsonld"


def _load_yaml(text: str):
    return YAML(typ="safe").load(text)


COMPACT_CONTEXT_TERMS = (
    '"contains": { "@id": "schema:hasPart", "@type": "@id" },',
    '"is-orbited-by": { "@reverse": "dbp:star" }',
)


def test_canonical_context_term_definitions_are_one_line():
    source = (EXAMPLES / STAGE_FILES[0]).read_text(encoding="utf-8")
    for line in COMPACT_CONTEXT_TERMS:
        assert line in source
    assert "Centaurus" not in source
    assert "dbo:constellation" not in source
    assert '"contains": {\n    "@id": "dbr:Alpha_Centauri_AB"' in source
    assert '"contains": [\n    {\n      "@id": "dbr:Alpha_Centauri_AB"' not in source


def test_plain_yamlld_round_trips_canonical_jsonld():
    canonical = json.loads((EXAMPLES / STAGE_FILES[0]).read_text(encoding="utf-8"))
    dumped = plain_yamlld(canonical)
    assert _load_yaml(dumped) == canonical


def test_write_plain_yamlld_materializes_stage_from_jsonld(tmp_path):
    (tmp_path / STAGE_FILES[0]).write_text(
        (EXAMPLES / STAGE_FILES[0]).read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    dest = write_plain_yamlld(tmp_path)
    assert dest == tmp_path / STAGE_FILES[1]
    canonical = json.loads((tmp_path / STAGE_FILES[0]).read_text(encoding="utf-8"))
    assert _load_yaml(dest.read_text(encoding="utf-8")) == canonical


def test_dollar_stages_import_the_standard_convenience_context():
    for filename in (
        "03-dollar.yamlld",
        "04-unicode.yamlld",
    ):
        document = _load_yaml((EXAMPLES / filename).read_text(encoding="utf-8"))
        context = document["@context"]
        assert "@version" not in context
        assert context["@import"] == DOLLAR_CONVENIENCE_CONTEXT
