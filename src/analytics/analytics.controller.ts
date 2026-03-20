import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track-profile-visit')
  async trackProfileVisit(
    @Body() body: { username: string; visitorId?: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referer');

    return this.analyticsService.trackProfileVisit(
      body.username,
      body.visitorId,
      ipAddress,
      userAgent,
      referrer,
    );
  }

  @Get('important-messages')
  @UseGuards(JwtAuthGuard)
  async getImportantMessageAnalytics() {
    return this.analyticsService.getImportantMessageAnalytics();
  }

  @Get('profile-visits')
  @UseGuards(JwtAuthGuard)
  async getProfileVisitAnalytics() {
    return this.analyticsService.getProfileVisitAnalytics();
  }
}