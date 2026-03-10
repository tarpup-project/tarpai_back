import { Controller, Post, Get, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(AuthGuard('jwt'))
  async followUser(@Param('userId') userId: string, @Req() req) {
    return this.followsService.followUser(req.user.id, userId);
  }

  @Delete(':userId')
  @UseGuards(AuthGuard('jwt'))
  async unfollowUser(@Param('userId') userId: string, @Req() req) {
    return this.followsService.unfollowUser(req.user.id, userId);
  }

  @Get('followers')
  @UseGuards(AuthGuard('jwt'))
  async getFollowers(@Req() req) {
    return this.followsService.getFollowers(req.user.id);
  }

  @Get('following')
  @UseGuards(AuthGuard('jwt'))
  async getFollowing(@Req() req) {
    return this.followsService.getFollowing(req.user.id);
  }

  // Public endpoints - no auth required
  @Get('followers/:userId')
  async getUserFollowers(@Param('userId') userId: string) {
    return this.followsService.getFollowers(userId);
  }

  @Get('following/:userId')
  async getUserFollowing(@Param('userId') userId: string) {
    return this.followsService.getFollowing(userId);
  }
}
