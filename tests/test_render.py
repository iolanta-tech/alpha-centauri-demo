"""Slide HTML is rendered with Jinja2."""

from jeeves.render import render_template


def test_render_template_fills_jinja_context(tmp_path):
    template = tmp_path / "index.template.html"
    template.write_text(
        """<pre>{{ fragments['02-plain.yamlld'] | safe }}</pre>
<p>{{ metrics['02-plain.yamlld'].characters }} chars</p>
<script>const GRAPH = {{ graph | tojson }};</script>
<style>{{ pygments_css | safe }}</style>
""",
        encoding="utf-8",
    )
    dest = tmp_path / "index.html"
    render_template(
        template,
        dest,
        fragments={"02-plain.yamlld": "<code>name: Alpha Centauri</code>"},
        metrics={"02-plain.yamlld": {"characters": 42, "saved_percent": 12.5}},
        graph={"nodes": [], "links": []},
        pygments_css=".highlight { color: navy; }",
    )
    html = dest.read_text(encoding="utf-8")
    assert "<code>name: Alpha Centauri</code>" in html
    assert "42 chars" in html
    assert '"nodes": []' in html
    assert ".highlight { color: navy; }" in html
