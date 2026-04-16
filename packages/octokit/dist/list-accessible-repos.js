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
export async function listAccessibleRepos(client) {
    const raw = await client.paginate(client.rest.repos.listForAuthenticatedUser, { affiliation: 'owner,collaborator,organization_member', per_page: 100 });
    return raw.map((repo) => ({
        owner: repo.owner?.login ?? repo.name,
        name: repo.name,
    }));
}
//# sourceMappingURL=list-accessible-repos.js.map