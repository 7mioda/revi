import { paginateRest } from '@octokit/plugin-paginate-rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
/**
 * Assembles a configured Octokit instance with all required plugins applied:
 * - `@octokit/plugin-paginate-rest` — automatic pagination via `client.paginate()`
 * - `@octokit/plugin-retry` — exponential backoff on 5xx responses
 * - `@octokit/plugin-throttling` — gracefully handles primary and secondary
 *   GitHub rate limits by logging a warning and retrying (never throws)
 *
 * @param token - Optional GitHub personal access token or OAuth token.
 *   When omitted the client operates as an anonymous user — public resources
 *   are still accessible, subject to the unauthenticated rate limit (60 req/h).
 * @returns A fully configured `OctokitClient`.
 */
export function createOctokitClient(token) {
    const OctokitWithPlugins = Octokit.plugin(paginateRest, retry, throttling);
    // The composed instance is a superset of OctokitClient; the cast is safe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new OctokitWithPlugins({
        ...(token !== undefined ? { auth: token } : {}),
        throttle: {
            // Structural type for `octokit` — we only need `log.warn`, which avoids
            // a circular reference back to the full OctokitClient type.
            onRateLimit: (retryAfter, _options, octokit) => {
                octokit.log.warn(`Primary rate limit hit — retrying after ${retryAfter}s`);
                return true; // instruct throttling plugin to retry
            },
            onSecondaryRateLimit: (retryAfter, _options, octokit) => {
                octokit.log.warn(`Secondary rate limit hit — retrying after ${retryAfter}s`);
                return true; // instruct throttling plugin to retry
            },
        },
    });
}
//# sourceMappingURL=client.js.map