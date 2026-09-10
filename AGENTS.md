# Presentation Narrative

- Do not reference a graph, term, syntax feature, comparison, or prior state before the presentation has introduced it. Validate the rendered slide order from the audience's perspective, including deictic words such as “this”, “same”, and “previous”.
- Use YAML 1.2-compatible features only in YAML-LD examples; do not use YAML 1.1 merge keys.
- Prefer Ribbon's built-in slide types, modifiers, and layout primitives for common presentation structure. Use scoped custom CSS only where content density, overlays, or a presentation-specific visual requires it.

## Presentation Maintenance

- `slides/index.template.html` is the editable deck source. `slides/index.html` is the locally rendered, tracked deployment artifact.
- To prepare the local environment, run `uv venv`, then `uv pip install -r requirements.txt`. `sparqld` must be available on `PATH`.
- After changing deck sources or generated assets, run `j render` locally and commit the resulting `slides/index.html` and generated assets. Use `j serve` to preview the deck at `http://127.0.0.1:8765/index.html`.
- Run `uv run --python .venv/bin/python python -m pytest` to check semantic equivalence and presentation generation.
- Netlify has no build command. It publishes `slides`; do not configure Netlify to run `j render`.
