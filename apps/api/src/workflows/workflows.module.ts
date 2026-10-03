import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowCallbackController } from './workflow-callback.controller';
import { WorkflowsService } from './workflows.service';
import { PixelleVideoProvider } from './workflow-provider';
import { WorkflowCallbackGuard } from './workflow-callback.guard';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [WorkflowsController, WorkflowCallbackController], providers: [WorkflowsService, PixelleVideoProvider, WorkflowCallbackGuard], exports: [WorkflowsService] })
export class WorkflowsModule {}
