CREATE TABLE IF NOT EXISTS "server_crashes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"exit_code" integer NOT NULL,
	"signal" text,
	"oom_killed" integer NOT NULL DEFAULT 0,
	"log_tail" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_crashes" ADD CONSTRAINT "server_crashes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_crashes_server_id_occurred_at_idx" ON "server_crashes" USING btree ("server_id","occurred_at");
