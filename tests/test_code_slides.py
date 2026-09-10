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
    assert ".slide .markdown-example" not in css


def test_markdown_ld_front_matter_separators_use_green_highlight():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    start = css.index("#markdown-ld .front-matter-separator {")
    rule = css[start:css.index("}", start)]
    assert "display: inline-block;" in rule
    assert "width: 100%;" in rule
    assert "box-sizing: border-box;" in rule
    assert "background: #e2f1e8;" in rule
    assert "color: #137333;" in rule
    assert "font-weight: bold;" in rule
    code_start = css.index("#markdown-ld .code-pane code {")
    code_rule = css[code_start:css.index("}", code_start)]
    assert "display: block;" in code_rule


def test_dollar_title_colors_at_and_dollar_sigils():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    at_start = css.index("#dollar .code-title .sigil-at {")
    at_rule = css[at_start:css.index("}", at_start)]
    dollar_start = css.index("#dollar .code-title .sigil-dollar {")
    dollar_rule = css[dollar_start:css.index("}", dollar_start)]
    assert "color: #BA2121;" in at_rule
    assert "color: #137333;" in dollar_rule


def test_norway_problem_flag_sits_centered_under_the_shout():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    stack_start = css.index("#norway-problem .norway-problem-stack {")
    stack_rule = css[stack_start:css.index("}", stack_start)]
    shout_start = css.index("#norway-problem .shout {")
    shout_rule = css[shout_start:css.index("}", shout_start)]
    flag_start = css.index("#norway-problem .norway-flag {")
    flag_rule = css[flag_start:css.index("}", flag_start)]
    assert "flex-direction: column;" in stack_rule
    assert "align-items: center;" in stack_rule
    assert "position: static;" in shout_rule
    assert "width: 240px;" in flag_rule
    assert "margin: 0 0 28px 38px;" not in flag_rule


def test_norway_comparison_prioritizes_the_parsed_value():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    version_start = css.index("#norway-11 .norway-version,")
    version_rule = css[version_start:css.index("}", version_start)]
    assert "font-size: 24px;" in version_rule
    assert ".norway-result {\n    font-size: 42px;" in css
    assert ".norway-value {\n    font-size: 1.55em;" in css
    assert ".norway-result-legacy" in css
    assert ".norway-result-current" in css
