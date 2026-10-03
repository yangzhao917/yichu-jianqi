import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';

@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor', 'reviewer')
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflows: WorkflowsService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.workflows.list(request.user as AuthUser);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.workflows.get(id, request.user as AuthUser);
  }

  @Post('/products/:productId')
  @Roles('admin', 'editor')
  createProduct(@Param('productId') productId: string, @Body() dto: CreateWorkflowDto, @Req() request: RequestWithUser) {
    return this.workflows.create(productId, dto, request.user as AuthUser);
  }

  @Post('/collections/:collectionId')
  @Roles('admin', 'editor')
  create(@Param('collectionId') collectionId: string, @Body() dto: CreateWorkflowDto, @Req() request: RequestWithUser) {
    return this.workflows.create(collectionId, dto, request.user as AuthUser);
  }

  @Post(':id/retry')
  @Roles('admin', 'editor')
  retry(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.workflows.retry(id, request.user as AuthUser);
  }

  @Post(':id/steps/:stepKey/retry')
  @Roles('admin', 'editor')
  retryStep(@Param('id') id: string, @Param('stepKey') stepKey: string, @Req() request: RequestWithUser) {
    return this.workflows.retry(id, request.user as AuthUser, stepKey);
  }
}
