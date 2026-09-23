export type UserRole =
  | "STUDENT"
  | "CLEARANCE_STAFF"
  | "DEPARTMENT_STAFF"
  | "REGISTRAR"
  | "FINANCE_OFFICER"
  | "LIBRARY_OFFICER"
  | "PROPERTY_OFFICER"
  | "ADMINISTRATOR"
  | "SUPER_ADMINISTRATOR";

export type ClearanceItemStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "NOT_APPLICABLE";

export type ClearanceRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "COMPLETED"
  | "CANCELLED";

export type CertificateStatus =
  | "PENDING"
  | "ISSUED"
  | "REVOKED"
  | "EXPIRED";
  export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

export interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  departmentId: string;
  programId: string;
  batchId?: string;
  isActive: boolean;
}
export interface College {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  collegeId: string;
  isActive: boolean;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  degreeLevel: string;
  isActive: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Semester {
  id: string;
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Batch {
  id: string;
  name: string;
  programId: string;
  admissionYear: string;
  graduationYear?: string;
}
export interface ClearanceTemplate {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface ClearanceTemplateItem {
  id: string;
  templateId: string;
  name: string;
  description?: string;
  clearanceUnitId: string;
  isMandatory: boolean;
  order: number;
}

export interface ClearanceUnit {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface ClearanceRequest {
  id: string;
  studentId: string;
  templateId: string;
  status: ClearanceRequestStatus;
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClearanceItem {
  id: string;
  requestId: string;
  templateItemId: string;
  status: ClearanceItemStatus;
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}
export type WorkflowStepType =
  | "START"
  | "APPROVAL"
  | "REVIEW"
  | "END";

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  type: WorkflowStepType;
  order: number;
  clearanceUnitId?: string;
  requiredRole?: UserRole;
}

export interface WorkflowTransition {
  id: string;
  workflowId: string;
  fromStepId: string;
  toStepId: string;
  condition?: string;
}

export interface WorkflowDependency {
  id: string;
  workflowId: string;
  stepId: string;
  dependsOnStepId: string;
}

export interface Approval {
  id: string;
  clearanceItemId: string;
  approvedBy: string;
  status: "APPROVED" | "REJECTED";
  comment?: string;
  createdAt: string;
}
export type DocumentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
}

export interface Document {
  id: string;
  studentId: string;
  documentTypeId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: string;
}

export interface Certificate {
  id: string;
  clearanceRequestId: string;
  certificateNumber: string;
  status: CertificateStatus;
  issuedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  verificationCode: string;
  fileUrl?: string;
}

export interface CertificateVerification {
  id: string;
  certificateId: string;
  verificationCode: string;
  verifiedAt: string;
  ipAddress?: string;
}

export type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
}