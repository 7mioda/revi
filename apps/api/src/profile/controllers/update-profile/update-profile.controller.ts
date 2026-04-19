import 'reflect-metadata'
import { Controller, Post, Param, Body, Inject, HttpCode } from '@nestjs/common'
import { UpdateProfileService } from '../../services/update-profile/index.js'
import { RunReviewInput } from './update-profile.input.js'

@Controller('profile')
export class UpdateProfileController {
  constructor(
    @Inject(UpdateProfileService) private readonly service: UpdateProfileService,
  ) {}

  /** Run an AI code review for a PR using this profile's skills and preferences. */
  @Post(':profileId/review')
  @HttpCode(201)
  async review(
    @Param('profileId') profileId: string,
    @Body() body: RunReviewInput,
  ) {
    return this.service.runReview({
      profileId,
      owner: body.owner,
      repo: body.repo,
      pullNumber: body.pullNumber,
      post: body.post,
    })
  }

  /** Regenerate preferences for this profile based on stored activity. */
  @Post(':profileId/preferences/generate')
  @HttpCode(201)
  async generatePreferences(@Param('profileId') profileId: string) {
    return this.service.generatePreferences({ profileId })
  }
}
