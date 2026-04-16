import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";

// --- Types ---

interface PrComment {
  githubId: number;
  username: string;
  type: "pr_review_comment" | "pr_comment" | "commit_comment";
  body: string;
  path: string | null;
  diffHunk: string | null;
  pullRequestNumber: number | null;
  repoOwner: string;
  repoName: string;
  createdAt: string;
  updatedAt: string;
  inReplyToId?: number;
}

interface DataFile {
  user: string;
  fetchedAt: string;
  totalRepos: number;
  totalComments: number;
  comments: PrComment[];
}

interface LlmResult {
  is_relevant: boolean;
}

interface OutputLine {
  comment: PrComment;
  llm_result: LlmResult;
}

// --- Prompt ---

const SYSTEM_PROMPT = `You are an expert code reviewer analyst. Your job is to evaluate whether a PR review comment is a relevant, clear, actionable, and categorizable recommendation.

A comment is relevant if it:
- Points out a real issue (bug, performance, security, readability, maintainability, design)
- Suggests a concrete improvement or alternative approach
- Is specific enough that the reviewee can act on it

A comment is NOT relevant if it:
- Is just a short acknowledgment ("ok", "lgtm", "nice", "thanks")
- Is a vague or unclear remark ("I don't understand", "hmm", "not sure about this")
- Is a question without any implied suggestion
- Is purely stylistic nitpicking with no real impact
- Is a conversation/discussion message rather than an actionable recommendation`;

function buildUserMessage(comment: PrComment): string {
  return `Analyze this PR review comment and determine if it is a relevant, actionable recommendation.

## File
${comment.path}

## Diff hunk (context around the comment)
\`\`\`
${comment.diffHunk}
\`\`\`

## Comment
Author: ${comment.username}
${comment.body}`;
}

// --- Tool definition for structured output ---

const evaluationTool: Anthropic.Messages.Tool = {
  name: "evaluate_comment",
  description:
    "Report whether the PR comment is a relevant actionable recommendation.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_relevant: {
        type: "boolean",
        description:
          "True if the comment is a clear, actionable, categorizable recommendation.",
      },
    },
    required: ["is_relevant"],
  },
};

// --- Deterministic pre-filters ---

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isPartOfConversation(comment: PrComment): boolean {
  return comment.inReplyToId != null;
}

function preFilter(comment: PrComment): { pass: boolean; reason?: string } {
  if (isPartOfConversation(comment)) {
    return { pass: false, reason: "part of a conversation thread (in_reply_to_id set)" };
  }
  if (wordCount(comment.body) < 5) {
    return { pass: false, reason: `too short (${wordCount(comment.body)} words)` };
  }
  return { pass: true };
}

// --- Main ---

async function evaluateComment(
  client: Anthropic,
  comment: PrComment
): Promise<LlmResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [evaluationTool],
    tool_choice: { type: "tool", name: "evaluate_comment" },
    messages: [{ role: "user", content: buildUserMessage(comment) }],
  });

  const toolBlock = response.content.find(
    (block) => block.type === "tool_use"
  );
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`No tool_use block in response for comment ${comment.githubId}`);
  }

  const input = toolBlock.input as { is_relevant: boolean };
  return { is_relevant: input.is_relevant };
}

async function main() {
  const repoRoot = path.resolve(__dirname, "../../..");
  const inputPath = process.argv[2] ?? path.join(repoRoot, "apps/api/data.json");
  const limit = parseInt(process.argv[3] ?? "500", 10);
  const outputPath = path.join(repoRoot, "output.jsonl");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in environment / .env file");
    process.exit(1);
  }

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Limit:  ${limit} comments\n`);

  const client = new Anthropic();

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data: DataFile = JSON.parse(raw);
  const comments = data.comments.slice(0, limit);

  // Clear output file
  fs.writeFileSync(outputPath, "");

  let total = 0;
  let preFiltered = 0;
  let relevant = 0;

  for (const comment of comments) {
    total++;

    const filter = preFilter(comment);
    if (!filter.pass) {
      preFiltered++;
      console.log(`[${total}] Skipped comment ${comment.githubId}: ${filter.reason}`);
      continue;
    }

    console.log(`[${total}] Evaluating comment ${comment.githubId} on ${comment.path}...`);

    const llmResult = await evaluateComment(client, comment);

    if (llmResult.is_relevant) {
      relevant++;
      const outputLine: OutputLine = { comment, llm_result: llmResult };
      fs.appendFileSync(outputPath, JSON.stringify(outputLine) + "\n");
      console.log(`  -> RELEVANT (${relevant}/${total})`);
    } else {
      console.log(`  -> not relevant`);
    }
  }

  console.log(`\nDone. ${total} total, ${preFiltered} pre-filtered, ${relevant} relevant. Output: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
