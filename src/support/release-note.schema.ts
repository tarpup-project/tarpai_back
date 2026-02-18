import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ReleaseNote extends Document {
  @Prop({ required: true })
  version: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], required: true })
  features: string[];

  @Prop({ type: [String], default: [] })
  bugFixes: string[];

  @Prop({ type: [String], default: [] })
  improvements: string[];

  @Prop({ required: true })
  releaseDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReleaseNoteSchema = SchemaFactory.createForClass(ReleaseNote);