export const APP_NAME = "EPSU Clearance Management System";

export const APP_VERSION = "1.0.0";

export const API_PREFIX = "api";

export const DEFAULT_PAGE = 1;

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export const PASSWORD_MIN_LENGTH = 8;

export const STUDENT_ID_MIN_LENGTH = 3;

export const STUDENT_ID_MAX_LENGTH = 30;

export const CERTIFICATE_NUMBER_PREFIX = "EPSU-CERT";

export const VERIFICATION_CODE_LENGTH = 12;

export const USER_ROLES = {
  STUDENT: "STUDENT",
  CLEARANCE_STAFF: "CLEARANCE_STAFF",
  DEPARTMENT_STAFF: "DEPARTMENT_STAFF",
  REGISTRAR: "REGISTRAR",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  LIBRARY_OFFICER: "LIBRARY_OFFICER",
  PROPERTY_OFFICER: "PROPERTY_OFFICER",
  DORMITORY_OFFICER: "DORMITORY_OFFICER",
  ADMINISTRATOR: "ADMINISTRATOR",
  SUPER_ADMINISTRATOR: "SUPER_ADMINISTRATOR",
} as const;

export const CLEARANCE_ITEM_STATUSES = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;

export const CLEARANCE_REQUEST_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  IN_PROGRESS: "IN_PROGRESS",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export const WORKFLOW_STEP_TYPES = {
  START: "START",
  APPROVAL: "APPROVAL",
  REVIEW: "REVIEW",
  END: "END",
} as const;

export const APPROVAL_STATUSES = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const CERTIFICATE_STATUSES = {
  PENDING: "PENDING",
  ISSUED: "ISSUED",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
} as const;

export const DOCUMENT_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const NOTIFICATION_TYPES = {
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
  ERROR: "ERROR",
} as const;

export const PERMISSIONS = {
  STUDENT_READ: "student.read",
  STUDENT_UPDATE: "student.update",

  CLEARANCE_CREATE: "clearance.create",
  CLEARANCE_READ: "clearance.read",
  CLEARANCE_UPDATE: "clearance.update",
  CLEARANCE_APPROVE: "clearance.approve",
  CLEARANCE_REJECT: "clearance.reject",
  CLEARANCE_COMMENT: "clearance.comment",

  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_READ: "document.read",
  DOCUMENT_DELETE: "document.delete",

  CERTIFICATE_GENERATE: "certificate.generate",
  CERTIFICATE_READ: "certificate.read",
  CERTIFICATE_VERIFY: "certificate.verify",

  USER_CREATE: "user.create",
  USER_READ: "user.read",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  REPORT_READ: "report.read",
  REPORT_EXPORT: "report.export",

  AUDIT_READ: "audit.read",

  SETTINGS_MANAGE: "settings.manage",

  WORKFLOW_MANAGE: "workflow.manage",
} as const;

