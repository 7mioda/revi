import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module.js'

/** Bootstraps the NestJS HTTP server. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const port = process.env['PORT'] !== undefined ? parseInt(process.env['PORT'], 10) : 3000
  await app.listen(port)
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start application:', err)
  process.exit(1)
})
