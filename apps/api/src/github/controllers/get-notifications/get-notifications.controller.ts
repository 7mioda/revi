import 'reflect-metadata'
import { Controller, Get, Param, ParseIntPipe, Inject } from '@nestjs/common'
import { GetUserNotificationsService } from '../../services/get-user-notifications.service.js'

/** `GET /api/users/:userId/notifications` */
@Controller()
export class GetNotificationsController {
  constructor(
    @Inject(GetUserNotificationsService) private readonly service: GetUserNotificationsService,
  ) {}

  @Get('api/users/:userId/notifications')
  getUserNotifications(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<unknown[]> {
    return this.service.execute(userId)
  }
}
