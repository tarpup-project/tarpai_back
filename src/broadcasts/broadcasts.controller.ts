import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BroadcastsService } from './broadcasts.service';

@Controller('broadcasts')
@UseGuards(AuthGuard('jwt'))
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  async sendBroadcast(@Body() body: { message: string }, @Req() req) {
    return this.broadcastsService.sendBroadcast(req.user.id, body.message);
  }

  @Post('selected')
  async sendBroadcastToSelected(
    @Body() body: { message: string; userIds: string[] },
    @Req() req,
  ) {
    return this.broadcastsService.sendBroadcastToSelected(
      req.user.id,
      body.message,
      body.userIds,
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
}
