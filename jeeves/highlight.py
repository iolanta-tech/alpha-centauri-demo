"""Static Pygments highlighting inside Shower ``<pre><code>`` blocks."""

from __future__ import annotations

import json
from pathlib import Path
import re

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexer import Lexer
from pygments.lexers import JsonLexer, MarkdownLexer, YamlLexer
from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from .paths import (
    NORWAY_JSONLD,
    NORWAY_SOURCE,
    NORWAY_YAML_11_JSONLD,
    PROXIMA_MD,
    STAGE_FILES,
    TEST_FIXTURES,
)

FORMATTER = HtmlFormatter(nowrap=True, linenos=False)
FRONT_MATTER = re.compile(
    r"\A---\n(?P<yaml>.*?)\n---\n(?P<body>.*)\Z",
    re.DOTALL,
)
JSON_STRING_TOKEN = re.compile(
    r'(?P<opening><span class="(?P<kind>nt|s2)">)'
    r'(?P<literal>"(?:\\.|[^"\\])*")'
    r'(?P<closing></span>)'
)


def lexer_for(path: Path) -> Lexer:
    suffix = path.suffix
    if suffix == ".jsonld":
        return JsonLexer()
    if suffix == ".md":
        return MarkdownLexer()
    return YamlLexer()


def highlight_file(
    path: Path,
    *,
    mark_json_punctuation: bool = False,
    mark_dollar_convenience: bool = False,
    mark_mapping_key: bool = False,
) -> str:
    source = path.read_text(encoding="utf-8")
    inner = highlight(source, lexer_for(path), FORMATTER).rstrip("\n")
    if mark_json_punctuation:
        inner = _mark_json_only_punctuation(inner)
    if mark_dollar_convenience:
        inner = _mark_dollar_convenience(inner)
    if mark_mapping_key:
        inner = _mark_mapping_key(inner)
    return f"<pre><code>{inner}\n</code></pre>\n"


def highlight_markdown_with_front_matter(path: Path) -> str:
    """Highlight YAML-LD fences with YamlLexer and the Markdown body separately."""
    source = path.read_text(encoding="utf-8")
    match = FRONT_MATTER.match(source)
    if match is None:
        raise ValueError(f"{path} is not Markdown with YAML-LD front matter")
    yaml_html = highlight(
        match.group("yaml") + "\n",
        YamlLexer(),
        FORMATTER,
    ).rstrip("\n")
    body_html = highlight(
        match.group("body").lstrip("\n"),
        MarkdownLexer(),
        FORMATTER,
    ).rstrip("\n")
    fence = '<span class="front-matter-separator">---</span>'
    inner = f"{fence}\n{yaml_html}\n{fence}\n\n{body_html}"
    return f"<pre><code>{inner}\n</code></pre>\n"


def _mark_json_only_punctuation(markup: str) -> str:
    """Mark JSON delimiters and quotes that YAML 1.2 can omit."""
    for character in ("{", "}", "[", "]", ","):
        markup = markup.replace(
            f'<span class="p">{character}</span>',
            f'<span class="p json-only-punctuation">{character}</span>',
        )
    return JSON_STRING_TOKEN.sub(_mark_removable_json_quotes, markup)


def _mark_removable_json_quotes(match: re.Match[str]) -> str:
    literal = match.group("literal")
    value = json.loads(literal)
    is_key = match.group("kind") == "nt"
    if not _is_yaml_plain_scalar(literal[1:-1], value, is_key=is_key):
        return match.group(0)

    marked_literal = (
        '<span class="json-only-quote">"</span>'
        f"{literal[1:-1]}"
        '<span class="json-only-quote">"</span>'
    )
    return f'{match.group("opening")}{marked_literal}{match.group("closing")}'


def _is_yaml_plain_scalar(raw: str, expected: str, *, is_key: bool) -> bool:
    """Whether a JSON string can become a semantically identical YAML scalar."""
    if not raw or raw != raw.strip() or raw.startswith("@"):
        return False

    yaml = YAML(typ="safe")
    yaml.version = (1, 2)
    try:
        if is_key:
            parsed = yaml.load(f"{raw}: marker\n")
            return parsed == {expected: "marker"}
        parsed = yaml.load(f"value: {raw}\n")
    except YAMLError:
        return False
    return parsed == {"value": expected}


def _mark_dollar_convenience(markup: str) -> str:
    """Emphasize terms supplied by the imported dollar-convenience context."""
    replacements = (
        ('<span class="nt">$id</span>', '<span class="nt dollar-convenience">$id</span>'),
        ('<span class="nt">$type</span>', '<span class="nt dollar-convenience">$type</span>'),
        (
            '<span class="l l-Scalar l-Scalar-Plain">'
            'https://json-ld.org/contexts/dollar-convenience.jsonld</span>',
            '<span class="l l-Scalar l-Scalar-Plain dollar-convenience">'
            'https://json-ld.org/contexts/dollar-convenience.jsonld</span>',
        ),
    )
    for original, replacement in replacements:
        markup = markup.replace(original, replacement)
    return markup


def _mark_anchors_and_aliases(markup: str) -> str:
    """Emphasize the anchor and aliases used to reuse an IRI term definition."""
    replacements = (
        ('<span class="nl">&amp;iri</span>', '<span class="nl anchor-alias">&amp;iri</span>'),
        ('<span class="nv">*iri</span>', '<span class="nv anchor-alias">*iri</span>'),
    )
    for original, replacement in replacements:
        markup = markup.replace(original, replacement)
    return markup


def _mark_mapping_key(markup: str) -> str:
    """Mark the two-line complex YAML key in the negative teaching fixture."""
    lines = markup.splitlines()
    for index, line in enumerate(lines):
        if 'p-Indicator">?</span>' in line:
            lines[index] = f'<span class="mapping-key">{line}</span>'
            if index + 1 < len(lines):
                lines[index + 1] = f'<span class="mapping-key">{lines[index + 1]}</span>'
            break
    return "\n".join(lines)


def highlight_stages(examples: Path) -> dict[str, str]:
    names = [*STAGE_FILES, "comments.yamlld", "context-anchors.yamlld"]
    fragments = {name: highlight_file(examples / name) for name in names}
    fragments["proxima.md"] = highlight_file(PROXIMA_MD)
    fragments["markdown-ld.md"] = highlight_markdown_with_front_matter(
        examples / "markdown-ld.md"
    )
    fragments["01-canonical-marked.jsonld"] = highlight_file(
        examples / "01-canonical.jsonld",
        mark_json_punctuation=True,
    )
    fragments["03-dollar.yamlld"] = highlight_file(
        examples / "03-dollar.yamlld",
        mark_dollar_convenience=True,
    )
    fragments["context-anchors.yamlld"] = _mark_anchors_and_aliases(
        highlight_file(examples / "context-anchors.yamlld"),
    )
    fragments["invalid-mapping-key.yamlld"] = highlight_file(
        TEST_FIXTURES / "invalid-mapping-key.yamlld",
        mark_mapping_key=True,
    )
    fragments["norway.yamlld"] = highlight_file(NORWAY_SOURCE)
    fragments["norway.jsonld"] = highlight_file(NORWAY_JSONLD)
    fragments["norway-yaml-1.1.jsonld"] = highlight_file(NORWAY_YAML_11_JSONLD)
    return fragments


def pygments_css() -> str:
    return FORMATTER.get_style_defs(".slide pre code")
