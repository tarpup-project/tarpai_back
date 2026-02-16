import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Broadcast extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true, maxlength: 500 })
  message: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  recipients: Types.ObjectId[];

  @Prop({ default: 0 })
  recipientCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BroadcastSchema = SchemaFactory.createForClass(Broadcast);
