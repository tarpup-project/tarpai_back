import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getMyNotifications(
    @Req() req, 
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationsService.getMyNotifications(req.user.id, limit, offset);
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard('jwt'))
  async markAsRead(@Param('id') id: string, @Req() req) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @UseGuards(AuthGuard('jwt'))
  async markAllAsRead(@Req() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteNotification(@Param('id') id: string, @Req() req) {
    return this.notificationsService.deleteNotification(req.user.id, id);
  }

  @Post('admin/broadcast')
  async sendAdminBroadcast(
    @Body() body: {
      title: string;
      message: string;
      userIds?: string[];
      actionUrl?: string;
      actionLabel?: string;
    },
  ) {
    const recipientIds = body.userIds || [];
    
    await this.notificationsService.createAdminNotification(
      recipientIds,
      body.title,
      body.message,
      body.actionUrl,
      body.actionLabel,
    );

    return {
      message: 'Admin broadcast sent successfully',
      recipientCount: recipientIds.length > 0 ? recipientIds.length : 'all users',
      title: body.title,
    };
  }
}
