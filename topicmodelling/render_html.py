import json
import sys
import html
from pathlib import Path


def render_diff(diff_hunk: str) -> str:
    """Render a diff hunk with syntax-colored lines."""
    if not diff_hunk:
        return ""
    lines = diff_hunk.split("\n")
    rendered = []
    for line in lines:
        escaped = html.escape(line)
        if line.startswith("@@"):
            cls = "diff-range"
        elif line.startswith("+"):
            cls = "diff-add"
        elif line.startswith("-"):
            cls = "diff-del"
        else:
            cls = "diff-ctx"
        rendered.append(f'<span class="{cls}">{escaped}</span>')
    return "\n".join(rendered)


def build_html(categories: list[dict]) -> str:
    total_comments = sum(len(c["comments"]) for c in categories)

    cards_html = ""
    for cat in categories:
        keywords_html = "".join(
            f"<span class='kw'>{html.escape(k)}</span>" for k in cat["topicKeywords"]
        )
        comments_html = ""
        for i, comment in enumerate(cat["comments"]):
            body = html.escape(comment.get("body", "") or "")
            path = html.escape(comment.get("path", "") or "")
            repo = html.escape(
                f"{comment.get('repoOwner', '')}/{comment.get('repoName', '')}"
            )
            pr = comment.get("pullRequestNumber", "")
            diff = render_diff(comment.get("diffHunk", "") or "")
            created = (comment.get("createdAt", "") or "")[:10]

            comments_html += f"""
      <details class="comment" {"open" if i < 3 else ""}>
        <summary>
          <span class="comment-meta">{repo}#{pr}</span>
          <span class="comment-path">{path}</span>
          <span class="comment-date">{created}</span>
        </summary>
        <div class="comment-body">{body}</div>
        <pre class="diff">{diff}</pre>
      </details>"""

        cards_html += f"""
    <section class="category" id="topic-{cat['topicId']}">
      <div class="cat-header">
        <h2>Topic {cat['topicId']}</h2>
        <span class="badge">{len(cat['comments'])} comments</span>
      </div>
      <p class="cat-desc">{html.escape(cat['description'])}</p>
      <div class="keywords">{keywords_html}</div>
      <div class="comments">{comments_html}
      </div>
    </section>"""

    nav_links = "".join(
        f'<a href="#topic-{c["topicId"]}">Topic {c["topicId"]} '
        f'<span class="nav-count">({len(c["comments"])})</span></a>'
        for c in categories
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PR Comment Categories</title>
<style>
  :root {{
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --text2: #8b949e; --accent: #58a6ff;
    --add-bg: #12261e; --add-fg: #3fb950;
    --del-bg: #2d1214; --del-fg: #f85149;
    --range-fg: #bc8cff;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text); line-height: 1.6;
  }}
  .container {{ max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }}
  h1 {{ font-size: 1.8rem; margin-bottom: .3rem; }}
  .subtitle {{ color: var(--text2); margin-bottom: 2rem; }}
  nav {{ display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 2rem; }}
  nav a {{
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
    padding: .35rem .75rem; color: var(--accent); text-decoration: none; font-size: .85rem;
  }}
  nav a:hover {{ border-color: var(--accent); }}
  .nav-count {{ color: var(--text2); }}
  .category {{
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 1.5rem; margin-bottom: 1.5rem;
  }}
  .cat-header {{ display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; }}
  .cat-header h2 {{ font-size: 1.2rem; }}
  .badge {{
    background: var(--accent); color: #000; font-size: .75rem; font-weight: 600;
    padding: .15rem .55rem; border-radius: 12px;
  }}
  .cat-desc {{ color: var(--text2); margin-bottom: .75rem; }}
  .keywords {{ display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: 1rem; }}
  .kw {{
    background: #1c2536; border: 1px solid #263354; border-radius: 4px;
    padding: .15rem .5rem; font-size: .8rem; color: var(--accent);
  }}
  .comment {{
    border: 1px solid var(--border); border-radius: 6px; margin-bottom: .5rem;
    background: var(--bg);
  }}
  .comment summary {{
    cursor: pointer; padding: .5rem .75rem; display: flex; flex-wrap: wrap;
    gap: .5rem; align-items: center; font-size: .85rem;
  }}
  .comment summary:hover {{ background: #1c2128; }}
  .comment-meta {{ color: var(--accent); font-weight: 600; }}
  .comment-path {{ color: var(--text2); font-family: monospace; font-size: .8rem; flex: 1; min-width: 200px; }}
  .comment-date {{ color: var(--text2); font-size: .8rem; }}
  .comment-body {{
    padding: .75rem; border-bottom: 1px solid var(--border);
    white-space: pre-wrap; word-break: break-word;
  }}
  .diff {{
    margin: 0; padding: .75rem; overflow-x: auto;
    font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: .8rem; line-height: 1.5; white-space: pre;
  }}
  .diff-add {{ background: var(--add-bg); color: var(--add-fg); }}
  .diff-del {{ background: var(--del-bg); color: var(--del-fg); }}
  .diff-range {{ color: var(--range-fg); font-style: italic; }}
  .diff-ctx {{ color: var(--text2); }}
</style>
</head>
<body>
<div class="container">
  <h1>PR Comment Categories</h1>
  <p class="subtitle">{len(categories)} categories &middot; {total_comments} comments</p>
  <nav>{nav_links}</nav>
  {cards_html}
</div>
</body>
</html>"""


def main() -> None:
    input_file = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).resolve().parent / "categories.json"
    )
    output_file = sys.argv[2] if len(sys.argv) > 2 else str(
        Path(__file__).resolve().parent / "categories.html"
    )

    with open(input_file, "r") as f:
        categories = json.load(f)

    html_content = build_html(categories)

    with open(output_file, "w") as f:
        f.write(html_content)

    print(f"Rendered {len(categories)} categories to {output_file}")


if __name__ == "__main__":
    main()
