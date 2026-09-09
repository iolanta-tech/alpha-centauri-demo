"""Tests for the presentation-specific JSON-to-YAML punctuation cues."""

from jeeves.highlight import _is_yaml_plain_scalar, _mark_json_only_punctuation


def test_yaml_plain_scalar_eligibility_preserves_json_string_semantics():
    assert _is_yaml_plain_scalar("Alpha Centauri", "Alpha Centauri", is_key=False)
    assert _is_yaml_plain_scalar("schema:name", "schema:name", is_key=True)

    for raw, value in (
        ("@context", "@context"),
        ("true", "true"),
        ("null", "null"),
        ("2026-09-09", "2026-09-09"),
        ("#comment", "#comment"),
        ("", ""),
        ("value: with colon", "value: with colon"),
        (r'has \"quotes\"', 'has "quotes"'),
    ):
        assert not _is_yaml_plain_scalar(raw, value, is_key=False)


def test_marker_wraps_only_removable_quote_glyphs():
    markup = (
        '<span class="nt">"name"</span><span class="p">:</span> '
        '<span class="s2">"Alpha Centauri"</span>\\n'
        '<span class="nt">"@context"</span><span class="p">:</span> '
        '<span class="s2">"true"</span>'
    )

    marked = _mark_json_only_punctuation(markup)

    assert marked.count('class="json-only-quote"') == 4
    assert '<span class="nt">"@context"</span>' in marked
    assert '<span class="s2">"true"</span>' in marked
    assert '<span class="p json-only-punctuation">:</span>' not in marked
