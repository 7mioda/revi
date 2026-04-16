import 'reflect-metadata'
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import { ReviewsService } from './reviews.service.js'
import { CreateReviewDto } from './dto/create-review.dto.js'
import type { ReviewResponse } from './reviews.service.js'

@Controller('reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(201)
  async review(@Body() dto: CreateReviewDto): Promise<ReviewResponse> {
    return this.reviewsService.review(dto)
  }
}
