import { IsDateString, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Payload for a teacher manually adding a completed attendance record on
 * behalf of a student (e.g. retro-actively, paper sign-in, etc.).
 *
 * Unlike `SubmitAttendanceDto` which creates / closes records based on
 * scan direction and uses `Date.now()` for timestamps, this DTO lets the
 * teacher specify everything — including a back-dated `timeIn` and
 * optional `timeOut`.
 */
export class ManualAttendanceDto {
  @ApiProperty() @IsString() eventId: string;

  @ApiProperty() @IsEmail() studentEmail: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() studentFirstName?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentLastName?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentGrade?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentClass?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentHouse?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentTutor?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() customField1?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() customField2?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() customField3?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() schoolId?: string;

  /** ISO date-time the student arrived. */
  @ApiProperty() @IsDateString() timeIn: string;

  /** ISO date-time the student left. Only set when the event is in/out. */
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() timeOut?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() locationIn?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() locationOut?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() reflection?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() unitAmount?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() teacherEmail?: string;
}
