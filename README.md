# YAML-LD: Linked Data for Humans & Agents

Shower presentation for a Dataworthy talk. One canonical Alpha Centauri
JSON-LD document is re-serialized through YAML-LD stages; sparqld checks that
every stage expands to the same RDF.

## Setup

```sh
uv venv
uv pip install -r requirements.txt
```

`sparqld` must be on `PATH` (`cargo install sparqld`).

## Render

```sh
j render
```

## Serve

```sh
j serve
```

The deck is at http://127.0.0.1:8765/index.html.

## Equivalence

```sh
uv run --python .venv/bin/python python -m pytest
```
