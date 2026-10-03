import { Controller, Get, Param, Post, Body, Req, Res, UseGuards, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AuthUser, RequestWithUser } from '../common/constants';
import { AskProductDto } from './dto/ask-product.dto';
import { KnowledgeService } from './knowledge.service';

@Controller()
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post('products/:id/video')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  uploadVideo(@Param('id') id: string, @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined, @Req() request: RequestWithUser) {
    return this.knowledge.uploadVideo(id, file, request.user as AuthUser);
  }

  @Post('products/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(@Param('id') id: string, @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined, @Req() request: RequestWithUser) {
    return this.knowledge.uploadImage(id, file, request.user as AuthUser);
  }

  @Get('products/:id/knowledge-files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'reviewer')
  listKnowledge(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.knowledge.listKnowledgeFiles(id, request.user as AuthUser).then((items) => ({ items }));
  }

  @Post('products/:id/knowledge-files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 1024 * 1024 } }))
  uploadKnowledge(@Param('id') id: string, @UploadedFiles() files: { originalname: string; mimetype: string; size: number; buffer: Buffer }[] | undefined, @Req() request: RequestWithUser) {
    return this.knowledge.uploadKnowledgeBatch(id, files, request.user as AuthUser).then((items) => ({ items }));
  }

  @Post('products/:id/knowledge-files/:fileId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  confirmKnowledge(@Param('id') id: string, @Param('fileId') fileId: string, @Req() request: RequestWithUser) {
    return this.knowledge.confirmKnowledge(id, fileId, request.user as AuthUser);
  }

  @Post('products/:id/knowledge-files/:fileId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  verifyKnowledge(@Param('id') id: string, @Param('fileId') fileId: string, @Req() request: RequestWithUser) {
    return this.knowledge.verifyKnowledge(id, fileId, request.user as AuthUser);
  }

  @Get('knowledge-files/:fileId')
  async downloadKnowledge(@Param('fileId') fileId: string, @Res() response: Response) {
    const file = await this.knowledge.publicKnowledgeFile(fileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    const stream = await this.knowledge.createMediaStream(file);
    stream.on('error', () => { if (!response.headersSent) response.status(404).json({ error: { code: 'KNOWLEDGE_FILE_NOT_FOUND', message: '资料文件不存在' } }); });
    stream.pipe(response);
  }

  @Get('media/:mediaId')
  async downloadMedia(@Param('mediaId') mediaId: string, @Req() request: Request, @Res() response: Response) {
    const media = await this.knowledge.publicMedia(mediaId);
    const size = await this.knowledge.mediaSize(media);
    if (!size) return response.status(404).json({ error: { code: 'MEDIA_FILE_EMPTY', message: '视频文件为空' } });
    const range = request.headers.range;
    let start = 0;
    let end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return response.status(416).set('Content-Range', `bytes */${size}`).end();
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!suffix || !Number.isSafeInteger(suffix)) return response.status(416).set('Content-Range', `bytes */${size}`).end();
        start = Math.max(0, size - suffix);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Number(match[2]);
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return response.status(416).set('Content-Range', `bytes */${size}`).end();
      end = Math.min(end, size - 1);
      response.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', end - start + 1);
    const stream = await this.knowledge.createMediaStream(media, { start, end });
    stream.on('error', () => { if (!response.headersSent) response.status(404).json({ error: { code: 'MEDIA_NOT_FOUND', message: '视频文件不存在' } }); });
    stream.pipe(response);
  }

  @Post('brands/:brandSlug/products/:productSlug/chat')
  ask(@Param('brandSlug') brandSlug: string, @Param('productSlug') productSlug: string, @Body() dto: AskProductDto) {
    return this.knowledge.ask(brandSlug, productSlug, dto.question);
  }
}
