-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "discord_user_id" TEXT,
ADD COLUMN     "user_slug" TEXT,
ALTER COLUMN "discord_channel_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "channels_user_slug_key" ON "channels"("user_slug");

-- CreateIndex
CREATE UNIQUE INDEX "channels_discord_user_id_key" ON "channels"("discord_user_id");
