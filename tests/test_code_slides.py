from jeeves.paths import SLIDES


def test_code_slides_fill_the_slide_without_scrollbars():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    frame_start = css.index(".slide.code-slide .code-frame {")
    frame_rule = css[frame_start:css.index("}", frame_start)]
    pane_start = css.index(".slide.code-slide .code-pane {")
    pane_rule = css[pane_start:css.index("}", pane_start)]
    info_start = css.index(".slide.code-slide .code-info {")
    info_rule = css[info_start:css.index("}", info_start)]
    assert "inset: 0 0 calc(var(--progress-size) + 8px);" in frame_rule
    assert "inset: 0;" not in frame_rule
    assert "overflow: auto;" in pane_rule
    assert "scrollbar-width: none;" in pane_rule
    assert "line-height: 1.2;" in pane_rule
    assert "padding: 4px 8px;" in pane_rule
    assert "padding: 4px 8px calc(var(--progress-size) + 8px);" not in pane_rule
    assert "padding: 16px 460px 16px 20px;" not in pane_rule
    assert ".slide.code-slide .code-pane::-webkit-scrollbar" in css
    assert "background: rgb(255 255 255 / 90%);" not in info_rule
    assert "background: transparent;" in info_rule


def test_dollar_title_colors_at_and_dollar_sigils():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    at_start = css.index("#dollar .code-title .sigil-at {")
    at_rule = css[at_start:css.index("}", at_start)]
    dollar_start = css.index("#dollar .code-title .sigil-dollar {")
    dollar_rule = css[dollar_start:css.index("}", dollar_start)]
    assert "color: #BA2121;" in at_rule
    assert "color: #137333;" in dollar_rule
