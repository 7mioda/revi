import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { ProfileRepository } from '../../infrastructure/persistence/index.js'

@Injectable()
export class DeleteProfileService {
  constructor(
    @Inject(ProfileRepository) private readonly profileRepo: ProfileRepository,
  ) {}

  async execute(profileId: string): Promise<void> {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)
    await this.profileRepo.delete(profileId)
  }
}
