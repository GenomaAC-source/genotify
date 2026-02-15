-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('CLIENT', 'INTERNAL', 'VENDOR');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "discord_channel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL DEFAULT 'CLIENT',
    "client_slug" TEXT,
    "client_name" TEXT,
    "discord_webhook_id" TEXT,
    "discord_webhook_url" TEXT,
    "category_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "auto_managed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT,
    "target" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "color" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_states" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "last_checked" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_discord_channel_id_key" ON "channels"("discord_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_client_slug_key" ON "channels"("client_slug");

-- CreateIndex
CREATE INDEX "notifications_channel_id_created_at_idx" ON "notifications"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "poll_states_source_key" ON "poll_states"("source");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
