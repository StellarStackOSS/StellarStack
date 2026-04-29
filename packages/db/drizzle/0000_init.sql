CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"ip" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"preferred_locale" text DEFAULT 'en' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sha256" text,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"storage" text NOT NULL,
	"s3_object_key" text,
	"locked" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"author" text,
	"docker_images" jsonb NOT NULL,
	"stop_signal" text NOT NULL,
	"startup_command" text NOT NULL,
	"config_files" jsonb,
	"variables" jsonb NOT NULL,
	"install_image" text NOT NULL,
	"install_entrypoint" text NOT NULL,
	"install_script" text NOT NULL,
	"lifecycle" jsonb NOT NULL,
	"features" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs_progress" (
	"job_id" text PRIMARY KEY NOT NULL,
	"server_id" uuid,
	"type" text NOT NULL,
	"percent" bigint DEFAULT 0 NOT NULL,
	"message_code" text,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"ip" text NOT NULL,
	"port" integer NOT NULL,
	"alias" text,
	"server_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_allocations_node_ip_port_unique" UNIQUE("node_id","ip","port")
);
--> statement-breakpoint
CREATE TABLE "node_pairing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_pairing_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fqdn" text NOT NULL,
	"scheme" text NOT NULL,
	"daemon_port" integer NOT NULL,
	"sftp_port" integer NOT NULL,
	"daemon_public_key" text,
	"memory_total_mb" bigint NOT NULL,
	"disk_total_mb" bigint NOT NULL,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "schedule_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"sort_order" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb,
	"delay_seconds" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cron" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"only_when_online" boolean DEFAULT false NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_allocations" (
	"server_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	CONSTRAINT "server_allocations_server_id_allocation_id_pk" PRIMARY KEY("server_id","allocation_id")
);
--> statement-breakpoint
CREATE TABLE "server_subusers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_variables" (
	"server_id" uuid NOT NULL,
	"variable_key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "server_variables_server_id_variable_key_pk" PRIMARY KEY("server_id","variable_key")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"primary_allocation_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"memory_limit_mb" bigint NOT NULL,
	"cpu_limit_percent" bigint NOT NULL,
	"disk_limit_mb" bigint NOT NULL,
	"docker_image" text NOT NULL,
	"status" text NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs_progress" ADD CONSTRAINT "jobs_progress_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_allocations" ADD CONSTRAINT "node_allocations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_pairing_tokens" ADD CONSTRAINT "node_pairing_tokens_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_allocations" ADD CONSTRAINT "server_allocations_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_allocations" ADD CONSTRAINT "server_allocations_allocation_id_node_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."node_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_subusers" ADD CONSTRAINT "server_subusers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_subusers" ADD CONSTRAINT "server_subusers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_primary_allocation_id_node_allocations_id_fk" FOREIGN KEY ("primary_allocation_id") REFERENCES "public"."node_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "backups_server_id_idx" ON "backups" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "backups_completed_at_idx" ON "backups" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "jobs_progress_server_id_idx" ON "jobs_progress" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "node_allocations_server_id_idx" ON "node_allocations" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "nodes_connected_at_idx" ON "nodes" USING btree ("connected_at");--> statement-breakpoint
CREATE INDEX "schedule_tasks_schedule_id_idx" ON "schedule_tasks" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "schedules_server_id_idx" ON "schedules" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "schedules_next_run_at_idx" ON "schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "server_subusers_server_id_idx" ON "server_subusers" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "server_subusers_user_id_idx" ON "server_subusers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "servers_owner_id_idx" ON "servers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "servers_node_id_idx" ON "servers" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "servers_status_idx" ON "servers" USING btree ("status");