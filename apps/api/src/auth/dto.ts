import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CredentialsDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(/^[^\uD800-\uDFFF]*$/u)
  password!: string;
}
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(/^[^\uD800-\uDFFF]*$/u)
  currentPassword!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(/^[^\uD800-\uDFFF]*$/u)
  newPassword!: string;
}
