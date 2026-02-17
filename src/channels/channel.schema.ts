import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Channel extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  subtitle: string;

  @Prop({ required: true })
  avatar: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  subscribers: Types.ObjectId[];

  @Prop({ default: 0 })
  subscribersCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
