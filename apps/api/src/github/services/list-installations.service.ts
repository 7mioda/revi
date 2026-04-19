import { Injectable, Inject } from '@nestjs/common'
import { InstallationRepository } from '../infrastructure/persistence/installation.repository.js'
import type { SafeInstallation } from '../infrastructure/persistence/installation.repository.js'

/**
 * Lists all GitHub App installations stored in the database.
 */
@Injectable()
export class ListInstallationsService {
  constructor(
    @Inject(InstallationRepository) private readonly installationRepo: InstallationRepository,
  ) {}

  execute(): Promise<SafeInstallation[]> {
    return this.installationRepo.list()
  }
}
