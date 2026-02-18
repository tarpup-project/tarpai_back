import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CloudinaryService } from './cloudinary.service';
import { User, UserSchema } from './user.schema';
import { Link, LinkSchema } from './link.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Link.name, schema: LinkSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, CloudinaryService],
})
export class UsersModule {}
