import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ProfileVisit, ProfileVisitSchema } from './profile-visit.schema';
import { ImportantMessage, ImportantMessageSchema } from './important-message.schema';
import { User, UserSchema } from '../users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProfileVisit.name, schema: ProfileVisitSchema },
      { name: ImportantMessage.name, schema: ImportantMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}