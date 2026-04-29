ALTER TABLE "schedule_tasks" ALTER COLUMN "sort_order" SET DATA TYPE integer USING ("sort_order"::integer);--> statement-breakpoint
ALTER TABLE "schedule_tasks" ALTER COLUMN "delay_seconds" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ALTER COLUMN "delay_seconds" SET DATA TYPE integer USING ("delay_seconds"::integer);--> statement-breakpoint
ALTER TABLE "schedule_tasks" ALTER COLUMN "delay_seconds" SET DEFAULT 0;
