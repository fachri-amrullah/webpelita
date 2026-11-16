CREATE TABLE `user_roles` (
    `user_id` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'KADER') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `role`),
    INDEX `user_roles_role_idx` (`role`),
    CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `user_roles` (`user_id`, `role`)
SELECT `id`, `role` FROM `users`;
