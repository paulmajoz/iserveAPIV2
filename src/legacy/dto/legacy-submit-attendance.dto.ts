import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsOptional,
  IsNumber,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Field-for-field mirror of V1's SubmitAttendanceDto (iserveAPI, branch
 * `enviro`, src/commServe/commServeAttendance/dto/submit-attendance.dto.ts).
 * Deliberately excludes any V2-only fields (schoolId, studentGrade, etc.)
 * — the old `attendances` collection never had them.
 */
export class LegacySubmitAttendanceDto {
  @ApiProperty() @IsMongoId() @IsNotEmpty() eventId: string;
  @ApiProperty() @IsEmail() @IsNotEmpty() studentEmail: string;

  @ApiProperty({ enum: ['in', 'out'] })
  @IsIn(['in', 'out'])
  direction: 'in' | 'out';

  @ValidateIf((o) => o.direction === 'in')
  @IsString() @IsNotEmpty()
  @ApiProperty({ required: false }) studentFirstName?: string;

  @ValidateIf((o) => o.direction === 'in')
  @IsString() @IsNotEmpty()
  @ApiProperty({ required: false }) studentLastName?: string;

  @IsOptional() @IsIn(['IN/OUT', 'VOLUME', 'IN ONLY'])
  @ApiProperty({ required: false, enum: ['IN/OUT', 'VOLUME', 'IN ONLY'] })
  eventType?: 'IN/OUT' | 'VOLUME' | 'IN ONLY';

  @IsOptional() @IsString() @ApiProperty({ required: false }) locationIn?: string;
  @IsOptional() @IsString() @ApiProperty({ required: false }) locationOut?: string;

  @ValidateIf((o) => o.direction === 'out' && o.eventType === 'VOLUME')
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ required: false }) unitAmount?: number;

  @ValidateIf((o) => o.direction === 'out')
  @IsOptional() @IsString()
  @ApiProperty({ required: false }) description?: string;

  @ValidateIf((o) => o.direction === 'out')
  @IsOptional() @IsString()
  @ApiProperty({ required: false }) reflection?: string;
}
