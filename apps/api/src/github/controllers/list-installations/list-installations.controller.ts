import 'reflect-metadata'
import { Controller, Get, Inject } from '@nestjs/common'
import type { SafeInstallation } from '../../infrastructure/persistence/installation.repository.js'
import { ListInstallationsService } from '../../services/list-installations.service.js'

/** `GET /api/installations` */
@Controller()
export class ListInstallationsController {
  constructor(
    @Inject(ListInstallationsService) private readonly service: ListInstallationsService,
  ) {}

  @Get('api/installations')
  listInstallations(): Promise<SafeInstallation[]> {
    return this.service.execute()
  }
}
