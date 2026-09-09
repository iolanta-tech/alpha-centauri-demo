"""Character and UTF-8 byte metrics cover every equivalent stage."""

from pathlib import Path

from jeeves.metrics import metrics_jsonld, measure_stages, with_savings, write_metrics_jsonld
from jeeves.paths import STAGE_FILES
from jeeves.sparqld import metrics_from_sparqld, serve

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_metrics_include_all_equivalent_stages_and_skip_markdown():
    metrics = measure_stages(PROJECT_ROOT / "examples")
    assert set(metrics) == {
        "01-canonical.jsonld",
        "02-plain.yamlld",
        "03-dollar.yamlld",
    }
    for row in metrics.values():
        assert row["characters"] > 0
        assert row["utf8_bytes"] >= row["characters"]


def test_yaml_stages_are_shorter_than_jsonld_in_characters():
    metrics = measure_stages(PROJECT_ROOT / "examples")
    json_chars = metrics["01-canonical.jsonld"]["characters"]
    for name in (
        "02-plain.yamlld",
        "03-dollar.yamlld",
    ):
        assert metrics[name]["characters"] < json_chars, name


def test_byte_savings_use_utf8_bytes_not_character_count():
    measured = measure_stages(PROJECT_ROOT / "examples")
    metrics = with_savings(measured)
    dollar_row = metrics["03-dollar.yamlld"]
    baseline = measured["01-canonical.jsonld"]["utf8_bytes"]
    dollar_bytes = measured["03-dollar.yamlld"]["utf8_bytes"]

    assert dollar_row["saved_byte_percent"] == round(
        ((baseline - dollar_bytes) / baseline) * 100,
        1,
    )


def test_previous_stage_byte_deltas_are_adjacent_utf8_differences():
    measured = measure_stages(PROJECT_ROOT / "examples")
    metrics = with_savings(measured)

    assert metrics[STAGE_FILES[0]]["previous_byte_delta"] is None
    for previous, current in zip(STAGE_FILES, STAGE_FILES[1:]):
        assert metrics[current]["previous_byte_delta"] == (
            measured[current]["utf8_bytes"] - measured[previous]["utf8_bytes"]
        )


def test_metrics_jsonld_describes_each_stage():
    metrics = with_savings(measure_stages(PROJECT_ROOT / "examples"))
    document = metrics_jsonld(metrics)

    assert document["@type"] == "schema:Dataset"
    stages = document["stage"]
    assert isinstance(stages, list)
    assert [stage["sourceFile"] for stage in stages] == list(metrics)
    assert "previousByteDelta" not in stages[0]


def test_sparql_reads_metrics_from_generated_jsonld(tmp_path):
    metrics = with_savings(measure_stages(PROJECT_ROOT / "examples"))
    directory = tmp_path / "metrics"
    directory.mkdir()
    dataset = directory / "metrics.jsonld"
    write_metrics_jsonld(dataset, metrics)

    with serve(directory, materialize_plain_yamlld=False) as endpoint:
        assert metrics_from_sparqld(endpoint) == metrics
