import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, UseInterceptors, UploadedFiles, UploadedFile, Headers } from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { StatusService } from './status.service';

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly jwtService: JwtService,
  ) {}

  // Create status
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10)) // Allow up to 10 images
  async createStatus(
    @Body() body: { content: string },
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
  ) {
    return this.statusService.createStatus(req.user.id, body.content, files);
  }

  // Create status with single image (backward compatibility)
  @Post('single')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async createStatusSingle(
    @Body() body: { content: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    const files = file ? [file] : [];
    return this.statusService.createStatus(req.user.id, body.content, files);
  }

  // Get my statuses
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyStatuses(@Req() req) {
    return this.statusService.getMyStatuses(req.user.id);
  }

  // Get statuses from people I follow (feed)
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFollowingStatuses(@Req() req) {
    return this.statusService.getFollowingStatuses(req.user.id);
  }

  // Get all statuses (public feed)
  @Get('all')
  async getAllStatuses(@Headers('authorization') auth?: string) {
    let userId: string | undefined;

    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7);
        const decoded = this.jwtService.verify(token);
        userId = decoded.id;
      } catch (error) {
        userId = undefined;
      }
    }

    return this.statusService.getAllStatuses(userId);
  }

  // Get single status
  @Get(':id')
  async getStatus(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    let userId: string | undefined;

    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7);
        const decoded = this.jwtService.verify(token);
        userId = decoded.id;
      } catch (error) {
        userId = undefined;
      }
    }

    return this.statusService.getStatus(id, userId);
  }

  // Like/Unlike status
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  likeStatus(@Param('id') id: string, @Req() req) {
    return this.statusService.likeStatus(id, req.user.id);
  }

  // Add comment to status
  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Req() req,
  ) {
    return this.statusService.addComment(id, req.user.id, body.content);
  }

  // Update status
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10)) // Allow up to 10 images
  updateStatus(
    @Param('id') id: string,
    @Body() body: { content?: string },
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
  ) {
    return this.statusService.updateStatus(id, req.user.id, body.content, files);
  }

  // Delete status
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteStatus(@Param('id') id: string, @Req() req) {
    return this.statusService.deleteStatus(id, req.user.id);
  }
}