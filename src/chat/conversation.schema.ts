import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage?: Types.ObjectId;

  @Prop({ default: Date.now })
  lastActivity: Date;

  @Prop({ type: Map, of: Number, default: {} })
  unreadCount: Map<string, number>; // userId -> unread count

  @Prop({ type: Map, of: Date })
  leftAt: Map<string, Date>; // userId -> timestamp when they left the conversation

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isGroup: boolean;

  @Prop({ type: String })
  groupName?: string;

  @Prop({ default: false })
  hasUrgentMessage: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  urgentMessageSender?: Types.ObjectId;

  @Prop({ default: false })
  hasRepliedToInitialMessage: boolean;

  @Prop({ type: Boolean })
  firstMessageWasUrgent?: boolean;

  @Prop({ type: Date })
  lastAutoReplyAt?: Date; // Track when the last AI auto-reply was sent

  createdAt?: Date;
  updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);