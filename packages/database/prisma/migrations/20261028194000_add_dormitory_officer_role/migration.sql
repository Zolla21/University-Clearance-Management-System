-- Add the Dormitory Officer role to the existing PostgreSQL enum.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'DORMITORY_OFFICER';