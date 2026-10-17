import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../users/prisma.service';
import { INITIAL_PASSWORD_MS, PasswordPolicy } from '../security/password-policy';
import { AuditService } from '../security/audit.service';
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordPolicy,
    private readonly audit: AuditService,
  ) {}
  requests() {
    return this.prisma.registrationRequest.findMany({ orderBy: { createdAt: 'asc' } });
  }
  // Crée le compte avec un mot de passe initial renvoyé une seule fois ; seul son hash est stocké.
  async approve(id: string) {
    const initialPassword = this.passwords.generateInitial();
    const hash = await this.passwords.hash(initialPassword);
    const expiresAt = new Date(Date.now() + INITIAL_PASSWORD_MS);
    try {
      const user = await this.prisma.$transaction(async tx => {
        const request = await tx.registrationRequest.delete({ where: { id } });
        return tx.user.create({ data: {
          email: request.email, passwordHash: hash, mustChangePassword: true, initialPasswordExpiresAt: expiresAt,
        } });
      });
      this.audit.event('account_approved', user.id);
      return { email: user.email, initialPassword, expiresAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2025', 'P2002'].includes(error.code))
        throw new NotFoundException('Demande introuvable ou déjà traitée.');
      throw error;
    }
  }
}
