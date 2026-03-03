import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AiService } from './ai.service';
import { LinkPreviewService } from './link-preview.service';
import { Conversation, ConversationSchema } from './conversation.schema';
import { Message, MessageSchema } from './message.schema';
import { User, UserSchema } from '../users/user.schema';
import { CloudinaryService } from '../users/cloudinary.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailService } from '../auth/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
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
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CloudinaryService, EmailService, AiService, LinkPreviewService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}