import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { OriginGuard } from '../security/guards';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
@Controller('admin')
@UseGuards(OriginGuard, SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('requests')
  requests() { return this.admin.requests(); }
  @Post('requests/:id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseUUIDPipe) id: string) { return this.admin.approve(id); }
}
