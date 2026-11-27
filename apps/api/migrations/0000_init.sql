CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` integer,
	`ip` text,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_resource_idx` ON `audit_log` (`resource`,`resource_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_name_unique` ON `permissions` (`name`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`token_version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer NOT NULL,
	`message` text NOT NULL,
	`created_by` integer,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_exam_idx` ON `announcements` (`exam_id`);--> statement-breakpoint
CREATE TABLE `answers` (
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`response` text,
	`flagged` integer DEFAULT false NOT NULL,
	`saved_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`auto_score` real,
	`manual_score` real,
	`feedback` text,
	`graded_by` integer,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer NOT NULL,
	`candidate_id` integer NOT NULL,
	`is_sandbox` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deadline_at` text NOT NULL,
	`extra_minutes` integer DEFAULT 0 NOT NULL,
	`submitted_at` text,
	`last_seen_at` text,
	`session_id` text,
	`paper` text NOT NULL,
	`score` real,
	`max_score` real NOT NULL,
	`pending_manual` integer DEFAULT 0 NOT NULL,
	`scratchpad` text DEFAULT '' NOT NULL,
	`verify_code` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_verifyCode_unique` ON `attempts` (`verify_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_one_per_candidate` ON `attempts` (`exam_id`,`candidate_id`) WHERE is_sandbox = 0;--> statement-breakpoint
CREATE INDEX `attempts_exam_idx` ON `attempts` (`exam_id`,`status`);--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`response` text,
	`resolved_by` integer,
	`resolved_at` text,
	`score_before` real,
	`score_after` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `disputes_attempt_idx` ON `disputes` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `disputes_status_idx` ON `disputes` (`status`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`exam_id` integer NOT NULL,
	`candidate_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`exam_id`, `candidate_id`),
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `enrollments_candidate_idx` ON `enrollments` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `exam_questions` (
	`exam_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`exam_id`, `question_id`),
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`total_marks` real NOT NULL,
	`pass_percent` real DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`shuffle_questions` integer DEFAULT true NOT NULL,
	`shuffle_options` integer DEFAULT true NOT NULL,
	`draw_easy` integer,
	`draw_medium` integer,
	`draw_hard` integer,
	`block_copy_paste` integer DEFAULT true NOT NULL,
	`results_published` integer DEFAULT false NOT NULL,
	`results_published_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exams_owner_idx` ON `exams` (`owner_id`);--> statement-breakpoint
CREATE INDEX `exams_window_idx` ON `exams` (`status`,`starts_at`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`type` text NOT NULL,
	`detail` text,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `incidents_attempt_idx` ON `incidents` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`correct` text DEFAULT '[]' NOT NULL,
	`marks` real NOT NULL,
	`scheme` text DEFAULT 'exact' NOT NULL,
	`explanation` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_owner_idx` ON `questions` (`owner_id`);--> statement-breakpoint
CREATE INDEX `questions_topic_idx` ON `questions` (`topic`,`difficulty`);