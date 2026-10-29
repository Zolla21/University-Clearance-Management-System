-- AlterTable
ALTER TABLE "ClearanceRequest" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "clearanceType" TEXT NOT NULL DEFAULT 'GRADUATION',
ADD COLUMN     "otherReason" TEXT,
ADD COLUMN     "semesterId" TEXT;
