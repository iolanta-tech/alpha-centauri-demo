"""Query a local sparqld SPARQL endpoint."""

from __future__ import annotations

import json
import socket
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import sh

from .paths import EXAMPLES, QUERIES, STAGE_FILES, graph_iri
from .stages import write_plain_yamlld


def load_query(filename: str, **placeholders: str) -> str:
    text = (QUERIES / filename).read_text(encoding="utf-8")
    for key, value in placeholders.items():
        text = text.replace(f"__{key}__", value)
    return text


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def query(endpoint: str, sparql: str, timeout: float = 10) -> dict[str, object] | str:
    request = urllib.request.Request(
        endpoint,
        data=sparql.encode("utf-8"),
        headers={"Content-Type": "application/sparql-query"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        content_type = response.headers.get("Content-Type", "")
    if "sparql-results+json" in content_type:
        return json.loads(body)
    return body


def query_json(
    endpoint: str,
    sparql: str,
    timeout: float = 10,
) -> dict[str, object]:
    payload = query(endpoint, sparql, timeout=timeout)
    if isinstance(payload, dict):
        return payload
    raise TypeError("SPARQL endpoint did not return JSON results")


def _binding_rows(result: dict[str, object]) -> list[object]:
    results = result["results"]
    if not isinstance(results, dict):
        raise TypeError("SPARQL JSON results missing")
    rows = results["bindings"]
    if not isinstance(rows, list):
        raise TypeError("SPARQL JSON bindings missing")
    return rows


def _row_value(row: object, name: str) -> str | None:
    if not isinstance(row, dict):
        return None
    term = row.get(name)
    if not isinstance(term, dict):
        return None
    value = term.get("value")
    if isinstance(value, str):
        return value
    return None


def bindings(result: dict[str, object], *names: str) -> list[tuple[str, ...]]:
    rows: list[tuple[str, ...]] = []
    for row in _binding_rows(result):
        values = tuple(
            value for name in names if (value := _row_value(row, name)) is not None
        )
        rows.append(values)
    return rows


def optional_bindings(
    result: dict[str, object],
    *names: str,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for row in _binding_rows(result):
        parsed = {
            name: value
            for name in names
            if (value := _row_value(row, name)) is not None
        }
        rows.append(parsed)
    return rows


@contextmanager
def serve(
    directory: Path = EXAMPLES,
    host: str = "127.0.0.1",
    *,
    materialize_plain_yamlld: bool = True,
) -> Iterator[str]:
    if materialize_plain_yamlld:
        write_plain_yamlld(directory)
    port = free_port()
    process = sh.sparqld(
        "--no-watch",
        "--host",
        host,
        "--port",
        str(port),
        str(directory),
        _bg=True,
        _bg_exc=False,
    )
    endpoint = f"http://{host}:{port}/"
    deadline = time.time() + 20
    last_error: Exception | None = None
    try:
        while time.time() < deadline:
            if not process.is_alive():
                raw_err: object = process.stderr
                if isinstance(raw_err, bytes):
                    message = raw_err.decode("utf-8", errors="replace")
                elif isinstance(raw_err, str):
                    message = raw_err
                else:
                    message = repr(raw_err)
                raise RuntimeError(
                    f"sparqld exited {process.exit_code}: {message}",
                )
            try:
                query(endpoint, load_query("ready.rq"), timeout=2)
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
                last_error = error
                time.sleep(0.1)
        else:
            raise RuntimeError(f"sparqld did not become ready: {last_error}")
        yield endpoint
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except sh.TimeoutException:
            process.kill()
            try:
                process.wait(timeout=5)
            except (sh.ErrorReturnCode, sh.SignalException):
                pass
        except (sh.ErrorReturnCode, sh.SignalException):
            pass


def triples(endpoint: str, filename: str) -> set[tuple[str, str, str]]:
    triples_out: set[tuple[str, str, str]] = set()
    for row in bindings(
        query_json(endpoint, load_query("triples.rq", GRAPH=graph_iri(filename))),
        "subject",
        "predicate",
        "object",
    ):
        if len(row) == 3:
            triples_out.add((row[0], row[1], row[2]))
    return triples_out


def load_errors(endpoint: str) -> list[tuple[str, str]]:
    errors: list[tuple[str, str]] = []
    for row in bindings(
        query_json(endpoint, load_query("load-errors.rq")),
        "resource",
        "message",
    ):
        if len(row) == 2:
            errors.append((row[0], row[1]))
    return errors


def metrics_from_sparqld(
    endpoint: str,
) -> dict[str, dict[str, float | int | None]]:
    """Read generated stage measurements from the JSON-LD dataset with SPARQL."""
    rows: dict[str, dict[str, float | int | None]] = {}
    fields = (
        "position",
        "sourceFile",
        "characters",
        "utf8Bytes",
        "savedCharacters",
        "savedPercent",
        "savedBytes",
        "savedBytePercent",
        "previousByteDelta",
    )
    for row in optional_bindings(query_json(endpoint, load_query("metrics.rq")), *fields):
        try:
            filename = row["sourceFile"]
            rows[filename] = {
                "characters": int(row["characters"]),
                "utf8_bytes": int(row["utf8Bytes"]),
                "saved_characters": int(row["savedCharacters"]),
                "saved_percent": float(row["savedPercent"]),
                "saved_bytes": int(row["savedBytes"]),
                "saved_byte_percent": float(row["savedBytePercent"]),
                "previous_byte_delta": (
                    int(row["previousByteDelta"])
                    if "previousByteDelta" in row
                    else None
                ),
            }
        except KeyError as error:
            raise RuntimeError(f"metric query omitted required binding: {error}") from error
    return rows


def graphs_equivalent(endpoint: str, left: str, right: str) -> bool:
    result = query_json(
        endpoint,
        load_query(
            "graphs-equivalent.rq",
            CANONICAL=graph_iri(left),
            OTHER=graph_iri(right),
        ),
    )
    return result["boolean"] is True


def assert_stages_equivalent(endpoint: str) -> None:
    errors = load_errors(endpoint)
    if errors:
        details = "; ".join(f"{resource}: {message}" for resource, message in errors)
        raise RuntimeError(f"sparqld load errors: {details}")

    canonical = triples(endpoint, STAGE_FILES[0])
    if not canonical:
        raise RuntimeError(f"{STAGE_FILES[0]} expanded to an empty graph")

    for filename in STAGE_FILES[1:]:
        actual = triples(endpoint, filename)
        missing = canonical - actual
        extra = actual - canonical
        if missing or extra:
            raise RuntimeError(
                f"{filename} is not RDF-equivalent to {STAGE_FILES[0]}: "
                f"missing={sorted(missing)} extra={sorted(extra)}"
            )
