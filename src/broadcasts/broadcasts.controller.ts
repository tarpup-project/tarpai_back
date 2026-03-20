import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BroadcastsService } from './broadcasts.service';

@Controller('broadcasts')
@UseGuards(AuthGuard('jwt'))
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  async sendBroadcast(@Body() body: { message: string; title?: string; actionUrl?: string; actionLabel?: string }, @Req() req) {
    const richMessage = body.title || body.actionUrl || body.actionLabel ? {
      title: body.title,
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel
    } : undefined;
    
    return this.broadcastsService.sendBroadcast(req.user.id, body.message, richMessage);
  }

  @Post('selected')
  async sendBroadcastToSelected(
    @Body() body: { message: string; userIds: string[]; title?: string; actionUrl?: string; actionLabel?: string },
    @Req() req,
  ) {
    const richMessage = body.title || body.actionUrl || body.actionLabel ? {
      title: body.title,
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel
    } : undefined;
    
    return this.broadcastsService.sendBroadcastToSelected(
      req.user.id,
      body.message,
      body.userIds,
      richMessage,
    );
  }

  @Get()
  async getMyBroadcasts(@Req() req) {
    return this.broadcastsService.getUserBroadcasts(req.user.id);
  }

  @Get('received')
  async getReceivedBroadcasts(@Req() req) {
    return this.broadcastsService.getReceivedBroadcasts(req.user.id);
  }

  @Post('admin')
  async sendAdminBroadcast(
    @Body() body: { message: string; title?: string; actionUrl?: string; actionLabel?: string; userIds?: string[] },
    @Req() req,
  ) {
    const richMessage = body.title || body.actionUrl || body.actionLabel ? {
      title: body.title,
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel
    } : undefined;
    
    return this.broadcastsService.sendAdminBroadcast(
      req.user.id,
      body.message,
      richMessage,
      body.userIds,
    );
  }

  @Delete(':id')
  async deleteBroadcast(@Param('id') id: string, @Req() req) {
    return this.broadcastsService.deleteBroadcast(id, req.user.id);
  }
}
