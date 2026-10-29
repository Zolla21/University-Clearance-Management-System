-- Add clearance type to each template.
ALTER TABLE "ClearanceTemplate"
ADD COLUMN "clearanceType" TEXT NOT NULL DEFAULT 'GRADUATION';