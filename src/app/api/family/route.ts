/**
 * AI 回忆录助手 - 家庭协作 API
 * 本轮重构新增
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import {
  AddFamilyMemberSchema,
  ListFamilyMemberSchema,
  GetFamilyMemberSchema,
  UpdateFamilyMemberSchema,
  RemoveFamilyMemberSchema,
  validateRequest,
} from '@/lib/validators';
import {
  getFamilyMemberById,
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  getProjectContributions,
  addContribution,
  updateContributionStatus,
  getUserConsents,
  createConsent,
  updateConsentStatus,
  logAction,
} from '@/lib/db';

const rateLimiter = createRateLimiter();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = rateLimiter(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // 认证 - 从 token 获取 userId
    const tokenUserId = requireAuth(request);

    const body = await request.json();
    const { action } = body;

    // 添加家庭成员
    if (action === 'add_member') {
      const validatedData = validateRequest(AddFamilyMemberSchema, body);
      const { name, relationship, role, canEdit, canSuggest, canInvite, canExport, email, phone, relatedProjectId } = validatedData;
      
      const member = addFamilyMember(tokenUserId, {
        name,
        relationship,
        role,
        canEdit,
        canSuggest,
        canInvite,
        canExport,
        email,
        phone,
        relatedProjectId,
      });

      // 记录操作日志
      logAction({
        projectId: relatedProjectId || '',
        targetType: 'episode',
        targetId: member.id,
        actorId: tokenUserId,
        actorRole: 'elder',
        actionType: 'create',
        changeDescription: `添加家庭成员: ${name}`,
      });

      return NextResponse.json({
        success: true,
        data: { member },
      });
    }

    // 获取家庭成员列表
    if (action === 'list_members') {
      const result = getFamilyMembers(tokenUserId);
      return NextResponse.json({
        success: true,
        data: { members: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
      });
    }

    // 获取单个家庭成员
    if (action === 'get_member') {
      const validatedData = validateRequest(GetFamilyMemberSchema, body);
      const member = getFamilyMemberById(validatedData.memberId);
      
      if (!member) {
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_NOT_FOUND', message: '家庭成员不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (member.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { member },
      });
    }

    // 更新家庭成员权限
    if (action === 'update_member') {
      const validatedData = validateRequest(UpdateFamilyMemberSchema, body);
      const member = getFamilyMemberById(validatedData.memberId);
      
      if (!member) {
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_NOT_FOUND', message: '家庭成员不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (member.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const { memberId, ...updates } = validatedData;
      const updated = updateFamilyMember(memberId, updates);

      return NextResponse.json({
        success: true,
        data: { member: updated },
      });
    }

    // 移除家庭成员
    if (action === 'remove_member') {
      const validatedData = validateRequest(RemoveFamilyMemberSchema, body);
      const member = getFamilyMemberById(validatedData.memberId);
      
      if (!member) {
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_NOT_FOUND', message: '家庭成员不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (member.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const removed = removeFamilyMember(validatedData.memberId);

      return NextResponse.json({
        success: true,
        data: { removed },
      });
    }

    // 添加贡献
    if (action === 'add_contribution') {
      const { projectId, contributorId, contributionType, targetType, targetId, content } = body;
      
      const contribution = addContribution(projectId, {
        contributorId,
        contributionType,
        targetType,
        targetId,
        content,
      });

      return NextResponse.json({
        success: true,
        data: { contribution },
      });
    }

    // 获取项目贡献列表
    if (action === 'list_contributions') {
      const { projectId } = body;
      const contributions = getProjectContributions(projectId);
      return NextResponse.json({
        success: true,
        data: { contributions },
      });
    }

    // 更新贡献状态
    if (action === 'update_contribution') {
      const { contributionId, status } = body;
      const updated = updateContributionStatus(contributionId, status);
      
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: 'CONTRIBUTION_NOT_FOUND', message: '贡献不存在' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { contribution: updated },
      });
    }

    // 获取授权记录
    if (action === 'list_consents') {
      const result = getUserConsents(tokenUserId);
      return NextResponse.json({
        success: true,
        data: { consents: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
      });
    }

    // 创建授权记录
    if (action === 'create_consent') {
      const { consentType, targetId, status, note } = body;
      
      const consent = createConsent(tokenUserId, {
        consentType,
        targetId,
        status,
        note,
      });

      return NextResponse.json({
        success: true,
        data: { consent },
      });
    }

    // 更新授权状态
    if (action === 'update_consent') {
      const { consentId, status } = body;
      const updated = updateConsentStatus(consentId, status);
      
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: 'CONSENT_NOT_FOUND', message: '授权记录不存在' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { consent: updated },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    logger.error('家庭协作 API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}
