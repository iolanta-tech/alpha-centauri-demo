"""Static Pygments highlighting inside Shower ``<pre><code>`` blocks."""

from __future__ import annotations

from pathlib import Path

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexer import Lexer
from pygments.lexers import JsonLexer, MarkdownLexer, YamlLexer

from .paths import STAGE_FILES

FORMATTER = HtmlFormatter(nowrap=True, linenos=False)


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
) -> str:
    source = path.read_text(encoding="utf-8")
    inner = highlight(source, lexer_for(path), FORMATTER).rstrip("\n")
    if mark_json_punctuation:
        inner = _mark_json_only_punctuation(inner)
    if mark_dollar_convenience:
        inner = _mark_dollar_convenience(inner)
    return f"<pre><code>{inner}\n</code></pre>\n"


def _mark_json_only_punctuation(markup: str) -> str:
    """Mark JSON delimiters that disappear in the plain YAML-LD rendering."""
    for character in ("{", "}", "[", "]", ","):
        markup = markup.replace(
            f'<span class="p">{character}</span>',
            f'<span class="p json-only-punctuation">{character}</span>',
        )
    return markup


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


def highlight_stages(examples: Path) -> dict[str, str]:
    names = [*STAGE_FILES, "markdown-ld.md"]
    fragments = {name: highlight_file(examples / name) for name in names}
    fragments["01-canonical-marked.jsonld"] = highlight_file(
        examples / "01-canonical.jsonld",
        mark_json_punctuation=True,
    )
    fragments["03-dollar.yamlld"] = highlight_file(
        examples / "03-dollar.yamlld",
        mark_dollar_convenience=True,
    )
    return fragments


def pygments_css() -> str:
    return FORMATTER.get_style_defs(".slide pre code")
