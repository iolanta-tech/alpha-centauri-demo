"""`j render` writes generated assets from sparqld-backed RDF and JSON-LD."""

import json

from jeeves.paths import FRAGMENTS, GENERATED, METRICS_FILE, SLIDES, STAGE_FILES
from jeeves.render import render


def test_render_writes_metrics_graph_and_fragments():
    render()
    metrics = json.loads(METRICS_FILE.read_text(encoding="utf-8"))
    graph = (GENERATED / "graph.json").read_text(encoding="utf-8")
    deck = (SLIDES / "index.html").read_text(encoding="utf-8")
    assert metrics["@type"] == "schema:Dataset"
    assert metrics["stage"][0]["sourceFile"] == "01-canonical.jsonld"
    assert not (GENERATED / "metrics.json").exists()
    assert "Proxima Centauri" in graph
    assert 'type="importmap"' in deck
    assert 'type="module" src="talk.js"' in deck
    demo = (SLIDES / "demo" / "staged-demo.js").read_text(encoding="utf-8")
    assert "proxima-b-texture.png" in demo
    assert "proxima-d-texture.png" in demo
    assert "surfacePointerMove" in demo
    assert "CSS2DRenderer" in demo
    assert (SLIDES / "vendor" / "CSS2DRenderer.js").exists()
    assert 'id="graph"' in deck
    assert "graph-svg" not in deck
    assert "JSON ⊂ YAML" in deck
    assert "json-only-punctuation" in deck
    assert "dollar-convenience" in deck
    jsonld_start = deck.index('id="jsonld"')
    subset_start = deck.index('id="json-subset"')
    marked_start = deck.index('id="jsonld-marked"')
    yaml_start = deck.index('id="yaml-plain"')
    assert jsonld_start < subset_start < marked_start < yaml_start
    assert "json-only-punctuation" not in deck[jsonld_start:subset_start]
    assert "json-only-punctuation" in deck[marked_start:yaml_start]
    dollar_start = deck.index('id="dollar"')
    unicode_start = deck.index('id="unicode"')
    dollar_slide = deck[dollar_start:unicode_start]
    assert "@ needs to stay quoted, $ does not" in dollar_slide
    assert dollar_slide.count("dollar-convenience") >= 2
    for name in STAGE_FILES:
        fragment = FRAGMENTS / f"{name}.html"
        assert fragment.exists(), name
        html = fragment.read_text(encoding="utf-8")
        assert html.startswith("<pre><code>"), name
        assert "</code></pre>" in html
