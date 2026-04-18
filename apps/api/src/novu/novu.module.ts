import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NovuService } from './novu.service.js'

@Module({
  providers: [NovuService],
  exports: [NovuService],
})
export class NovuModule {}
