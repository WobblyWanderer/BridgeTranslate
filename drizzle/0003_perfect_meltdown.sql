CREATE TABLE `form_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceType` varchar(20) NOT NULL,
	`sourceName` varchar(255),
	`sourceUrl` text,
	`sourceKey` text,
	`sourceMimeType` varchar(120),
	`formTitle` varchar(255) NOT NULL,
	`questionsJson` text NOT NULL,
	`answersJson` text NOT NULL,
	`missingJson` text NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'extracted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_sessions_id` PRIMARY KEY(`id`)
);
