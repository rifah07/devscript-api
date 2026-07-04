import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export enum ReportReason {
  SPAM = 'spam',
  INAPPROPRIATE = 'inappropriate',
  MISINFORMATION = 'misinformation',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

@Schema({ timestamps: true })
export class Report {
  // Who filed the report
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare reporter: Types.ObjectId;

  // What is being reported
  @Prop({ type: Types.ObjectId, required: true })
  declare targetId: Types.ObjectId;

  @Prop({ enum: ReportTargetType, required: true })
  declare targetType: ReportTargetType;

  @Prop({ enum: ReportReason, required: true })
  declare reason: ReportReason;

  @Prop({ default: '', maxlength: 500 })
  declare description: string;

  @Prop({ enum: ReportStatus, default: ReportStatus.PENDING, index: true })
  declare status: ReportStatus;

  // Admin who reviewed this report
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  declare reviewedBy: Types.ObjectId | null;

  @Prop({ default: '' })
  declare adminNote: string;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Most common query: pending reports, oldest first (FIFO review)
ReportSchema.index({ status: 1, createdAt: 1 });

// Prevent same user reporting same content twice
ReportSchema.index({ reporter: 1, targetId: 1 }, { unique: true });
