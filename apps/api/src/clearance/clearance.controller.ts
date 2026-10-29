import { SubmitCorrectionDto } from './dto/submit-correction.dto';
import { ReviewClearanceItemDto } from './dto/review-clearance-item.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ClearanceService } from './clearance.service';

import { CreateClearanceUnitDto } from './dto/create-clearance-unit.dto';
import { CreateClearanceTemplateDto } from './dto/create-clearance-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { CreateWorkflowStepDto } from './dto/create-workflow-step.dto';
import { CreateWorkflowTransitionDto } from './dto/create-workflow-transition.dto';
import { CreateClearanceRequestDto } from './dto/create-clearance-request.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('clearance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClearanceController {
  constructor(private readonly clearanceService: ClearanceService) {}

  // Clearance Units

  @Post('units')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createUnit(@Body() dto: CreateClearanceUnitDto) {
    return this.clearanceService.createUnit(dto);
  }

  @Get('units')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
    'STUDENT',
  )
  findAllUnits() {
    return this.clearanceService.findAllUnits();
  }

  @Get('units/:id')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
    'STUDENT',
  )
  findUnitById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clearanceService.findUnitById(id);
  }

  // Clearance Templates

  @Post('templates')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createTemplate(@Body() dto: CreateClearanceTemplateDto) {
    return this.clearanceService.createTemplate(dto);
  }

  @Get('templates')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
    'STUDENT',
  )
  findAllTemplates() {
    return this.clearanceService.findAllTemplates();
  }

  @Get('templates/:id')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
    'STUDENT',
  )
  findTemplateById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clearanceService.findTemplateById(id);
  }

  @Post('templates/:templateId/items')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createTemplateItem(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Body() dto: CreateTemplateItemDto,
  ) {
    return this.clearanceService.createTemplateItem(templateId, dto);
  }

  @Get('templates/:templateId/items')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'STUDENT',
  )
  findTemplateItems(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
  ) {
    return this.clearanceService.findTemplateItems(templateId);
  }

  // Workflows

  @Post('workflows')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return this.clearanceService.createWorkflow(dto);
  }

  @Get('workflows')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'STUDENT',
  )
  findAllWorkflows() {
    return this.clearanceService.findAllWorkflows();
  }

  // Workflow Steps

  @Post('workflows/:workflowId/steps')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createWorkflowStep(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() dto: CreateWorkflowStepDto,
  ) {
    return this.clearanceService.createWorkflowStep(workflowId, dto);
  }

  @Get('workflows/:workflowId/steps')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'STUDENT',
  )
  findWorkflowSteps(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.clearanceService.findWorkflowSteps(workflowId);
  }

  @Delete('workflow-steps/:id')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  deleteWorkflowStep(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clearanceService.deleteWorkflowStep(id);
  }

  // Workflow Transitions

  @Post('workflows/:workflowId/transitions')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  createWorkflowTransition(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() dto: CreateWorkflowTransitionDto,
  ) {
    return this.clearanceService.createWorkflowTransition(workflowId, dto);
  }
  @Delete('workflow-transitions/:id')
  @Roles('ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  deleteWorkflowTransition(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.clearanceService.deleteWorkflowTransition(id);
  }

  @Get('workflows/:workflowId/transitions')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
  )
  findWorkflowTransitions(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.clearanceService.findWorkflowTransitions(workflowId);
  }
  @Get('academic-years')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'STUDENT',
  )
  findAllAcademicYears() {
    return this.clearanceService.findAllAcademicYears();
  }

  @Get('academic-years/:academicYearId/semesters')
  @Roles(
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'STUDENT',
  )
  findSemestersByAcademicYear(
    @Param('academicYearId', new ParseUUIDPipe())
    academicYearId: string,
  ) {
    return this.clearanceService.findSemestersByAcademicYear(
      academicYearId,
    );
  }
  // Clearance Requests

  @Post('requests')
  @Roles(
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
  )
  createClearanceRequest(
    @Body() dto: CreateClearanceRequestDto,
    @Req() req: any,
  ) {
    return this.clearanceService.createClearanceRequest(
      dto,
      req.user.id,
      req.user.roles ?? [],
    );
  }

  // Submit a draft clearance request

  @Post('requests/:id/submit')
  @Roles(
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
  )
  submitClearanceRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.clearanceService.submitClearanceRequest(
      id,
      req.user.id,
      req.user.roles ?? [],
    );
  }

  // Resubmit a clearance request after correction.
  @Post('requests/:id/resubmit')
  @Roles(
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
  )
  resubmitClearanceRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.clearanceService.resubmitClearanceRequest(
      id,
      req.user.id,
      req.user.roles ?? [],
    );
  }

  // Submit a correction explanation for a clearance item.
  @Post('requests/:id/items/:itemId/correction')
  @Roles(
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
  )
  submitClearanceCorrection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: SubmitCorrectionDto,
    @Req() req: any,
  ) {
    return this.clearanceService.submitClearanceCorrection(
      id,
      itemId,
      req.user.id,
      req.user.roles ?? [],
      dto.correctionComment,
    );
  }

  @Get('requests')
  @Roles(
    'COLLEGE_OFFICER',
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
  )
  findAllClearanceRequests(@Req() req: any) {
    return this.clearanceService.findAllClearanceRequests(
      req.user.id,
      req.user.roles ?? [],
    );
  }

  @Get('requests/:id')
  @Roles(
    'COLLEGE_OFFICER',
    'STUDENT',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'REGISTRAR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
  )
  findClearanceRequestById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.clearanceService.findClearanceRequestById(
      id,
      req.user.id,
      req.user.roles ?? [],
    );
  }


  // Review a clearance item
  @Post('requests/:id/items/:itemId/review')
  @Roles(
    'COLLEGE_OFFICER',
    'ADMINISTRATOR',
    'SUPER_ADMINISTRATOR',
    'CLEARANCE_STAFF',
    'DEPARTMENT_STAFF',
    'FINANCE_OFFICER',
    'LIBRARY_OFFICER',
    'PROPERTY_OFFICER',
    'DORMITORY_OFFICER',
  )
  reviewClearanceItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: ReviewClearanceItemDto,
    @Req() req: any,
  ) {
    return this.clearanceService.reviewClearanceItem(
      id,
      itemId,
      req.user.id,
      req.user.roles ?? [],
      dto,
    );
  }


  // Final Registrar approval
  @Post('requests/:id/final-approval')
  @Roles('REGISTRAR')
  finalizeClearanceRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    return this.clearanceService.finalizeClearanceRequest(
      id,
      req.user.id,
      req.user.roles ?? [],
    );
  }
}
