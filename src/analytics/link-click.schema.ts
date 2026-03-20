import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class LinkClick extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Link', required: true })
  linkId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  linkOwner: Types.ObjectId; // The user who owns the link

  @Prop({ type: Types.ObjectId, ref: 'User' })
  clickedBy?: Types.ObjectId; // The user who clicked (null for anonymous)

  @Prop({ required: true })
  url: string; // The actual URL that was clicked

  @Prop()
  title: string; // The link title

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  referrer?: string;

  @Prop({ default: 'web' })
  platform: string; // 'web', 'mobile', etc.

  createdAt?: Date;
  updatedAt?: Date;
}

export const LinkClickSchema = SchemaFactory.createForClass(LinkClick);