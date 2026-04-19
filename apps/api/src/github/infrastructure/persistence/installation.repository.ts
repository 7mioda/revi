import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Installation } from './schemas/installation.schema.js'
import type { InstallationDocument } from './schemas/installation.schema.js'

export interface SafeInstallation {
  installationId: number
  accountLogin: string
  accountType: string
  createdAt: Date
}

@Injectable()
export class InstallationRepository {
  constructor(
    @InjectModel(Installation.name)
    private readonly model: Model<InstallationDocument>,
  ) {}

  async upsert(
    installationId: number,
    accountLogin: string,
    accountType: string,
    rawJson: Record<string, unknown>,
  ): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { installationId },
        { installationId, accountLogin, accountType, rawJson },
        { upsert: true, new: true },
      )
      .exec()
  }

  async remove(installationId: number): Promise<void> {
    await this.model.deleteOne({ installationId }).exec()
  }

  async list(): Promise<SafeInstallation[]> {
    const docs = await this.model.find({}, { rawJson: 0 }).lean().exec()
    return docs.map((doc) => ({
      installationId: doc.installationId,
      accountLogin: doc.accountLogin,
      accountType: doc.accountType,
      createdAt: doc.createdAt,
    }))
  }
}
