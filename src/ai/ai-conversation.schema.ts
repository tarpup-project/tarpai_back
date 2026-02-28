import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

@Schema({ timestamps: true })
export class AIConversation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [Object], default: [] })
  messages: AIMessage[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastMessageAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AIConversationSchema = SchemaFactory.createForClass(AIConversation);
