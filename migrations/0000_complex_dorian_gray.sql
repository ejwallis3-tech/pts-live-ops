CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch` text NOT NULL,
	`message` text NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`tone` text DEFAULT 'neutral' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `card_triggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` text NOT NULL,
	`triggered_at` integer NOT NULL,
	`delivered_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_triggers_card_id_unique` ON `card_triggers` (`card_id`);--> statement-breakpoint
CREATE TABLE `external_event_triggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`fired_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_event_triggers_event_id_unique` ON `external_event_triggers` (`event_id`);--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch` text NOT NULL,
	`interaction_type` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`resolution_seconds` integer,
	`outcome` text,
	`nps_score` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`leaderboard_revealed` integer DEFAULT false NOT NULL,
	`round_started_at` integer,
	`round_ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `slips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch` text NOT NULL,
	`target_branch` text NOT NULL,
	`desk_type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`resolution_seconds` integer,
	`outcome` text,
	`created_at` integer NOT NULL
);
