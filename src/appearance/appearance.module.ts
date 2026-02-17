import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppearanceController } from './appearance.controller';
import { AppearanceService } from './appearance.service';
import { Background, BackgroundSchema } from './background.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Background.name, schema: BackgroundSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppearanceController],
  providers: [AppearanceService],
})
export class AppearanceModule {}
