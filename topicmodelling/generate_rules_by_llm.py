import json
import math
import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

BATCH_SIZE = 10
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

INPUT_JSONL = PROJECT_ROOT / "output.jsonl"
EXAMPLE_RULES_PATH = PROJECT_ROOT / "apps" / "api" / "output" / "example_rules.json"
ENV_PATH = PROJECT_ROOT / "packages" / "filter-comments" / ".env"
OUTPUT_PATH = SCRIPT_DIR / "generated_rules.json"

SYSTEM_PROMPT = """\
You are an expert code review analyst. You analyze PR review comments and extract \
recurring review patterns into reusable rules.

A rule represents a recurring code review guideline. Each rule has:
- "name": a kebab-case identifier (e.g., "prefer-explicit-naming")
- "content": a clear, actionable description of the rule (1-3 sentences)

Your task: given a set of existing rules and a batch of new PR review comments, \
analyze each comment and either:
1. Associate it with an existing rule (no change needed - do not include it in your output)
2. Generalize/extend an existing rule to cover this comment (include the updated rule with the SAME name)
3. Create a new rule if no existing rule matches the comment's intent (include the new rule)

IMPORTANT:
- Only return rules that are NEW or MODIFIED. Do not return unchanged existing rules.
- Keep rules general enough to apply across codebases, not specific to one file or PR.
- A rule should capture a principle or pattern, not a one-off suggestion.
- Use kebab-case for rule names.
- Each rule's content should be 1-3 sentences, clear and actionable."""

UPDATE_RULES_TOOL = {
    "name": "update_rules",
    "description": "Return the list of new or modified review rules based on the analyzed PR comments.",
    "input_schema": {
        "type": "object",
        "properties": {
            "rules": {
                "type": "array",
                "description": "Array of new or modified rules. Only include rules that are new or whose content has been updated/generalized.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Kebab-case rule identifier",
                        },
                        "content": {
                            "type": "string",
                            "description": "Clear, actionable rule description (1-3 sentences)",
                        },
                    },
                    "required": ["name", "content"],
                },
            }
        },
        "required": ["rules"],
    },
}


def load_comments(path: Path) -> list[dict]:
    comments = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("llm_result", {}).get("is_relevant", False):
                comments.append(entry["comment"])
    return comments


def load_example_rules(path: Path) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def save_rules(rules: list[dict], path: Path) -> None:
    with open(path, "w") as f:
        json.dump(rules, f, indent=2, ensure_ascii=False)


def format_rules_for_prompt(rules: list[dict]) -> str:
    if not rules:
        return "(no rules yet)"
    lines = []
    for r in rules:
        lines.append(f"- **{r['name']}**: {r['content']}")
    return "\n".join(lines)


def format_comment_for_prompt(comment: dict, index: int) -> str:
    diff_hunk = comment.get("diffHunk", "")
    if len(diff_hunk) > 500:
        diff_hunk = diff_hunk[:500] + "\n... (truncated)"

    return f"""### Comment {index}
- **File**: {comment.get("path", "unknown")}
- **Repository**: {comment.get("repoOwner", "")}/{comment.get("repoName", "")}
- **Comment**: {comment.get("body", "")}
- **Code context**:
```
{diff_hunk}
```"""


def build_user_message(
    current_rules: list[dict],
    batch_comments: list[dict],
    batch_number: int,
    total_batches: int,
) -> str:
    rules_text = format_rules_for_prompt(current_rules)
    comments_text = "\n\n".join(
        format_comment_for_prompt(c, i + 1) for i, c in enumerate(batch_comments)
    )

    return f"""## Current Rules ({len(current_rules)} rules)

{rules_text}

## New PR Review Comments (batch {batch_number}/{total_batches})

{comments_text}

---

Analyze these comments and return only NEW or MODIFIED rules."""


def process_batch(
    client: anthropic.Anthropic,
    current_rules: list[dict],
    batch_comments: list[dict],
    batch_number: int,
    total_batches: int,
) -> list[dict]:
    user_message = build_user_message(
        current_rules, batch_comments, batch_number, total_batches
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        tools=[UPDATE_RULES_TOOL],
        tool_choice={"type": "tool", "name": "update_rules"},
        messages=[{"role": "user", "content": user_message}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "update_rules":
            return block.input.get("rules", [])

    print(f"  WARNING: No tool_use block found in response", file=sys.stderr)
    return []


def merge_rules(existing: list[dict], updates: list[dict]) -> list[dict]:
    rules_dict = {r["name"]: r for r in existing}
    for rule in updates:
        rules_dict[rule["name"]] = rule
    return list(rules_dict.values())


def main():
    load_dotenv(ENV_PATH)
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found", file=sys.stderr)
        sys.exit(1)

    comments = load_comments(INPUT_JSONL)
    current_rules = load_example_rules(EXAMPLE_RULES_PATH)

    print(f"Loaded {len(comments)} relevant comments")
    print(f"Starting with {len(current_rules)} seed rules")

    client = anthropic.Anthropic(api_key=api_key, max_retries=3)

    total_batches = math.ceil(len(comments) / BATCH_SIZE)

    for i in range(0, len(comments), BATCH_SIZE):
        batch = comments[i : i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        print(f"\nProcessing batch {batch_num}/{total_batches} ({len(batch)} comments)...")

        try:
            new_or_modified = process_batch(
                client, current_rules, batch, batch_num, total_batches
            )
            current_rules = merge_rules(current_rules, new_or_modified)
            print(
                f"  Rules after batch: {len(current_rules)} total, {len(new_or_modified)} new/modified"
            )
        except Exception as e:
            print(f"  ERROR in batch {batch_num}: {e}", file=sys.stderr)
            print(f"  Skipping batch and continuing...", file=sys.stderr)

        save_rules(current_rules, OUTPUT_PATH)
        print(f"  Saved to {OUTPUT_PATH}")

    print(f"\nDone. {len(current_rules)} rules total.")


if __name__ == "__main__":
    main()
