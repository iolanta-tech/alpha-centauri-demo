"""Build a 3D force-graph payload from a sparqld named graph."""

from __future__ import annotations

from typing import TypedDict

from .sparqld import load_query, optional_bindings, query_json

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
SCHEMA_HAS_PART = "https://schema.org/hasPart"
SCHEMA_NAME = "https://schema.org/name"
DBO_STAR = "http://dbpedia.org/ontology/Star"
DBO_PLANET = "http://dbpedia.org/ontology/Planet"
DBP_STAR = "http://dbpedia.org/property/star"
DBO_CONSTELLATION = "http://dbpedia.org/ontology/constellation"

READER_LABELS = {
    DBP_STAR: "orbits",
    SCHEMA_HAS_PART: "contains",
    DBO_CONSTELLATION: "in constellation",
}

PREDICATE_CURIES = {
    DBP_STAR: "dbp:star",
    SCHEMA_HAS_PART: "schema:hasPart",
    DBO_CONSTELLATION: "dbo:constellation",
}

POSITIONS = {
    "http://dbpedia.org/resource/Alpha_Centauri": (0, 80, 0),
    "http://dbpedia.org/resource/Centaurus": (-120, 95, -20),
    "http://dbpedia.org/resource/Alpha_Centauri_AB": (0, 15, 0),
    "http://dbpedia.org/resource/Alpha_Centauri_A": (-80, 5, 25),
    "http://dbpedia.org/resource/Alpha_Centauri_B": (80, 5, 25),
    "http://dbpedia.org/resource/Proxima_Centauri": (0, -50, 0),
    "http://dbpedia.org/resource/Proxima_Centauri_b": (-55, -100, 15),
    "http://dbpedia.org/resource/Proxima_Centauri_d": (55, -100, 15),
}

SKIP_PREDICATES = {RDF_TYPE, SCHEMA_NAME}


class GraphNode(TypedDict):
    id: str
    label: str
    category: str
    fx: int
    fy: int
    fz: int


class GraphLink(TypedDict):
    source: str
    target: str
    predicate: str
    predicateLabel: str
    readerLabel: str
    direction: str


class GraphPayload(TypedDict):
    nodes: list[GraphNode]
    links: list[GraphLink]


def _category(types: set[str], has_part: bool) -> str:
    if DBO_PLANET in types:
        return "planet"
    if DBO_STAR in types:
        return "star"
    if has_part:
        return "system"
    return "other"


def graph_from_sparqld(endpoint: str, named_graph: str) -> GraphPayload:
    node_rows = optional_bindings(
        query_json(endpoint, load_query("graph-nodes.rq", GRAPH=named_graph)),
        "id",
        "name",
        "type",
        "hasPart",
    )
    types_by_id: dict[str, set[str]] = {}
    names: dict[str, str] = {}
    has_part: set[str] = set()
    for row in node_rows:
        node_id = row["id"]
        types_by_id.setdefault(node_id, set())
        if "type" in row:
            types_by_id[node_id].add(row["type"])
        if "name" in row:
            names[node_id] = row["name"]
        if row.get("hasPart") == "true":
            has_part.add(node_id)

    nodes: list[GraphNode] = []
    for node_id, node_types in types_by_id.items():
        fx, fy, fz = POSITIONS.get(node_id, (0, 0, 0))
        nodes.append(
            {
                "id": node_id,
                "label": names.get(
                    node_id, node_id.rsplit("/", 1)[-1].replace("_", " ")
                ),
                "category": _category(node_types, node_id in has_part),
                "fx": fx,
                "fy": fy,
                "fz": fz,
            }
        )

    link_rows = optional_bindings(
        query_json(endpoint, load_query("graph-links.rq", GRAPH=named_graph)),
        "subject",
        "predicate",
        "object",
    )
    links: list[GraphLink] = []
    for row in link_rows:
        predicate = row["predicate"]
        if predicate in SKIP_PREDICATES:
            continue
        links.append(
            {
                "source": row["subject"],
                "target": row["object"],
                "predicate": predicate,
                "predicateLabel": PREDICATE_CURIES.get(
                    predicate, predicate.rsplit("/", 1)[-1]
                ),
                "readerLabel": READER_LABELS.get(
                    predicate, predicate.rsplit("/", 1)[-1]
                ),
                "direction": f"{row['subject']} → {row['object']}",
            }
        )

    nodes.sort(key=lambda node: node["id"])
    links.sort(
        key=lambda link: (link["source"], link["predicate"], link["target"]),
    )
    return {"nodes": nodes, "links": links}
