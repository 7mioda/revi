import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { PrComment, Category } from './types.js'

const CLUSTER_SYSTEM_PROMPT = `You are an expert PR comment analyst. Your job is to cluster PR review comments into meaningful topic groups.

Given a list of PR review comments (with their IDs and bodies), identify distinct topic clusters that represent the main themes of code review feedback.

For each topic, provide:
- topicId: an integer starting from 0
- label: a short descriptive name (2-4 words)
- description: a one-sentence summary of what the topic covers
- keywords: 3-5 representative keywords

Assign every comment to exactly one topic by returning assignments that map each githubId to a topicId.`

const ClusterOutputSchema = z.object({
  topics: z.array(z.object({
    topicId: z.number().int(),
    label: z.string(),
    description: z.string(),
    keywords: z.array(z.string()).min(3).max(5),
  })),
  assignments: z.array(z.object({
    githubId: z.number(),
    topicId: z.number().int(),
  })),
})

function buildClusterPrompt(comments: PrComment[], nTopics: number): string {
  const commentList = comments
    .map(c => {
      const body = (c.body ?? '').slice(0, 200)
      return `- githubId: ${c.githubId}\n  body: ${body}`
    })
    .join('\n')

  return `Cluster the following ${comments.length} PR review comments into ${nTopics} topic groups.

Comments:
${commentList}

Return ${nTopics} topics and assign each comment to exactly one topic.`
}

export interface ClusterOptions {
  model?: string
  nTopics?: number
  apiKey?: string
}

export async function clusterComments(
  comments: PrComment[],
  options?: ClusterOptions,
): Promise<Category[]> {
  const modelId = options?.model ?? 'claude-sonnet-4-6'
  const nTopics = options?.nTopics ?? 10
  const provider = createAnthropic({ apiKey: options?.apiKey })

  const { object } = await generateObject({
    model: provider(modelId),
    schema: ClusterOutputSchema,
    system: CLUSTER_SYSTEM_PROMPT,
    prompt: buildClusterPrompt(comments, nTopics),
  })

  // Build a map from githubId to comment for fast lookup
  const commentMap = new Map(comments.map(c => [c.githubId, c]))

  // Build a map from topicId to topic metadata
  const topicMap = new Map(object.topics.map(t => [t.topicId, t]))

  // Group comments by topic
  const grouped = new Map<number, PrComment[]>()
  for (const { githubId, topicId } of object.assignments) {
    const comment = commentMap.get(githubId)
    if (!comment) continue
    const bucket = grouped.get(topicId) ?? []
    bucket.push(comment)
    grouped.set(topicId, bucket)
  }

  // Build Category array, sorted by comment count descending
  const categories: Category[] = []
  for (const [topicId, topic] of topicMap) {
    const topicComments = grouped.get(topicId) ?? []
    if (topicComments.length === 0) continue
    categories.push({
      topicId,
      label: topic.label,
      description: topic.description,
      keywords: topic.keywords,
      comments: topicComments,
    })
  }

  categories.sort((a, b) => b.comments.length - a.comments.length)
  return categories
}
