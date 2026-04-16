/**
 * Lists all repositories owned by a GitHub user, using automatic pagination.
 * Uses `GET /users/{username}/repos`.
 *
 * @param client - A configured `OctokitClient`.
 * @param username - The GitHub login of the user whose repos to list.
 * @returns A list of `RepoRef` objects (owner + name pairs).
 */
export async function getUserRepos(client, username) {
    const raw = await client.paginate(client.rest.repos.listForUser, { username, per_page: 100 });
    return raw.map((repo) => ({
        owner: repo.owner?.login ?? username,
        name: repo.name,
    }));
}
//# sourceMappingURL=get-user-repos.js.map