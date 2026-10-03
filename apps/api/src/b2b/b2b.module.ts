import { Module } from '@nestjs/common';
import { B2bController } from './b2b.controller';
import { B2bService } from './b2b.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [B2bController], providers: [B2bService] })
export class B2bModule {}
