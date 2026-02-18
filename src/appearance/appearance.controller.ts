import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Headers, UnauthorizedException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppearanceService } from './appearance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Controller('appearance')
export class AppearanceController {
  constructor(
    private readonly appearanceService: AppearanceService,
    private readonly jwtService: JwtService,
  ) {}

  // Get backgrounds (no auth required, but returns more if authenticated)
  @Get('backgrounds')
  async getBackgrounds(@Headers('authorization') auth?: string) {
    let userId: string | undefined;

    // Try to extract userId from JWT token if provided
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7);
        const decoded = this.jwtService.verify(token);
        userId = decoded.id; // JWT uses 'id' not 'userId'
      } catch (error) {
        // Invalid token, just return admin backgrounds
        userId = undefined;
      }
    }

    return this.appearanceService.getBackgrounds(userId);
  }

  // Admin adds background for all users
  @Post('backgrounds/admin')
  addAdminBackground(
    @Body() body: { url: string; name?: string; thumbnail?: string; adminKey: string },
  ) {
    return this.appearanceService.addAdminBackground(
      body.url, 
      body.name, 
      body.thumbnail,
      body.adminKey
    );
  }

  // User adds their own background (requires auth)
  @UseGuards(JwtAuthGuard)
  @Post('backgrounds')
  addUserBackground(
    @Request() req,
    @Body() body: { url: string; name?: string; thumbnail?: string },
  ) {
    return this.appearanceService.addUserBackground(
      req.user.id, // JWT strategy uses 'id' not 'userId'
      body.url,
      body.name,
      body.thumbnail
    );
  }

  // Upload background image (requires auth)
  @UseGuards(JwtAuthGuard)
  @Post('backgrounds/upload')
  @UseInterceptors(FileInterceptor('background'))
  async uploadBackground(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.appearanceService.uploadUserBackground(req.user.id, file);
  }

  // Update background (requires auth for user backgrounds, adminKey for admin backgrounds)
  @Put('backgrounds/:id')
  async updateBackground(
    @Param('id') id: string,
    @Body() body: { url?: string; name?: string; thumbnail?: string; adminKey?: string },
    @Headers('authorization') auth?: string,
  ) {
    let userId: string | undefined;

    // Try to extract userId from JWT token if provided
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7);
        const decoded = this.jwtService.verify(token);
        userId = decoded.id;
      } catch (error) {
        userId = undefined;
      }
    }

    return this.appearanceService.updateBackground(id, body, userId, body.adminKey);
  }

  // Delete background (requires auth for user backgrounds, adminKey for admin backgrounds)
  @Delete('backgrounds/:id')
  async deleteBackground(
    @Param('id') id: string,
    @Body() body: { adminKey?: string },
    @Headers('authorization') auth?: string,
  ) {
    let userId: string | undefined;

    // Try to extract userId from JWT token if provided
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7);
        const decoded = this.jwtService.verify(token);
        userId = decoded.id;
      } catch (error) {
        userId = undefined;
      }
    }

    return this.appearanceService.deleteBackground(id, userId, body.adminKey);
  }

  // Delete all backgrounds (requires adminKey)
  @Delete('backgrounds')
  async deleteAllBackgrounds(@Body() body: { adminKey: string }) {
    if (!body.adminKey) {
      throw new UnauthorizedException('Admin key is required');
    }
    return this.appearanceService.deleteAllBackgrounds(body.adminKey);
  }
}
