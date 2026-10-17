import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../users/prisma.service';
import { AuthRequest } from '../auth/session.guard';
// À placer après SessionGuard : un admin qui n'a pas encore remplacé son mot de passe initial est refusé.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const { authSession } = context.switchToHttp().getRequest<AuthRequest>();
    const user = await this.prisma.user.findUnique({ where: { id: authSession.userId } });
    if (user?.role !== 'ADMIN' || user.mustChangePassword) throw new ForbiddenException('Accès réservé aux administrateurs.');
    return true;
  }
}
