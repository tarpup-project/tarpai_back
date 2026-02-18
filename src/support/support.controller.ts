import { Controller, Get, Post, Body, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly jwtService: JwtService,
  ) {}

  // Submit feedback
  @Post('feedback')
  async submitFeedback(
    @Body() body: { rating: number; message: string; email?: string },
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

    return this.supportService.submitFeedback(
      body.rating,
      body.message,
      userId,
      body.email,
    );
  }

  // Get all feedback (admin only)
  @Get('feedback')
  getAllFeedback() {
    return this.supportService.getAllFeedback();
  }

  // Get help articles
  @Get('help')
  getHelpArticles() {
    return this.supportService.getHelpArticles();
  }

  // Get single help article
  @Get('help/:id')
  getHelpArticle(@Param('id') id: string) {
    return this.supportService.getHelpArticle(id);
  }

  // Create help article (admin only)
  @Post('help')
  createHelpArticle(
    @Body() body: {
      title: string;
      content: string;
      category: string;
      order?: number;
    },
  ) {
    return this.supportService.createHelpArticle(
      body.title,
      body.content,
      body.category,
      body.order,
    );
  }

  // Get release notes (What's New)
  @Get('releases')
  getReleaseNotes() {
    return this.supportService.getReleaseNotes();
  }

  // Get single release note
  @Get('releases/:id')
  getReleaseNote(@Param('id') id: string) {
    return this.supportService.getReleaseNote(id);
  }

  // Create release note (admin only)
  @Post('releases')
  createReleaseNote(
    @Body() body: {
      version: string;
      title: string;
      features: string[];
      bugFixes?: string[];
      improvements?: string[];
      releaseDate: string;
    },
  ) {
    return this.supportService.createReleaseNote(
      body.version,
      body.title,
      body.features,
      body.bugFixes,
      body.improvements,
      new Date(body.releaseDate),
    );
  }

  // Contact support
  @Post('contact')
  @UseGuards(JwtAuthGuard)
  contactSupport(
    @Body() body: { subject: string; message: string },
    @Req() req,
  ) {
    return this.supportService.contactSupport(
      req.user.id,
      body.subject,
      body.message,
    );
  }

  // Seed initial data (admin only)
  @Post('seed')
  seedInitialData() {
    return this.supportService.seedInitialData();
  }
}