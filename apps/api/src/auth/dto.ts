import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
// Inscription : demande sans mot de passe, validée par un administrateur (V6.4.1).
export class EmailDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class CredentialsDto extends EmailDto {
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
