import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import * as fs from "node:fs";
import * as readline from "node:readline";

// --- Types ---

interface PrComment {
  url: string;
  pull_request_review_id: number | null;
  id: number;
  node_id: string;
  diff_hunk: string;
  path: string;
  position: number | null;
  original_position: number | null;
  commit_id: string;
  original_commit_id: string;
  in_reply_to_id?: number;
  user: {
    login: string;
    id: number;
    type: string;
    [key: string]: unknown;
  };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request_url: string;
  author_association: string;
  start_line: number | null;
  original_start_line: number | null;
  line: number | null;
  original_line: number | null;
  side: string;
  subject_type?: string;
  reactions?: Record<string, unknown>;
  [key: string]: unknown;
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
${comment.diff_hunk}
\`\`\`

## Comment
Author: ${comment.user.login}
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
  return comment.in_reply_to_id != null;
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
    throw new Error(`No tool_use block in response for comment ${comment.id}`);
  }

  const input = toolBlock.input as { is_relevant: boolean };
  return { is_relevant: input.is_relevant };
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error("Usage: tsx src/index.ts <input.jsonl> <output.jsonl>");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in environment / .env file");
    process.exit(1);
  }

  const client = new Anthropic();

  const inputStream = fs.createReadStream(inputPath, "utf-8");
  const rl = readline.createInterface({ input: inputStream });

  // Clear output file
  fs.writeFileSync(outputPath, "");

  let total = 0;
  let preFiltered = 0;
  let relevant = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const comment: PrComment = JSON.parse(line);
    total++;

    const filter = preFilter(comment);
    if (!filter.pass) {
      preFiltered++;
      console.log(`[${total}] Skipped comment ${comment.id}: ${filter.reason}`);
      continue;
    }

    console.log(`[${total}] Evaluating comment ${comment.id} on ${comment.path}...`);

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
