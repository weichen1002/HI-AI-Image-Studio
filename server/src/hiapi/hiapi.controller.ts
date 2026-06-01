import { Controller, Get } from '@nestjs/common';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';
import { getModelCapabilities } from './model-capabilities';

@Controller('api/hiapi')
export class HiapiController {
  constructor(private readonly settingsRepo: SystemSettingsRepo) {}

  @Get('capabilities')
  getCapabilities() {
    return {
      capabilities: getModelCapabilities(this.settingsRepo.getModelSettings()),
    };
  }
}
