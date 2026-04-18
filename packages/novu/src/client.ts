import { Novu } from '@novu/api'

/**
 * Constructs a Novu API client.
 *
 * @param secretKey - Novu API secret key.
 */
export function createNovuClient(secretKey: string): Novu {
  return new Novu({ security: { secretKey } })
}
