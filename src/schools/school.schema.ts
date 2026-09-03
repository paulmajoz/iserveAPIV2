import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SchoolDocument = School & Document;

@Schema({ collection: 'schools', timestamps: true })
export class School {
  @Prop({ required: true, unique: true })
  schoolId: number;

  @Prop({ required: true })
  name: string;

  @Prop() address?: string;
  @Prop() website?: string;
  @Prop() email?: string;
  @Prop() logoPath?: string;
  @Prop() bannerImagePath?: string;
  @Prop() headerBackgroundImagePath?: string;
  @Prop() footerLogoPath?: string;

  @Prop({
    type: Object,
    default: {
      primary: '#2c698d',
      secondary: '#272643',
      accent: '#bae8e8',
      surface: '#e3f6f5',
      background: '#ffffff',
    },
  })
  themeColors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    background: string;
  };

  @Prop({ type: Object, default: { allowInOutQR: false, pointsEnabled: false } })
  featureFlags: { allowInOutQR: boolean; pointsEnabled: boolean };

  @Prop({ type: Object })
  termStartDates?: {
    first?: Date;
    second?: Date;
    third?: Date;
    endOfYear?: Date;
  };

  @Prop({ type: Object, default: {} })
  gradeTargetHours: Record<string, number>;

  @Prop({ type: Object, default: {} })
  honoursTargetHours: Record<string, number>;

  /**
   * School-specific event departments, each optionally containing subcategories.
   * Replaces the old flat string[] — see migrate-dept-subcategories.js.
   *
   * Subcategories can be either a plain string (pre-migration schools) or an
   * object carrying optional hours/points limits — see
   * migrate-subcategory-limits.js. `Mixed` is used deliberately here instead
   * of a strict nested-object schema: Mongoose would otherwise try to cast
   * every element against the object shape and silently drop any school's
   * subcategories that are still plain strings, returning `[]` even though
   * the underlying data is intact. Callers (schools.service.ts getLookup(),
   * attendance.service.ts findLimits()) already normalize both shapes with
   * `typeof s === 'string' ? s : s.name`.
   */
  @Prop({
    type: [{
      name: { type: String },
      subcategories: { type: [MongooseSchema.Types.Mixed], default: [] },
    }],
    default: [],
  })
  departments: {
    name: string;
    subcategories: (string | { name: string; hoursLimit?: number; pointsLimit?: number })[];
  }[];

  /** Legacy flat category list — kept for backward compatibility but no longer returned by getLookup(). */
  @Prop({ type: [String], default: [] })
  categories: string[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);
