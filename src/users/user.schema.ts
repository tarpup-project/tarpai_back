import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true, sparse: true })
  username: string;

  @Prop()
  displayName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verificationCode: string;

  @Prop()
  verificationCodeExpires: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followers: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  following: Types.ObjectId[];

  @Prop()
  bio: string;

  @Prop({ default: 'https://res.cloudinary.com/dhjzwncjf/image/upload/v1771255225/Screenshot_2026-02-16_at_4.20.04_pm_paes1n.png' })
  avatar: string;

  @Prop({ default: false })
  isSilentSignup: boolean;

  @Prop()
  silentSignupSource: string; // 'profile_follow', 'profile_followers', 'profile_following', 'profile_tarpup'

  @Prop()
  silentSignupReferrer: Types.ObjectId; // The user whose profile they were viewing

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
