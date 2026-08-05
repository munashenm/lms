-- AlterEnum EnrolmentStatus for year-end rollover outcomes
ALTER TYPE "EnrolmentStatus" ADD VALUE 'PROMOTED';
ALTER TYPE "EnrolmentStatus" ADD VALUE 'REPEATED';
ALTER TYPE "EnrolmentStatus" ADD VALUE 'GRADUATED';
ALTER TYPE "EnrolmentStatus" ADD VALUE 'TRANSFERRED';
