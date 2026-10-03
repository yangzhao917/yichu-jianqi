import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeepSeekProvider } from './deepseek.provider';
import { KnowledgeController } from './knowledge.controller';
import { AliyunOpenSearchProvider, KnowledgeService } from './knowledge.service';

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AliyunOpenSearchProvider, DeepSeekProvider],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
