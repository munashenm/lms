-- New role and visitor status. Existing rows are unchanged.
ALTER TYPE "UserRole" ADD VALUE 'SECURITY';
ALTER TYPE "VisitorStatus" ADD VALUE 'CANCELLED';
