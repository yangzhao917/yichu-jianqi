import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowEvidenceDto } from './dto/workflow-evidence.dto';
import { WorkflowCallbackGuard } from './workflow-callback.guard';

@Controller('workflows')
export class WorkflowCallbackController {
  constructor(@Inject(WorkflowsService) private readonly workflows: WorkflowsService) {}

  @Post(':id/steps/:stepKey/evidence')
  @UseGuards(WorkflowCallbackGuard)
  recordEvidence(@Param('id') id: string, @Param('stepKey') stepKey: string, @Body() dto: WorkflowEvidenceDto) {
    return this.workflows.recordEvidence(id, stepKey, dto);
  }
}
