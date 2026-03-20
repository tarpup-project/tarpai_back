import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ImportantMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  urgencyKeywords: string[]; // Keywords that triggered the urgency detection

  @Prop({ default: 'ai_detected' })
  detectionMethod: string; // 'ai_detected', 'manual', 'keyword_match'

  @Prop({ default: false })
  emailSent: boolean; // Whether an email notification was sent

  @Prop({ default: false })
  autoReplyGenerated: boolean; // Whether an auto-reply was generated

  createdAt?: Date;
  updatedAt?: Date;
}

export const ImportantMessageSchema = SchemaFactory.createForClass(ImportantMessage);