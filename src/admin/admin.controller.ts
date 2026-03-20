import { Controller, Get, Post, Delete, Put, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('recent-signups')
  async getRecentSignups() {
    return this.adminService.getRecentSignups();
  }

  @Post('users/:userId/reset-broadcast-privileges')
  async resetUserBroadcastPrivileges(@Param('userId') userId: string) {
    return this.adminService.resetUserBroadcastPrivileges(userId);
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUserCompletely(userId);
  }

  @Get('dashboard')
  async getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('analytics/users')
  async getUserAnalytics() {
    return this.adminService.getUserAnalytics();
  }

  @Get('analytics/first-time-messages')
  async getFirstTimeMessagesAnalytics() {
    return this.adminService.getFirstTimeMessagesAnalytics();
  }

  @Get('analytics/ai-messages')
  async getAIMessagesAnalytics() {
    return this.adminService.getAIMessagesAnalytics();
  }

  @Get('analytics/feedback')
  async getFeedbackAnalytics() {
    return this.adminService.getFeedbackAnalytics();
  }

  @Get('analytics/broadcasts')
  async getBroadcastAnalytics() {
    return this.adminService.getBroadcastAnalytics();
  }

  @Get('analytics/important-messages')
  async getImportantMessageAnalytics() {
    return this.adminService.getImportantMessageAnalytics();
  }

  @Get('analytics/profile-visits')
  async getProfileVisitAnalytics() {
    return this.adminService.getProfileVisitAnalytics();
  }

  // Appearance Management Endpoints
  @Get('backgrounds')
  async getAllBackgrounds() {
    return this.adminService.getAllBackgrounds();
  }

  @Get('backgrounds/stats')
  async getBackgroundStats() {
    return this.adminService.getBackgroundStats();
  }

  @Post('backgrounds')
  async createAdminBackground(@Body() body: { url: string; name?: string; thumbnail?: string }) {
    return this.adminService.createAdminBackground(body.url, body.name, body.thumbnail);
  }

  @Post('backgrounds/upload')
  @UseInterceptors(FileInterceptor('background'))
  async uploadAdminBackground(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string }
  ) {
    return this.adminService.uploadAdminBackground(file, body.name);
  }

  @Put('backgrounds/:id')
  async updateBackground(
    @Param('id') id: string,
    @Body() body: { url?: string; name?: string; thumbnail?: string; isActive?: boolean }
  ) {
    return this.adminService.updateBackground(id, body);
  }

  @Delete('backgrounds/:id')
  async deleteBackground(@Param('id') id: string) {
    return this.adminService.deleteBackground(id);
  }
}