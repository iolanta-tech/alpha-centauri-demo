"""`j render` writes generated assets from sparqld-backed RDF and JSON-LD."""

import json

from jeeves.paths import (
    FRAGMENTS,
    GENERATED,
    METRICS_FILE,
    NORWAY_JSONLD,
    NORWAY_YAML_11_JSONLD,
    QR_CODES,
    SLIDES,
    STAGE_FILES,
)
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
    title_slide = deck[deck.index('id="title"'):deck.index('id="graph-slide"')]
    assert "Dataworthy" in title_slide
    assert "11 Sep 2026" in title_slide
    assert "Anatoly Scherbakov" in title_slide
    demo = (SLIDES / "demo" / "staged-demo.js").read_text(encoding="utf-8")
    assert "proxima-b-texture.png" in demo
    assert "proxima-d-texture.png" in demo
    assert "OrbitControls" in demo
    assert "createTerrain" not in demo
    assert "surfacePointerMove" not in demo
    assert "CSS2DRenderer" in demo
    assert (SLIDES / "vendor" / "CSS2DRenderer.js").exists()
    assert 'id="graph"' in deck
    assert "graph-svg" not in deck
    assert "JSON ⊊ YAML" in deck
    assert 'class="shout"><span class="subset-expression"><img class="technology-logo subset-logo"' in deck
    assert 'src="images/logos/json.svg"' in deck
    assert 'src="images/logos/yaml.svg"' in deck
    implementations_start = deck.index('id="implementations"')
    implementations_slide = deck[implementations_start:deck.index('id="memoriam"')]
    assert implementations_slide.index("Sophia /") < implementations_slide.index("json-ld.org Playground")
    assert implementations_slide.index("json-ld.org Playground") < implementations_slide.index("sparqld")
    assert implementations_slide.index("sparqld") < implementations_slide.index("PyLD")
    assert implementations_slide.count("Supported") == 2
    assert "Export only" in implementations_slide
    assert "In progress" in implementations_slide
    questions_start = deck.index('id="questions"')
    questions_slide = deck[questions_start:]
    assert "https://www.w3.org/groups/wg/json-ld/" in questions_slide
    assert "https://github.com/w3c/yaml-ld" in questions_slide
    for filename in ("json-ld-working-group.svg", "yaml-ld-repository.svg"):
        asset = QR_CODES / filename
        assert asset.exists()
        assert "<svg" in asset.read_text(encoding="utf-8")
    assert "json-only-punctuation" in deck
    assert "dollar-convenience" in deck
    jsonld_start = deck.index('id="jsonld"')
    subset_start = deck.index('id="json-subset"')
    marked_start = deck.index('id="jsonld-marked"')
    yaml_start = deck.index('id="yaml-plain"')
    assert jsonld_start < subset_start < marked_start < yaml_start
    assert "json-only-punctuation" not in deck[jsonld_start:subset_start]
    assert "json-only-punctuation" in deck[marked_start:yaml_start]
    marked_slide = deck[marked_start:yaml_start]
    assert 'class="nt"><span class="json-only-quote">"</span>name' in marked_slide
    assert 'class="s2"><span class="json-only-quote">"</span>Alpha Centauri' in marked_slide
    assert '<span class="nt">"@context"</span>' in marked_slide
    assert '<span class="nt">"@id"</span>' in marked_slide
    dollar_start = deck.index('id="dollar"')
    comments_start = deck.index('id="yaml-comments"')
    norway_problem_start = deck.index('id="norway-problem"')
    norway_11_start = deck.index('id="norway-11"')
    norway_start = deck.index('id="norway"')
    yaml_12_required_start = deck.index('id="yaml-12-required"')
    specification_start = deck.index('id="yaml-ld-specification"')
    mapping_keys_start = deck.index('id="mapping-keys"')
    markdown_start = deck.index('id="markdown"')
    markdown_ld_start = deck.index('id="markdown-ld"')
    memoriam_start = deck.index('id="memoriam"')
    bonus_start = deck.index('id="bonus"')
    assert "id=\"unicode\"" not in deck
    assert "Unicode shenanigans" not in deck
    assert "04-unicode.yamlld" not in deck
    assert (
        yaml_start
        < dollar_start
        < comments_start
        < norway_problem_start
        < norway_11_start
        < yaml_12_required_start
        < norway_start
        < mapping_keys_start
        < specification_start
        < implementations_start
        < memoriam_start
        < bonus_start
        < markdown_start
        < markdown_ld_start
        < questions_start
    )
    norway_problem_slide = deck[norway_problem_start:norway_11_start]
    norway_11_slide = deck[norway_11_start:yaml_12_required_start]
    yaml_12_slide = deck[yaml_12_required_start:norway_start]
    norway_slide = deck[norway_start:mapping_keys_start]
    mapping_slide = deck[mapping_keys_start:specification_start]
    specification_slide = deck[specification_start:implementations_start]
    bonus_slide = deck[bonus_start:markdown_start]
    markdown_slide = deck[markdown_start:markdown_ld_start]
    markdown_ld_slide = deck[markdown_ld_start:questions_start]
    comments_slide = deck[comments_start:norway_problem_start]
    assert 'class="shout">The Norway problem</h2>' in norway_problem_slide
    assert 'class="norway-problem-stack"' in norway_problem_slide
    assert 'class="norway-flag"' in norway_problem_slide
    assert "place bottom left" not in norway_problem_slide
    assert "YAML 1.1 would read" not in norway_problem_slide
    assert "YAML-LD source" not in norway_11_slide
    assert "YAML 1.1 would read" not in norway_11_slide
    assert 'class="rubber-stamp place">YAML 1.1</p>' in norway_11_slide
    assert '"country"</span><span class="p">:</span><span class="w"> </span><span class="kc">false' in norway_11_slide
    assert "YAML 1.2 + JSON-LD" not in norway_slide
    assert 'class="rubber-stamp rubber-stamp-ok place">YAML 1.2+</p>' in norway_slide
    assert '"country"</span><span class="p">:</span><span class="w"> </span><span class="s2">"NO"' in norway_slide
    assert 'class="norway-flag' not in norway_slide
    assert 'class="shout">YAML-LD requires YAML 1.2+</h2>' in yaml_12_slide
    assert "YAML-LD 1.0" in specification_slide
    assert "YAML 1.2+" not in specification_slide
    assert "JSON-LD’s data and processing model" in specification_slide
    assert deck.count('class="columns two norway-pair"') == 2
    assert 'class="columns four implementation-grid"' in implementations_slide
    assert 'class="columns two questions-links"' in questions_slide
    assert deck.count('class="code-info place bottom right"') == 8
    assert "Comments are whitespace" not in deck
    assert ">Comments</h2>" in comments_slide
    comments_fragment = FRAGMENTS / "comments.yamlld.html"
    assert comments_fragment.exists()
    assert 'class="c1"' in comments_fragment.read_text(encoding="utf-8")
    assert "country</span><span class=\"p\">:</span><span class=\"w\"> </span><span class=\"l l-Scalar l-Scalar-Plain\">NO" in norway_11_slide
    assert '"country"</span><span class="p">:</span><span class="w"> </span><span class="s2">"NO"' in norway_slide
    assert json.loads(NORWAY_JSONLD.read_text(encoding="utf-8"))["country"] == "NO"
    assert json.loads(NORWAY_YAML_11_JSONLD.read_text(encoding="utf-8"))["country"] is False
    for name in ("norway.yamlld", "norway-yaml-1.1.jsonld", "norway.jsonld"):
        assert (FRAGMENTS / f"{name}.html").exists()
    assert "mapping-key-error" in mapping_slide
    assert "Guillem_Anglada-Escudé" in mapping_slide
    assert 'class="slide code-slide" id="markdown"' in deck
    assert 'class="code-title">Markdown ' in markdown_slide
    assert "Proxima Centauri" in markdown_slide
    assert "$id" not in markdown_slide
    assert "markdown-example" not in markdown_slide
    assert 'class="shout">Bonus</h2>' in bonus_slide
    assert 'class="slide code-slide" id="markdown-ld"' in deck
    assert 'class="code-title">Markdown-LD ' in markdown_ld_slide
    assert "$id" in markdown_ld_slide
    assert "markdown-example" not in markdown_ld_slide
    assert '<p class="lede">YAML-LD front matter carries the graph' not in markdown_ld_slide
    for name in ("proxima.md", "markdown-ld.md"):
        assert (FRAGMENTS / f"{name}.html").exists(), name
    dollar_slide = deck[dollar_start:comments_start]
    assert '<span class="sigil-at">@</span> needs to stay quoted, <span class="sigil-dollar">$</span> does not' in dollar_slide
    assert dollar_slide.count("dollar-convenience") >= 2
    invalid_fragment = FRAGMENTS / "invalid-mapping-key.yamlld.html"
    assert invalid_fragment.exists()
    assert 'class="mapping-key"' in invalid_fragment.read_text(encoding="utf-8")
    for name in STAGE_FILES:
        fragment = FRAGMENTS / f"{name}.html"
        assert fragment.exists(), name
        html = fragment.read_text(encoding="utf-8")
        assert html.startswith("<pre><code>"), name
        assert "</code></pre>" in html
