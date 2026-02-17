import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Background extends Document {
  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnail: string;

  @Prop()
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, enum: ['admin', 'user'], default: 'admin' })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BackgroundSchema = SchemaFactory.createForClass(Background);
