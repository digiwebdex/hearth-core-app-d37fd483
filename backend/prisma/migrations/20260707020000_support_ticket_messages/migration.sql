-- AlterTable: threaded conversation on support tickets (portal Support + Live Chat)
ALTER TABLE "SupportTicket" ADD COLUMN "messages" JSONB;
