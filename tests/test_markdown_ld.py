"""Markdown-LD is Comments' graph as front matter plus the same notes as prose."""

from __future__ import annotations

import re

from ruamel.yaml import YAML

from jeeves.highlight import highlight_file, highlight_markdown_with_front_matter
from jeeves.paths import EXAMPLES, SLIDES
from jeeves.sparqld import triples

PROXIMA_MD = SLIDES / "sources" / "proxima.md"
MARKDOWN_LD = EXAMPLES / "markdown-ld.md"
COMMENTS = EXAMPLES / "comments.yamlld"
PLANET_NOTE_WORDS = ("tidally", "rocky", "Earth", "Mercury", "flares", "habitable")
FRONT_MATTER = re.compile(r"\A---\n(?P<yaml>.*?)\n---\n(?P<body>.*)\Z", re.DOTALL)


def _yaml_without_hash_comments(text: str) -> object:
    kept = [line for line in text.splitlines() if not re.match(r"^\s*#", line)]
    return YAML(typ="safe").load("\n".join(kept) + "\n")


def test_proxima_markdown_is_prose_without_yaml_ld():
    source = PROXIMA_MD.read_text(encoding="utf-8")
    assert "---" not in source
    assert "$id" not in source
    assert source.startswith("# Proxima Centauri\n")
    assert "## Proxima Centauri b\n" in source
    assert "## Proxima Centauri d\n" in source
    for word in PLANET_NOTE_WORDS:
        assert word in source, word


def test_markdown_ld_front_matter_is_comments_graph_without_hash_comments():
    match = FRONT_MATTER.match(MARKDOWN_LD.read_text(encoding="utf-8"))
    assert match is not None
    body = match.group("body").lstrip("\n")
    assert body == PROXIMA_MD.read_text(encoding="utf-8")
    assert _yaml_without_hash_comments(match.group("yaml")) == _yaml_without_hash_comments(
        COMMENTS.read_text(encoding="utf-8")
    )
    assert not re.search(r"^\s*#", match.group("yaml"), re.MULTILINE)


def test_markdown_ld_highlight_uses_yaml_then_markdown():
    html = highlight_markdown_with_front_matter(MARKDOWN_LD)
    assert 'class="nt">$id</span>' in html or "l-Scalar" in html
    assert "Proxima_Centauri" in html
    prose = highlight_file(PROXIMA_MD)
    assert 'class="gh"' in prose or 'class="gu"' in prose
    assert "$id" not in prose


def test_markdown_ld_highlight_marks_front_matter_separators():
    html = highlight_markdown_with_front_matter(MARKDOWN_LD)
    fence = '<span class="front-matter-separator">---</span>'
    assert html.count(fence) == 2
    assert html.startswith(f"<pre><code>{fence}\n")
    assert f"\n{fence}\n\n" in html


def test_markdown_body_words_are_not_in_the_markdown_ld_graph(sparqld_endpoint):
    actual = triples(sparqld_endpoint, "markdown-ld.md")
    assert actual
    blob = "\n".join(
        f"{subject} {predicate} {obj}" for subject, predicate, obj in actual
    )
    assert "Proxima_Centauri" in blob
    lowered = blob.lower()
    for word in PLANET_NOTE_WORDS:
        assert word.lower() not in lowered, word
