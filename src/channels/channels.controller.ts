import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly jwtService: JwtService,
  ) {}

  // Create channel
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  createChannel(
    @Body() body: { title: string; subtitle: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.channelsService.createChannel(req.user.id, body, file);
  }

  // Get all channels
  @Get()
  async getAllChannels(@Headers('authorization') auth?: string) {
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

    return this.channelsService.getChannels(userId);
  }

  // Get my channels
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyChannels(@Req() req) {
    return this.channelsService.getMyChannels(req.user.id);
  }

  // Get single channel
  @Get(':id')
  async getChannel(
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

    return this.channelsService.getChannel(id, userId);
  }

  // Subscribe to channel
  @Post(':id/subscribe')
  @UseGuards(JwtAuthGuard)
  subscribeToChannel(@Param('id') id: string, @Req() req) {
    return this.channelsService.subscribeToChannel(id, req.user.id);
  }

  // Unsubscribe from channel
  @Delete(':id/subscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribeFromChannel(@Param('id') id: string, @Req() req) {
    return this.channelsService.unsubscribeFromChannel(id, req.user.id);
  }

  // Update channel
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  updateChannel(
    @Param('id') id: string,
    @Body() body: { title?: string; subtitle?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.channelsService.updateChannel(id, req.user.id, body, file);
  }

  // Delete channel
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteChannel(@Param('id') id: string, @Req() req) {
    return this.channelsService.deleteChannel(id, req.user.id);
  }

  // Create post in channel
  @Post(':id/posts')
  @UseGuards(JwtAuthGuard)
  createPost(
    @Param('id') channelId: string,
    @Body() body: { content: string },
    @Req() req,
  ) {
    return this.channelsService.createPost(channelId, req.user.id, body.content);
  }

  // Get channel posts
  @Get(':id/posts')
  async getChannelPosts(
    @Param('id') channelId: string,
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

    return this.channelsService.getChannelPosts(channelId, userId);
  }

  // Like post
  @Post('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  likePost(@Param('postId') postId: string, @Req() req) {
    return this.channelsService.likePost(postId, req.user.id);
  }

  // Unlike post
  @Delete('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  unlikePost(@Param('postId') postId: string, @Req() req) {
    return this.channelsService.unlikePost(postId, req.user.id);
  }

  // Delete post
  @Delete('posts/:postId')
  @UseGuards(JwtAuthGuard)
  deletePost(@Param('postId') postId: string, @Req() req) {
    return this.channelsService.deletePost(postId, req.user.id);
  }
}
