"""Regenerate slide assets from the example stages."""

from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from .graph import graph_from_sparqld
from .highlight import highlight_stages, pygments_css
from .metrics import measure_stages, with_savings, write_metrics_jsonld
from .paths import (
    EXAMPLES,
    FRAGMENTS,
    GENERATED,
    METRICS_DIRECTORY,
    METRICS_FILE,
    NORWAY_JSONLD,
    NORWAY_SOURCE,
    NORWAY_YAML_11_JSONLD,
    QR_CODES,
    SLIDES,
    STAGE_FILES,
    graph_iri,
)
from .sparqld import assert_stages_equivalent, metrics_from_sparqld, serve
from .qr import write_qr_codes
from .stages import write_norway_jsonld, write_norway_yaml_11_jsonld


def render_template(template_path: Path, output_path: Path, **payload) -> None:
    env = Environment(
        loader=FileSystemLoader(template_path.parent),
        autoescape=select_autoescape(["html", "xml"]),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )
    html = env.get_template(template_path.name).render(**payload)
    output_path.write_text(html, encoding="utf-8")


def render() -> None:
    GENERATED.mkdir(exist_ok=True)
    FRAGMENTS.mkdir(parents=True, exist_ok=True)
    METRICS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    write_norway_jsonld(NORWAY_SOURCE, NORWAY_JSONLD)
    write_norway_yaml_11_jsonld(NORWAY_SOURCE, NORWAY_YAML_11_JSONLD)
    write_qr_codes(QR_CODES)

    with serve(EXAMPLES) as endpoint:
        assert_stages_equivalent(endpoint)
        graph = graph_from_sparqld(endpoint, graph_iri(STAGE_FILES[0]))

    calculated_metrics = with_savings(measure_stages(EXAMPLES))
    write_metrics_jsonld(METRICS_FILE, calculated_metrics)
    with serve(METRICS_DIRECTORY, materialize_plain_yamlld=False) as endpoint:
        metrics = metrics_from_sparqld(endpoint)
    if metrics != calculated_metrics:
        raise RuntimeError("SPARQL metrics do not match the generated JSON-LD dataset")
    fragments = highlight_stages(EXAMPLES)

    (GENERATED / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (GENERATED / "metrics.json").unlink(missing_ok=True)
    for name, html in fragments.items():
        (FRAGMENTS / f"{name}.html").write_text(html, encoding="utf-8")
    (GENERATED / "pygments.css").write_text(pygments_css(), encoding="utf-8")

    template = SLIDES / "index.template.html"
    if template.exists():
        render_template(
            template,
            SLIDES / "index.html",
            fragments=fragments,
            metrics=metrics,
            graph=graph,
            pygments_css=pygments_css(),
        )
