"""Start a read-only sparqld endpoint over the example stages."""

from __future__ import annotations

import pytest

from jeeves.paths import EXAMPLES, STAGE_FILES, graph_iri
from jeeves.sparqld import bindings, serve
from jeeves.sparqld import query as query_sparqld

__all__ = ["STAGE_FILES", "bindings", "graph_iri", "query_sparqld", "sparqld_endpoint"]


@pytest.fixture(scope="session")
def sparqld_endpoint():
    with serve(EXAMPLES) as endpoint:
        yield endpoint
