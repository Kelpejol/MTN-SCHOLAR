-- CreateTable
CREATE TABLE `mtnvc_scholar` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `matricNumber` VARCHAR(191) NOT NULL,
    `matricDisplay` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `lastRemindedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mtnvc_scholar_matricNumber_key`(`matricNumber`),
    INDEX `mtnvc_scholar_email_idx`(`email`),
    INDEX `mtnvc_scholar_fullName_idx`(`fullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_institution` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `normalizedName` VARCHAR(255) NOT NULL,
    `location` VARCHAR(191) NULL,
    `geopoliticalZone` ENUM('NORTH_CENTRAL', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_SOUTH', 'SOUTH_WEST') NULL,
    `ceremonyRegion` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mtnvc_institution_normalizedName_key`(`normalizedName`),
    INDEX `mtnvc_institution_ceremonyRegion_idx`(`ceremonyRegion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_vote` (
    `id` VARCHAR(191) NOT NULL,
    `scholarId` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `vcName` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mtnvc_vote_scholarId_key`(`scholarId`),
    INDEX `mtnvc_vote_institutionId_idx`(`institutionId`),
    INDEX `mtnvc_vote_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_otp_code` (
    `id` VARCHAR(191) NOT NULL,
    `scholarId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mtnvc_otp_code_scholarId_createdAt_idx`(`scholarId`, `createdAt`),
    INDEX `mtnvc_otp_code_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_reminder_log` (
    `id` VARCHAR(191) NOT NULL,
    `scholarId` VARCHAR(191) NOT NULL,
    `status` ENUM('SENT', 'FAILED') NOT NULL,
    `error` VARCHAR(500) NULL,
    `adminId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mtnvc_reminder_log_scholarId_createdAt_idx`(`scholarId`, `createdAt`),
    INDEX `mtnvc_reminder_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_admin` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mtnvc_admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_voting_config` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `opensAt` DATETIME(3) NOT NULL,
    `closesAt` DATETIME(3) NOT NULL,
    `isPaused` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_reminder_template` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `subject` VARCHAR(191) NOT NULL,
    `heading` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `buttonLabel` VARCHAR(191) NOT NULL,
    `showSteps` BOOLEAN NOT NULL DEFAULT true,
    `updatedById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_login_attempt` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(300) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mtnvc_login_attempt_key_createdAt_idx`(`key`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mtnvc_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mtnvc_audit_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mtnvc_vote` ADD CONSTRAINT `mtnvc_vote_scholarId_fkey` FOREIGN KEY (`scholarId`) REFERENCES `mtnvc_scholar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mtnvc_vote` ADD CONSTRAINT `mtnvc_vote_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `mtnvc_institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mtnvc_otp_code` ADD CONSTRAINT `mtnvc_otp_code_scholarId_fkey` FOREIGN KEY (`scholarId`) REFERENCES `mtnvc_scholar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mtnvc_reminder_log` ADD CONSTRAINT `mtnvc_reminder_log_scholarId_fkey` FOREIGN KEY (`scholarId`) REFERENCES `mtnvc_scholar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mtnvc_audit_log` ADD CONSTRAINT `mtnvc_audit_log_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `mtnvc_admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
