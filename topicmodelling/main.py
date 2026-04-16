import json
import sys
import numpy as np
from pathlib import Path
from turftopic import KeyNMF


def load_comments(input_path: str) -> list[dict]:
    with open(input_path, "r") as f:
        data = json.load(f)
    return data["comments"]


def build_documents(comments: list[dict]) -> list[str]:
    """Combine comment body + diff hunk into a single document per comment."""
    documents = []
    for c in comments:
        body = c.get("body", "") or ""
        diff = c.get("diffHunk", "") or ""
        doc = f"Comment: {body}\n\nCode diff:\n{diff}"
        documents.append(doc)
    return documents


def run_topic_modelling(
    input_path: str,
    output_path: str,
    n_topics: int = 10,
    encoder: str = "all-MiniLM-L6-v2",
) -> None:
    print(f"Loading comments from {input_path}...")
    comments = load_comments(input_path)
    print(f"Loaded {len(comments)} comments.")

    documents = build_documents(comments)

    print(f"Fitting KeyNMF with {n_topics} topics...")
    model = KeyNMF(n_components=n_topics, encoder=encoder)
    doc_topic_matrix = model.fit_transform(documents)

    # Assign each document to its dominant topic
    topic_assignments = np.argmax(doc_topic_matrix, axis=1)

    # Extract topic keywords for descriptions
    vocab = model.get_vocab()
    categories = {}
    for topic_idx in range(model.components_.shape[0]):
        top_word_indices = np.argsort(model.components_[topic_idx])[::-1][:10]
        top_words = [vocab[i] for i in top_word_indices]
        categories[topic_idx] = {
            "topicId": topic_idx,
            "topicKeywords": top_words,
            "description": f"Topic about: {', '.join(top_words[:5])}",
            "comments": [],
        }

    # Group comments into their assigned category
    for doc_idx, topic_idx in enumerate(topic_assignments):
        categories[int(topic_idx)]["comments"].append(comments[doc_idx])

    # Build output: only include categories that have comments
    result = [cat for cat in categories.values() if cat["comments"]]
    result.sort(key=lambda c: len(c["comments"]), reverse=True)

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nResults written to {output_path}")
    print(f"Found {len(result)} non-empty categories:")
    for cat in result:
        print(
            f"  Topic {cat['topicId']}: {len(cat['comments'])} comments "
            f"— {', '.join(cat['topicKeywords'][:5])}"
        )


if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).resolve().parent.parent / "apps" / "api" / "data.json"
    )
    output_file = sys.argv[2] if len(sys.argv) > 2 else str(
        Path(__file__).resolve().parent / "categories.json"
    )
    n_topics = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    run_topic_modelling(input_file, output_file, n_topics=n_topics)
