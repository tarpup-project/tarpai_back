import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Feedback extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user?: Types.ObjectId;

  @Prop()
  email?: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'pending', enum: ['pending', 'reviewed', 'resolved'] })
  status: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);