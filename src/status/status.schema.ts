import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

@Schema({ timestamps: true })
export class Status extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop()
  content?: string;

  @Prop()
  image?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ default: 0 })
  likesCount: number;

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop({ default: 0 })
  commentsCount: number;

  // Repost fields
  @Prop({ type: Types.ObjectId, ref: 'Status' })
  originalStatus?: Types.ObjectId;

  @Prop({ default: false })
  isRepost: boolean;

  @Prop()
  repostContent?: string; // Additional content added by reposter

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  reposts: Types.ObjectId[];

  @Prop({ default: 0 })
  repostsCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StatusSchema = SchemaFactory.createForClass(Status);