import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Reminder extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  scheduledFor: Date;

  @Prop({ default: false })
  sent: boolean;

  @Prop()
  sentAt: Date;

  @Prop({ default: 'pending' })
  status: string; // pending, sent, failed
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
