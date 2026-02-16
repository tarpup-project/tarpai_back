import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';
import { Broadcast, BroadcastSchema } from './broadcast.schema';
import { User, UserSchema } from '../users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Broadcast.name, schema: BroadcastSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
})
export class BroadcastsModule {}
