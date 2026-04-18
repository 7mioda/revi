import type { OctokitClient } from './client.js'
import type { GithubDiscussion } from './types.js'

interface DiscussionNode {
  id: string
  title: string
  body: string | null
  createdAt: string
  updatedAt: string
  repository: { owner: { login: string }; name: string }
}

interface DiscussionsPage {
  user: {
    repositoryDiscussions: {
      nodes: DiscussionNode[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

const DISCUSSIONS_QUERY = `
  query($login: String!, $cursor: String) {
    user(login: $login) {
      repositoryDiscussions(first: 100, after: $cursor) {
        nodes {
          id
          title
          body
          createdAt
          updatedAt
          repository { owner { login } name }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

/**
 * Fetches GitHub Discussions authored by `username` using the GraphQL API.
 *
 * Only returns discussions in repositories the user owns (GitHub's
 * `repositoryDiscussions` field is scoped to the viewer's repos).
 * Cross-repo discussion comments are out of scope due to API cost.
 *
 * @param client   - A configured `OctokitClient`.
 * @param username - The GitHub login whose discussions to fetch.
 * @returns A list of `GithubDiscussion` objects.
 */
export async function fetchUserDiscussions(
  client: OctokitClient,
  username: string,
): Promise<GithubDiscussion[]> {
  const discussions: GithubDiscussion[] = []
  let cursor: string | null = null

  do {
    const page = await (client as unknown as { graphql: (q: string, v: Record<string, unknown>) => Promise<DiscussionsPage> }).graphql(
      DISCUSSIONS_QUERY,
      { login: username, cursor },
    )

    const { nodes, pageInfo } = page.user.repositoryDiscussions

    for (const node of nodes) {
      discussions.push({
        githubId: node.id,
        title: node.title,
        body: node.body ?? null,
        repoOwner: node.repository.owner.login,
        repoName: node.repository.name,
        authorLogin: username,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      })
    }

    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
  } while (cursor !== null)

  return discussions
}
