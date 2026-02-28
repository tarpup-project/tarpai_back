import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIController } from './ai.controller';
import { AIChatService } from './ai-chat.service';
import { ReminderService } from './reminder.service';
import { AIConversation, AIConversationSchema } from './ai-conversation.schema';
import { Reminder, ReminderSchema } from './reminder.schema';
import { User, UserSchema } from '../users/user.schema';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AIConversation.name, schema: AIConversationSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AIController],
  providers: [AIChatService, ReminderService],
  exports: [AIChatService, ReminderService],
})
export class AIModule {}
