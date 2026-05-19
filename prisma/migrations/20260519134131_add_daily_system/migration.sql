-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "sourceNodeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyFolderId" TEXT,
ADD COLUMN     "dailyListId" TEXT;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
