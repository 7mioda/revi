import type { OctokitClient } from './client.js';
import type { RepoRef } from './types.js';
/**
 * Lists every repository accessible to the authenticated token — including
 * repositories the user owns, repos where they are a collaborator, and repos
 * inside organisations they belong to.
 *
 * Uses `GET /user/repos` with `affiliation=owner,collaborator,organization_member`
 * and automatic pagination.
 *
 * @param client - A configured `OctokitClient`.
 * @returns A list of `RepoRef` objects covering the full accessible surface.
 */
export declare function listAccessibleRepos(client: OctokitClient): Promise<RepoRef[]>;
//# sourceMappingURL=list-accessible-repos.d.ts.map