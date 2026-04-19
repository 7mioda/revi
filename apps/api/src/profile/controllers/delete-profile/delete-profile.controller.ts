import 'reflect-metadata'
import { Controller, Delete, Param, Inject } from '@nestjs/common'
import { DeleteProfileService } from '../../services/delete-profile/index.js'
import type { DeleteProfileOutput } from './delete-profile.output.js'

@Controller('profile')
export class DeleteProfileController {
  constructor(
    @Inject(DeleteProfileService) private readonly service: DeleteProfileService,
  ) {}

  /** Delete a profile document by ID. */
  @Delete(':profileId')
  async delete(@Param('profileId') profileId: string): Promise<DeleteProfileOutput> {
    await this.service.execute(profileId)
    return { deleted: true }
  }
}
