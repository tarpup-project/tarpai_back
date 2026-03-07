import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { Status, StatusSchema } from './status.schema';
import { User, UserSchema } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';
import { LinkPreviewService } from '../chat/link-preview.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Status.name, schema: StatusSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StatusController],
  providers: [StatusService, CloudinaryService, LinkPreviewService],
})
export class StatusModule {}