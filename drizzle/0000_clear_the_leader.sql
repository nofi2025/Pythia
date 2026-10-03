CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assessments_owner` ON `assessments` (`owner`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_assessment` ON `audit` (`assessment`);--> statement-breakpoint
CREATE TABLE `edges` (
	`assessment` text NOT NULL,
	`revision` integer NOT NULL,
	`id` text NOT NULL,
	`source` text NOT NULL,
	`target` text NOT NULL,
	`critical` integer NOT NULL,
	`alternative` text NOT NULL,
	PRIMARY KEY(`assessment`, `revision`, `id`),
	FOREIGN KEY (`assessment`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`assessment` text NOT NULL,
	`revision` integer NOT NULL,
	`id` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	PRIMARY KEY(`assessment`, `revision`, `id`),
	FOREIGN KEY (`assessment`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
