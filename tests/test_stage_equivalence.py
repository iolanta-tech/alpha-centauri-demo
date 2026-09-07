"""Every YAML-LD stage must expand to the same RDF as the canonical JSON-LD."""

from __future__ import annotations

from jeeves.paths import STAGE_FILES
from jeeves.sparqld import graphs_equivalent, load_errors, triples


def test_example_stages_load_without_sparqld_errors(sparqld_endpoint):
    errors = load_errors(sparqld_endpoint)
    assert errors == [], errors


def test_yamlld_stages_match_canonical_jsonld_triples(sparqld_endpoint):
    canonical = triples(sparqld_endpoint, STAGE_FILES[0])
    assert canonical, "canonical JSON-LD graph is empty"

    for filename in STAGE_FILES[1:]:
        actual = triples(sparqld_endpoint, filename)
        missing = canonical - actual
        extra = actual - canonical
        assert missing == set() and extra == set(), (
            f"{filename} is not RDF-equivalent to {STAGE_FILES[0]}\n"
            f"missing: {sorted(missing)}\n"
            f"extra: {sorted(extra)}"
        )


def test_graphs_are_equivalent_by_sparql_ask(sparqld_endpoint):
    canonical = STAGE_FILES[0]
    for filename in STAGE_FILES[1:]:
        assert graphs_equivalent(sparqld_endpoint, canonical, filename), (
            f"{filename} failed SPARQL graph-difference ASK"
        )
