"""Anchors and aliases resolve before YAML-LD term definitions are processed."""

from __future__ import annotations

from ruamel.yaml import YAML

from jeeves.highlight import highlight_stages
from jeeves.paths import EXAMPLES


def test_context_anchors_resolve_to_explicit_iri_term_definitions():
    document = YAML(typ="safe").load(
        (EXAMPLES / "context-anchors.yamlld").read_text(encoding="utf-8"),
    )

    context = document["@context"]
    actual = {
        term: context[term]
        for term in ("dbp:star", "dbp:discoveryMethod", "dbp:discoverySite")
    }
    expected = {
        "dbp:star": {"@type": "@id"},
        "dbp:discoveryMethod": {"@type": "@id"},
        "dbp:discoverySite": {"@type": "@id"},
    }

    assert actual == expected


def test_context_anchor_comments_explain_yaml_reuse():
    source = (EXAMPLES / "context-anchors.yamlld").read_text(encoding="utf-8")

    assert "# &iri labels this complete term definition" in source
    assert "# *iri reuses it for the other IRI-valued terms" in source


def test_context_anchor_fragment_marks_the_anchor_and_aliases():
    fragment = highlight_stages(EXAMPLES)["context-anchors.yamlld"]

    assert '<span class="nl anchor-alias">&amp;iri</span>' in fragment
    assert fragment.count('<span class="nv anchor-alias">*iri</span>') == 2
    assert fragment.count('class="c1"') == 2
