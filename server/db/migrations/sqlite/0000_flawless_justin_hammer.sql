CREATE TABLE `contractors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`business_type` text DEFAULT 'individual' NOT NULL,
	`ein` text,
	`email` text,
	`w9_received` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_1099_exempt` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `estimated_tax_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`quarter` text NOT NULL,
	`year` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount_paid` real,
	`date_paid` text,
	`confirmation_number` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`payment_method` text NOT NULL,
	`client_billable` integer DEFAULT false NOT NULL,
	`tax_deductible` integer DEFAULT true NOT NULL,
	`deductible_pct` real DEFAULT 100 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`mercury_transaction_id` text,
	`contractor_id` text,
	`section_179` integer DEFAULT false NOT NULL,
	`business_use_pct` real DEFAULT 100 NOT NULL,
	`receipts` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mileage_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`from_location` text NOT NULL,
	`to_location` text NOT NULL,
	`miles` real NOT NULL,
	`purpose` text DEFAULT 'Business' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`payment_method` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`client_billable` integer DEFAULT false NOT NULL,
	`tax_deductible` integer DEFAULT true NOT NULL,
	`deductible_pct` real DEFAULT 100 NOT NULL,
	`frequency` text NOT NULL,
	`next_due_date` text NOT NULL,
	`end_date` text,
	`auto_add` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
