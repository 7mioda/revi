import type { Novu } from '@novu/api'
import type { NotificationEvent, NotificationPayload } from './types.js'

/**
 * Fires a Novu notification trigger.
 *
 * The `subscriberId` doubles as the GitHub username — Novu upserts the
 * subscriber on first trigger so no separate create call is needed.
 *
 * Never throws: errors are returned as `{ ok: false, error }` so callers
 * can safely fire-and-forget without wrapping in try/catch.
 *
 * @param client       - Novu client created by `createNovuClient`.
 * @param subscriberId - Novu subscriber ID (GitHub username).
 * @param event        - Workflow ID to trigger.
 * @param payload      - Data passed to the workflow template.
 */
export async function sendNotification(
  client: Novu,
  subscriberId: string,
  event: NotificationEvent,
  payload: NotificationPayload,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await client.trigger({
      workflowId: event,
      to: { subscriberId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as unknown as Record<string, any>,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err }
  }
}
