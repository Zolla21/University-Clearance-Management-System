import { ClearanceItemStatus, ClearanceRequestStatus, ApprovalStatus } from '@epsu/database';
import { ReviewClearanceItemDto, ClearanceDecision } from './dto/review-clearance-item.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateClearanceUnitDto } from './dto/create-clearance-unit.dto';
import { CreateClearanceTemplateDto } from './dto/create-clearance-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { CreateClearanceRequestDto } from './dto/create-clearance-request.dto';

@Injectable()
export class ClearanceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly privilegedRoles = [
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
  ];

  private readonly staffRoles = [
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
  ];

  private hasRole(roles: string[], allowedRoles: string[]): boolean {
    return roles.some((role) => allowedRoles.includes(role));
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  // Validates that active workflow steps form a path from START to END.
  private validateWorkflowPath(
    steps: Array<{ id: string; type: string }>,
    transitions: Array<{ fromStepId: string; toStepId: string }>,
  ): void {
    const startSteps = steps.filter((step) => step.type === 'START');
    const endSteps = steps.filter((step) => step.type === 'END');

    if (startSteps.length !== 1 || endSteps.length !== 1) {
      throw new BadRequestException(
        'The workflow must have exactly one active START step and one active END step.',
      );
    }

    const activeStepIds = new Set(steps.map((step) => step.id));

    const validTransitions = transitions.filter(
      (transition) =>
        activeStepIds.has(transition.fromStepId) &&
        activeStepIds.has(transition.toStepId),
    );

    if (validTransitions.length === 0) {
      throw new BadRequestException(
        'The workflow must have a connected path from START to END.',
      );
    }

    const reachable = new Set<string>([startSteps[0].id]);
    const queue = [startSteps[0].id];

    while (queue.length > 0) {
      const currentStepId = queue.shift()!;

      for (const transition of validTransitions) {
        if (
          transition.fromStepId === currentStepId &&
          !reachable.has(transition.toStepId)
        ) {
          reachable.add(transition.toStepId);
          queue.push(transition.toStepId);
        }
      }
    }

    if (!reachable.has(endSteps[0].id)) {
      throw new BadRequestException(
        'The workflow has no connected path from START to END.',
      );
    }
  }

  // Clearance Units

  async createUnit(dto: CreateClearanceUnitDto) {
    try {
      return await this.prisma.clearanceUnit.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A clearance unit with this code already exists.',
        );
      }
      throw error;
    }
  }

  async findAllUnits() {
    return this.prisma.clearanceUnit.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findUnitById(id: string) {
    const unit = await this.prisma.clearanceUnit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { templateItems: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Clearance unit not found.');
    }

    return unit;
  }

  // Clearance Templates

  async createTemplate(dto: CreateClearanceTemplateDto) {
    try {
      return await this.prisma.clearanceTemplate.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A clearance template with this code already exists.',
        );
      }
      throw error;
    }
  }

  async findAllTemplates() {
    return this.prisma.clearanceTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { items: true, workflows: true },
        },
      },
    });
  }

  async findTemplateById(id: string) {
    const template = await this.prisma.clearanceTemplate.findUnique({
      where: { id },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            unit: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: { items: true, workflows: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Clearance template not found.');
    }

    return template;
  }

  // Clearance Template Items

  async createTemplateItem(
    templateId: string,
    dto: CreateTemplateItemDto,
  ) {
    const template = await this.prisma.clearanceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Clearance template not found.');
    }

    if (!template.isActive) {
      throw new ConflictException(
        'Cannot add an item to an inactive template.',
      );
    }

    const unit = await this.prisma.clearanceUnit.findUnique({
      where: { id: dto.unitId },
    });

    if (!unit) {
      throw new NotFoundException('Clearance unit not found.');
    }

    if (!unit.isActive) {
      throw new ConflictException(
        'An inactive clearance unit cannot be added to a template.',
      );
    }

    try {
      return await this.prisma.clearanceTemplateItem.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isRequired: dto.isRequired ?? true,
          order: dto.order ?? 0,
          templateId,
          unitId: dto.unitId,
        },
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This clearance unit is already included in the template.',
        );
      }
      throw error;
    }
  }

  async findTemplateItems(templateId: string) {
    const template = await this.prisma.clearanceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Clearance template not found.');
    }

    return this.prisma.clearanceTemplateItem.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  }

  // Workflows

  async createWorkflow(dto: CreateWorkflowDto) {
    const template = await this.prisma.clearanceTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new NotFoundException('Clearance template not found.');
    }

    if (!template.isActive) {
      throw new ConflictException(
        'Cannot create a workflow for an inactive template.',
      );
    }

    try {
      return await this.prisma.workflow.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          templateId: dto.templateId,
        },
        include: {
          template: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A workflow with this code already exists.',
        );
      }
      throw error;
    }
  }

  async findAllWorkflows() {
    return this.prisma.workflow.findMany({
      orderBy: { name: 'asc' },
      include: {
        template: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: { steps: true, transitions: true },
        },
      },
    });
  }

  // Workflow Steps

  async createWorkflowStep(
    workflowId: string,
    dto: CreateWorkflowStepDto,
  ): Promise<any> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found.');
    }

    if (!workflow.isActive) {
      throw new ConflictException(
        'Cannot add a step to an inactive workflow.',
      );
    }

    if (dto.unitId) {
      const unit = await this.prisma.clearanceUnit.findUnique({
        where: { id: dto.unitId },
      });

      if (!unit) {
        throw new NotFoundException('Clearance unit not found.');
      }

      if (!unit.isActive) {
        throw new ConflictException(
          'Cannot assign an inactive clearance unit to a workflow step.',
        );
      }
    }

    return this.prisma.workflowStep.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        order: dto.order ?? 0,
        isRequired: dto.isRequired ?? true,
        workflowId,
        unitId: dto.unitId,
      },
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async findWorkflowSteps(workflowId: string): Promise<any> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found.');
    }

    return this.prisma.workflowStep.findMany({
      where: { workflowId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteWorkflowStep(id: string): Promise<any> {
    const step = await this.prisma.workflowStep.findUnique({
      where: { id },
      include: {
        fromTransitions: true,
        toTransitions: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Workflow step not found.');
    }

    if (step.fromTransitions.length > 0 || step.toTransitions.length > 0) {
      throw new BadRequestException(
        'Cannot delete a workflow step that has transitions.',
      );
    }

    return this.prisma.workflowStep.delete({
      where: { id },
    });
  }

  // Workflow Transitions

  async createWorkflowTransition(
    workflowId: string,
    dto: CreateWorkflowTransitionDto,
  ): Promise<any> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found.');
    }

    if (!workflow.isActive) {
      throw new ConflictException(
        'Cannot add a transition to an inactive workflow.',
      );
    }

    if (dto.fromStepId === dto.toStepId) {
      throw new BadRequestException(
        'A workflow transition cannot point to the same step.',
      );
    }

    const fromStep = workflow.steps.find(
      (step) => step.id === dto.fromStepId,
    );
    const toStep = workflow.steps.find(
      (step) => step.id === dto.toStepId,
    );

    if (!fromStep || !toStep) {
      throw new BadRequestException(
        'Both transition steps must belong to this workflow.',
      );
    }

    if (!fromStep.isActive || !toStep.isActive) {
      throw new BadRequestException(
        'Both transition steps must be active.',
      );
    }

    if (fromStep.type === 'END') {
      throw new BadRequestException(
        'An END step cannot have an outgoing transition.',
      );
    }

    if (toStep.type === 'START') {
      throw new BadRequestException(
        'A transition cannot lead back to a START step.',
      );
    }

    const existing = await this.prisma.workflowTransition.findUnique({
      where: {
        workflowId_fromStepId_toStepId: {
          workflowId,
          fromStepId: dto.fromStepId,
          toStepId: dto.toStepId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'This workflow transition already exists.',
      );
    }

    return this.prisma.workflowTransition.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        action: dto.action.trim(),
        workflowId,
        fromStepId: dto.fromStepId,
        toStepId: dto.toStepId,
      },
      include: {
        fromStep: true,
        toStep: true,
      },
    });
  }

  async findWorkflowTransitions(workflowId: string): Promise<any> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found.');
    }

    return this.prisma.workflowTransition.findMany({
      where: { workflowId },
      include: {
        fromStep: true,
        toStep: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Create Clearance Request

  async createClearanceRequest(
    dto: CreateClearanceRequestDto,
    userId: string,
    roles: string[],
  ): Promise<any> {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    if (!student.isActive) {
      throw new BadRequestException(
        'Cannot create a clearance request for an inactive student.',
      );
    }

    const isPrivileged = this.hasRole(roles, this.privilegedRoles);

    if (!isPrivileged && student.userId !== userId) {
      throw new BadRequestException(
        'You can only create a clearance request for your own student record.',
      );
    }

    const template = await this.prisma.clearanceTemplate.findUnique({
      where: { id: dto.templateId },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            unit: true,
          },
        },
      },
    });

    if (!template || !template.isActive) {
      throw new NotFoundException('Active clearance template not found.');
    }

    if (template.items.length === 0) {
      throw new BadRequestException(
        'The selected template has no active clearance items.',
      );
    }

    const inactiveUnitItem = template.items.find(
      (item) => !item.unit || !item.unit.isActive,
    );

    if (inactiveUnitItem) {
      throw new BadRequestException(
        'Every active template item must belong to an active clearance unit.',
      );
    }

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: dto.workflowId,
        templateId: dto.templateId,
        isActive: true,
      },
      include: {
        steps: {
          where: { isActive: true },
        },
        transitions: true,
      },
    });

    if (!workflow) {
      throw new BadRequestException(
        'An active workflow for the selected template was not found.',
      );
    }

    this.validateWorkflowPath(workflow.steps, workflow.transitions);

    const requestNumber = `CLR-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.clearanceRequest.create({
        data: {
          requestNumber,
          studentId: dto.studentId,
          templateId: dto.templateId,
          workflowId: dto.workflowId,
          status: 'DRAFT',
        },
      });

      await tx.clearanceItem.createMany({
        data: template.items.map((item) => ({
          requestId: request.id,
          templateItemId: item.id,
          unitId: item.unitId,
          status: 'PENDING',
        })),
      });

      return tx.clearanceRequest.findUnique({
        where: { id: request.id },
        include: {
          student: true,
          template: true,
          workflow: true,
          items: {
            include: {
              templateItem: true,
              unit: true,
            },
          },
        },
      });
    });
  }

  // Submit Clearance Request
  // A student may submit their own request. Privileged staff may submit
  // on behalf of a student. Submission does not approve clearance items.

  async submitClearanceRequest(
    id: string,
    userId: string,
    roles: string[],
  ): Promise<any> {
    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        student: true,
        template: {
          include: {
            items: {
              where: { isActive: true },
            },
          },
        },
        workflow: {
          include: {
            steps: {
              where: { isActive: true },
            },
            transitions: true,
          },
        },
        items: {
          include: {
            templateItem: true,
            unit: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Clearance request not found.');
    }

    const isPrivileged = this.hasRole(roles, this.privilegedRoles);

    if (!isPrivileged && request.student.userId !== userId) {
      throw new NotFoundException('Clearance request not found.');
    }

    if (request.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a DRAFT clearance request can be submitted.',
      );
    }

    if (!request.student.isActive) {
      throw new BadRequestException(
        'A request belonging to an inactive student cannot be submitted.',
      );
    }

    if (!request.template.isActive) {
      throw new BadRequestException(
        'The clearance template is inactive and this request cannot be submitted.',
      );
    }

    if (!request.workflow.isActive) {
      throw new BadRequestException(
        'The workflow is inactive and this request cannot be submitted.',
      );
    }

    const activeTemplateItems = request.template.items;
    const requiredTemplateItems = activeTemplateItems.filter(
      (item) => item.isRequired,
    );

    const requestTemplateItemIds = new Set(
      request.items.map((item) => item.templateItemId),
    );

    const missingRequiredItems = requiredTemplateItems.filter(
      (item) => !requestTemplateItemIds.has(item.id),
    );

    if (missingRequiredItems.length > 0) {
      throw new BadRequestException(
        'The request is missing one or more required clearance items. Create a new request or correct its items before submitting.',
      );
    }

    if (request.items.length === 0) {
      throw new BadRequestException(
        'A clearance request must contain at least one clearance item.',
      );
    }

    const invalidUnitItem = request.items.find(
      (item) =>
        !item.unit ||
        !item.unit.isActive ||
        !item.templateItem ||
        !item.templateItem.isActive,
    );

    if (invalidUnitItem) {
      throw new BadRequestException(
        'Every request item must reference an active template item and active clearance unit.',
      );
    }

    this.validateWorkflowPath(
      request.workflow.steps,
      request.workflow.transitions,
    );

    return this.prisma.$transaction(async (tx) => {
      // Recheck status inside the transaction to reduce duplicate submissions.
      const currentRequest = await tx.clearanceRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!currentRequest) {
        throw new NotFoundException('Clearance request not found.');
      }

      if (currentRequest.status !== 'DRAFT') {
        throw new ConflictException(
          'This clearance request has already been submitted or processed.',
        );
      }

      await tx.clearanceRequest.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      return tx.clearanceRequest.findUnique({
        where: { id },
        include: {
          student: true,
          template: true,
          workflow: {
            include: {
              steps: {
                orderBy: { order: 'asc' },
              },
              transitions: true,
            },
          },
          items: {
            include: {
              templateItem: true,
              unit: true,
              approvals: true,
            },
          },
          approvals: true,
        },
      });
    });
  }

  // Resubmit a clearance request after required corrections.
  async resubmitClearanceRequest(
    id: string,
    userId: string,
    roles: string[],
  ): Promise<any> {
    const isPrivileged = this.hasRole(roles, this.privilegedRoles);

    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Clearance request not found.');
    }

    if (!isPrivileged && request.student.userId !== userId) {
      throw new NotFoundException('Clearance request not found.');
    }

    if (request.status !== ClearanceRequestStatus.ACTION_REQUIRED) {
      throw new ConflictException(
        'Only requests requiring action can be resubmitted.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const currentRequest = await tx.clearanceRequest.findUnique({
        where: { id },
        select: { status: true },
      });

      if (
        !currentRequest ||
        currentRequest.status !== ClearanceRequestStatus.ACTION_REQUIRED
      ) {
        throw new ConflictException(
          'This request is no longer awaiting correction.',
        );
      }

      await tx.clearanceItem.updateMany({
        where: {
          requestId: id,
          status: {
            in: [
              ClearanceItemStatus.REJECTED,
              ClearanceItemStatus.RETURNED,
            ],
          },
        },
        data: {
          status: ClearanceItemStatus.PENDING,
        },
      });

      await tx.clearanceRequest.update({
        where: { id },
        data: {
          status: ClearanceRequestStatus.SUBMITTED,
          submittedAt: new Date(),
          completedAt: null,
        },
      });

      return tx.clearanceRequest.findUnique({
        where: { id },
        include: {
          student: true,
          template: true,
          workflow: {
            include: {
              steps: { orderBy: { order: 'asc' } },
              transitions: true,
            },
          },
          items: {
            include: {
              templateItem: true,
              unit: true,
              approvals: true,
            },
          },
          approvals: true,
        },
      });
    });
  }

  
  // Submit a student's explanation for a returned or rejected item.
  async submitClearanceCorrection(
    requestId: string,
    itemId: string,
    userId: string,
    roles: string[],
    correctionComment: string,
  ): Promise<any> {
    try {
      const isPrivileged = this.hasRole(roles, this.privilegedRoles);
      const explanation = correctionComment?.trim();

      if (!explanation) {
        throw new BadRequestException(
          'A correction explanation is required.',
        );
      }

      const request = await this.prisma.clearanceRequest.findUnique({
        where: { id: requestId },
        include: { student: true },
      });

      if (!request) {
        throw new NotFoundException('Clearance request not found.');
      }

      if (!isPrivileged && request.student.userId !== userId) {
        throw new NotFoundException('Clearance request not found.');
      }

      if (request.status !== ClearanceRequestStatus.ACTION_REQUIRED) {
        throw new ConflictException(
          'Corrections can only be submitted when action is required.',
        );
      }

      const item = await this.prisma.clearanceItem.findFirst({
        where: { id: itemId, requestId },
      });

      if (!item) {
        throw new NotFoundException(
          'Clearance item not found in this request.',
        );
      }

      if (
        item.status !== ClearanceItemStatus.REJECTED &&
        item.status !== ClearanceItemStatus.RETURNED
      ) {
        throw new ConflictException(
          'Only rejected or returned items can receive a correction.',
        );
      }

      await this.prisma.clearanceItem.update({
        where: { id: itemId },
        data: { correctionComment: explanation },
      });

      return await this.prisma.clearanceRequest.findUnique({
        where: { id: requestId },
        include: {
          student: true,
          template: true,
          workflow: {
            include: {
              steps: { orderBy: { order: 'asc' } },
              transitions: true,
            },
          },
          items: {
            include: {
              templateItem: true,
              unit: true,
              approvals: true,
            },
          },
          approvals: true,
        },
      });
    } catch (error) {
      console.error(
        '[submitClearanceCorrection] Failed:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }


  // List Clearance Requests
  // Authorized staff roles can view all requests; other users see only
  // requests associated with their own student record.

  async findAllClearanceRequests(
    userId: string,
    roles: string[],
  ): Promise<any> {
    const canViewAll = this.hasRole(roles, this.staffRoles);

    return this.prisma.clearanceRequest.findMany({
      where: canViewAll
        ? {}
        : {
            student: {
              userId,
            },
          },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            isActive: true,
          },
        },
        template: true,
        workflow: true,
        items: {
          include: {
            templateItem: true,
            unit: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get Clearance Request Details

  async findClearanceRequestById(
    id: string,
    userId: string,
    roles: string[],
  ): Promise<any> {
    const request = await this.prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        student: true,
        template: true,
        workflow: {
          include: {
            steps: {
              orderBy: {
                order: 'asc',
              },
            },
            transitions: true,
          },
        },
        items: {
          include: {
            templateItem: true,
            unit: true,
            approvals: true,
          },
        },
        approvals: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Clearance request not found.');
    }

    const canViewAll = this.hasRole(roles, this.staffRoles);

    if (!canViewAll && request.student.userId !== userId) {
      throw new NotFoundException('Clearance request not found.');
    }

    return request;
  }
  
  // Review a clearance item
  async reviewClearanceItem(
    requestId: string,
    itemId: string,
    userId: string,
    roles: string[],
    dto: ReviewClearanceItemDto,
  ): Promise<any> {
    const privileged = this.hasRole(roles, this.privilegedRoles);

    const allowedStaffRoles = [
      'CLEARANCE_STAFF',
      'FINANCE_OFFICER',
      'LIBRARY_OFFICER',
      'PROPERTY_OFFICER',
    ];

    if (!privileged && !this.hasRole(roles, allowedStaffRoles)) {
      throw new BadRequestException(
        'You are not authorized to review clearance items.',
      );
    }

    if (
      (dto.decision === ClearanceDecision.REJECTED ||
        dto.decision === ClearanceDecision.RETURNED) &&
      !dto.comment?.trim()
    ) {
      throw new BadRequestException(
        'A comment is required when rejecting or returning an item.',
      );
    }

    const item = await this.prisma.clearanceItem.findFirst({
      where: {
        id: itemId,
        requestId,
      },
      include: {
        unit: true,
        request: true,
      },
    });

    if (!item) {
      throw new NotFoundException(
        'Clearance item not found in this request.',
      );
    }

    if (!item.unit.isActive) {
      throw new BadRequestException(
        'This clearance unit is inactive.',
      );
    }

    if (
      item.request.status !== ClearanceRequestStatus.SUBMITTED &&
      item.request.status !== ClearanceRequestStatus.IN_PROGRESS &&
      item.request.status !== ClearanceRequestStatus.ACTION_REQUIRED
    ) {
      throw new ConflictException(
        'This request is not currently available for review.',
      );
    }

    // Enforce office-specific authorization BEFORE checking item status.
    if (!privileged) {
      const unitCode = item.unit.code.toUpperCase();

      if (
        roles.includes('FINANCE_OFFICER') &&
        unitCode !== 'FINANCE'
      ) {
        throw new BadRequestException(
          'Finance Officers may review only Finance clearance items.',
        );
      }

      if (
        roles.includes('LIBRARY_OFFICER') &&
        unitCode !== 'LIBRARY'
      ) {
        throw new BadRequestException(
          'Library Officers may review only Library clearance items.',
        );
      }

      if (
        roles.includes('PROPERTY_OFFICER') &&
        unitCode !== 'PROPERTY'
      ) {
        throw new BadRequestException(
          'Property Officers may review only Property clearance items.',
        );
      }
    }

    if (
      item.status !== ClearanceItemStatus.PENDING &&
      item.status !== ClearanceItemStatus.IN_REVIEW
    ) {
      throw new ConflictException(
        'Only pending or in-review clearance items can be reviewed.',
      );
    }

    const nextItemStatus: ClearanceItemStatus =
      dto.decision === ClearanceDecision.APPROVED
        ? ClearanceItemStatus.APPROVED
        : dto.decision === ClearanceDecision.REJECTED
          ? ClearanceItemStatus.REJECTED
          : dto.decision === ClearanceDecision.RETURNED
            ? ClearanceItemStatus.RETURNED
            : ClearanceItemStatus.NOT_APPLICABLE;

    return this.prisma.$transaction(async (tx) => {
      // Recheck status inside the transaction.
      const currentItem = await tx.clearanceItem.findFirst({
        where: {
          id: itemId,
          requestId,
        },
        include: {
          request: true,
        },
      });

      if (
        !currentItem ||
        (currentItem.status !== ClearanceItemStatus.PENDING &&
          currentItem.status !== ClearanceItemStatus.IN_REVIEW)
      ) {
        throw new ConflictException(
          'This clearance item has already been reviewed.',
        );
      }

      if (
        currentItem.request.status !== ClearanceRequestStatus.SUBMITTED &&
        currentItem.request.status !== ClearanceRequestStatus.IN_PROGRESS &&
        currentItem.request.status !== ClearanceRequestStatus.ACTION_REQUIRED
      ) {
        throw new ConflictException(
          'This request is no longer available for review.',
        );
      }

      await tx.clearanceItem.update({
        where: { id: itemId },
        data: {
          status: nextItemStatus,
          comment: dto.comment?.trim() || null,
          reviewedAt: new Date(),
        },
      });

      // ApprovalStatus supports only APPROVED and REJECTED.
      // RETURNED and NOT_APPLICABLE are recorded on ClearanceItem.
      if (
        dto.decision === ClearanceDecision.APPROVED ||
        dto.decision === ClearanceDecision.REJECTED
      ) {
        await tx.approval.create({
          data: {
            requestId,
            clearanceItemId: itemId,
            approverId: userId,
            status:
              dto.decision === ClearanceDecision.APPROVED
                ? ApprovalStatus.APPROVED
                : ApprovalStatus.REJECTED,
            comment: dto.comment?.trim() || null,
            approvedAt: new Date(),
          },
        });
      }

      const items = await tx.clearanceItem.findMany({
        where: { requestId },
        include: {
          templateItem: true,
        },
      });

      const hasActionRequired = items.some(
        (current) =>
          current.status === ClearanceItemStatus.REJECTED ||
          current.status === ClearanceItemStatus.RETURNED,
      );

      const allResolved = items.every(
        (current) =>
          current.status === ClearanceItemStatus.APPROVED ||
          current.status === ClearanceItemStatus.NOT_APPLICABLE ||
          !current.templateItem.isRequired,
      );

      const nextRequestStatus: ClearanceRequestStatus =
        hasActionRequired
          ? ClearanceRequestStatus.ACTION_REQUIRED
          : allResolved
            ? ClearanceRequestStatus.COMPLETED
            : ClearanceRequestStatus.IN_PROGRESS;

      await tx.clearanceRequest.update({
        where: { id: requestId },
        data: {
          status: nextRequestStatus,
          ...(nextRequestStatus === ClearanceRequestStatus.COMPLETED
            ? { completedAt: new Date() }
            : { completedAt: null }),
        },
      });

      return tx.clearanceRequest.findUnique({
        where: { id: requestId },
        include: {
          student: true,
          template: true,
          workflow: true,
          items: {
            include: {
              templateItem: true,
              unit: true,
              approvals: {
                include: {
                  approver: {
                    select: {
                      id: true,
                      username: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          approvals: true,
        },
      });
    });
  }


}
