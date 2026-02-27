import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Lead extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  action?: string;

  @Prop()
  pagePath?: string;

  @Prop()
  targetUsername?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  targetUserId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
