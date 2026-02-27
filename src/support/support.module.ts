import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { Feedback, FeedbackSchema } from './feedback.schema';
import { HelpArticle, HelpArticleSchema } from './help-article.schema';
import { ReleaseNote, ReleaseNoteSchema } from './release-note.schema';
import { Lead, LeadSchema } from './lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: HelpArticle.name, schema: HelpArticleSchema },
      { name: ReleaseNote.name, schema: ReleaseNoteSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
