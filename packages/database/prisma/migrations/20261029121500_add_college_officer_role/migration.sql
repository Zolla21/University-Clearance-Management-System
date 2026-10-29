-- Add the College Officer role to the existing PostgreSQL enum.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'COLLEGE_OFFICER';