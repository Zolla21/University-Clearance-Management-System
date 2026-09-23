import { z } from "zod";

export const userRoleSchema = z.enum([
  "STUDENT",
  "CLEARANCE_STAFF",
  "DEPARTMENT_STAFF",
  "REGISTRAR",
  "FINANCE_OFFICER",
  "LIBRARY_OFFICER",
  "PROPERTY_OFFICER",
  "ADMINISTRATOR",
  "SUPER_ADMINISTRATOR",
]);

export const clearanceItemStatusSchema = z.enum([
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "NOT_APPLICABLE",
]);

export const clearanceRequestStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_PROGRESS",
  "ACTION_REQUIRED",
  "COMPLETED",
  "CANCELLED",
]);

export const certificateStatusSchema = z.enum([
  "PENDING",
  "ISSUED",
  "REVOKED",
  "EXPIRED",
]);

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: userRoleSchema,
  isActive: z.boolean(),
});

export const studentSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  programId: z.string().min(1),
  batchId: z.string().optional(),
  isActive: z.boolean(),
});

export const clearanceRequestSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
  templateId: z.string().min(1),
  status: clearanceRequestStatusSchema,
  submittedAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const clearanceItemSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  templateItemId: z.string().min(1),
  status: clearanceItemStatusSchema,
  remarks: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
});