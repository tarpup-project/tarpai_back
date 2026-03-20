import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../users/user.schema';
import { Message, MessageSchema } from '../chat/message.schema';
import { Conversation, ConversationSchema } from '../chat/conversation.schema';
import { AIConversation, AIConversationSchema } from '../ai/ai-conversation.schema';
import { Feedback, FeedbackSchema } from '../support/feedback.schema';
import { Broadcast, BroadcastSchema } from '../broadcasts/broadcast.schema';
import { Link, LinkSchema } from '../users/link.schema';
import { Status, StatusSchema } from '../status/status.schema';
import { Notification, NotificationSchema } from '../notifications/notification.schema';
import { ProfileVisit, ProfileVisitSchema } from '../analytics/profile-visit.schema';
import { ImportantMessage, ImportantMessageSchema } from '../analytics/important-message.schema';
import { Background, BackgroundSchema } from '../appearance/background.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: AIConversation.name, schema: AIConversationSchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Broadcast.name, schema: BroadcastSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Status.name, schema: StatusSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: ProfileVisit.name, schema: ProfileVisitSchema },
      { name: ImportantMessage.name, schema: ImportantMessageSchema },
      { name: Background.name, schema: BackgroundSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}