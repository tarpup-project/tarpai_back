import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, UseInterceptors, UploadedFile, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post('profile/setup')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
  async setupProfile(
    @Body() body: { username: string; displayName: string; bio: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.usersService.setupProfile(req.user.id, body, file);
  }

  @Patch('profile/info')
  @UseGuards(AuthGuard('jwt'))
  async updateProfileInfo(
    @Body() body: { username?: string; displayName?: string; bio?: string },
    @Req() req,
  ) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    return this.usersService.updateProfile(req.user.id, {}, file);
  }

  @Put('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(
    @Body() body: { username?: string; displayName?: string; bio?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.usersService.updateProfile(req.user.id, body, file);
  }

  @Get('profile/me')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Req() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get('profile/share')
  @UseGuards(AuthGuard('jwt'))
  async getProfileShareData(@Req() req) {
    return this.usersService.getProfileShareData(req.user.id);
  }

  @Get('profile/qrcode')
  @UseGuards(AuthGuard('jwt'))
  async getProfileQRCode(@Req() req) {
    const qrCode = await this.usersService.generateProfileQRCode(req.user.id);
    return { qrCode };
  }

  @Post()
  create(@Body() createUserDto: any) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: any) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
