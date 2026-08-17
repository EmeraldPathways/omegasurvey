CREATE TABLE `recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`survey_id` integer NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text,
	`status` text DEFAULT 'imported' NOT NULL,
	`email_message_id` text,
	`last_error` text,
	`sent_at` text,
	`opened_at` text,
	`submitted_at` text,
	`reminder_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipients_survey_email_unique` ON `recipients` (`survey_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipients_token_hash_unique` ON `recipients` (`token_hash`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`answers_json` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_recipient_unique` ON `responses` (`recipient_id`);--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`questions_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
