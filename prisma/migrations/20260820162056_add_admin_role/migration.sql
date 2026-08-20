-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'TEAM');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';
