-- CreateTable
CREATE TABLE "public"."ResponseAnalysis" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responseId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "sentiment" TEXT NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "categories" TEXT[],
    "topics" TEXT[],
    "keywords" TEXT[],
    "emotion" TEXT NOT NULL,
    "customerEffort" TEXT NOT NULL,
    "requiresFollowup" BOOLEAN NOT NULL,
    "recommendedDepartment" TEXT NOT NULL,
    "recommendedPriority" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "ResponseAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseAnalysis_responseId_key" ON "public"."ResponseAnalysis"("responseId");

-- CreateIndex
CREATE INDEX "ResponseAnalysis_sentiment_idx" ON "public"."ResponseAnalysis"("sentiment");

-- CreateIndex
CREATE INDEX "ResponseAnalysis_requiresFollowup_idx" ON "public"."ResponseAnalysis"("requiresFollowup");

-- AddForeignKey
ALTER TABLE "public"."ResponseAnalysis" ADD CONSTRAINT "ResponseAnalysis_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
