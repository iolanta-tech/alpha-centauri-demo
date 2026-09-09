"""The 3D graph is derived from the canonical named graph via SPARQL."""

from jeeves.graph import graph_from_sparqld
from tests.conftest import graph_iri


def test_graph_exposes_ab_proxima_and_planets(sparqld_endpoint):
    graph = graph_from_sparqld(sparqld_endpoint, graph_iri("01-canonical.jsonld"))
    labels = {node["label"] for node in graph["nodes"]}
    assert {
        "Alpha Centauri",
        "Alpha Centauri AB",
        "Proxima Centauri",
        "Proxima Centauri b",
        "Proxima Centauri d",
    }.issubset(labels)
    assert "Centaurus" not in labels
    assert "Star" not in labels
    assert "Planet" not in labels

    categories = {node["label"]: node["category"] for node in graph["nodes"]}
    assert categories["Alpha Centauri"] == "system"
    assert categories["Proxima Centauri"] == "star"
    assert categories["Proxima Centauri b"] == "planet"


def test_orbit_edges_preserve_rdf_predicate_and_direction(sparqld_endpoint):
    graph = graph_from_sparqld(sparqld_endpoint, graph_iri("01-canonical.jsonld"))
    orbit = next(
        link
        for link in graph["links"]
        if link["readerLabel"] == "orbits" and "Proxima_Centauri_b" in link["source"]
    )
    assert orbit["predicate"].endswith("star")
    assert orbit["target"].endswith("Proxima_Centauri")
    assert "→" in orbit["direction"] or "->" in orbit["direction"]
    assert all("fx" in node and "fy" in node for node in graph["nodes"])
