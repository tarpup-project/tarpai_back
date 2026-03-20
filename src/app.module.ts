import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FollowsModule } from './follows/follows.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppearanceModule } from './appearance/appearance.module';
import { ChannelsModule } from './channels/channels.module';
import { StatusModule } from './status/status.module';
import { SupportModule } from './support/support.module';
import { ChatModule } from './chat/chat.module';
import { AIModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    FollowsModule,
    BroadcastsModule,
    NotificationsModule,
    AppearanceModule,
    ChannelsModule,
    StatusModule,
    SupportModule,
    ChatModule,
    AIModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
