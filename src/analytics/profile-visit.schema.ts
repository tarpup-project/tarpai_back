import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ProfileVisit extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  profileOwner: Types.ObjectId; // The user whose profile was visited

  @Prop({ required: true })
  username: string; // The username that was visited (e.g., 'shipnex')

  @Prop({ type: Types.ObjectId, ref: 'User' })
  visitor?: Types.ObjectId; // The user who visited (null for anonymous)

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  referrer?: string;

  @Prop({ default: 'web' })
  platform: string; // 'web', 'mobile', etc.

  @Prop()
  country?: string;

  @Prop()
  city?: string;

  @Prop({ default: false })
  isUniqueVisit: boolean; // First time this IP/user visited this profile

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProfileVisitSchema = SchemaFactory.createForClass(ProfileVisit);