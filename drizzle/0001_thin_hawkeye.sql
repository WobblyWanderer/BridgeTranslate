CREATE TABLE `saved_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`traitsJson` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceText` text NOT NULL,
	`traitsJson` text NOT NULL,
	`profileDescription` text,
	`purpose` varchar(120) NOT NULL,
	`outputStyle` varchar(80) NOT NULL,
	`extraContext` text,
	`preserveEmotion` int NOT NULL DEFAULT 1,
	`meaningMap` text,
	`translation` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `translation_jobs_id` PRIMARY KEY(`id`)
);
