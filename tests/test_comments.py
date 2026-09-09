"""YAML comments are whitespace: they do not become RDF triples."""

from __future__ import annotations

import re

from jeeves.paths import EXAMPLES
from jeeves.sparqld import load_errors, triples

COMMENT_WORDS = ("tidally", "rocky", "Earth", "Mercury", "flares")
NODE_KEY = re.compile(r"^\s*(\$\w+|name)\s*:")


def _source_lines() -> list[str]:
    return (EXAMPLES / "comments.yamlld").read_text(encoding="utf-8").splitlines()


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def test_comments_are_whole_lines_preceding_nodes():
    lines = _source_lines()
    comment_lines = [line for line in lines if "#" in line]
    assert comment_lines
    for line in comment_lines:
        assert re.match(r"^\s*#", line), line
    for previous, current in zip(lines, lines[1:]):
        if not re.match(r"^\s*#", current) or not NODE_KEY.match(previous):
            continue
        if _indent(current) >= _indent(previous):
            raise AssertionError(
                f"comment follows a node key instead of preceding the node:\n"
                f"{previous}\n{current}"
            )


def test_comments_source_focuses_on_proxima_planets():
    source = (EXAMPLES / "comments.yamlld").read_text(encoding="utf-8")
    assert "schema:name:" not in source
    assert "name: schema:name" in source
    assert "Proxima Centauri b" in source
    assert "Proxima Centauri d" in source
    assert "Alpha_Centauri_AB" not in source
    assert "Alpha Centauri A" not in source
    for word in COMMENT_WORDS:
        assert word in source, word


def test_comment_text_is_not_in_the_rdf_graph(sparqld_endpoint):
    actual = triples(sparqld_endpoint, "comments.yamlld")
    assert actual
    blob = "\n".join(
        f"{subject} {predicate} {obj}" for subject, predicate, obj in actual
    )
    assert "Proxima_Centauri" in blob
    assert "Proxima_Centauri_b" in blob
    assert "Proxima_Centauri_d" in blob
    assert "Alpha_Centauri_AB" not in blob
    lowered = blob.lower()
    for word in COMMENT_WORDS:
        assert word.lower() not in lowered, word


def test_comments_yamlld_loads_without_sparqld_errors(sparqld_endpoint):
    errors = [
        (resource, message)
        for resource, message in load_errors(sparqld_endpoint)
        if "comments.yamlld" in resource
    ]
    assert errors == [], errors
