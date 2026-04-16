/**
 * Returns the GitHub user associated with the token used to create the client.
 * Uses `GET /user` (authenticated endpoint).
 *
 * @param client - A configured `OctokitClient`.
 * @returns The authenticated user's `login` and numeric `id`.
 */
export async function getAuthenticatedUser(client) {
    const { data } = await client.rest.users.getAuthenticated();
    return { login: data.login, id: data.id };
}
//# sourceMappingURL=get-authenticated-user.js.map