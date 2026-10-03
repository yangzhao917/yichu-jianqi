import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { CollectionsModule } from './collections/collections.module';
import { ContentModule } from './content/content.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SettingsModule } from './settings/settings.module';
import { B2bModule } from './b2b/b2b.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }), PrismaModule, AuthModule, HealthModule, CollectionsModule, ContentModule, WorkflowsModule, SettingsModule, B2bModule, KnowledgeModule],
})
export class AppModule {}
