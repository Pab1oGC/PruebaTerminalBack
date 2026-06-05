-- CreateTable
CREATE TABLE `platform_admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_admins_username_key`(`username`),
    UNIQUE INDEX `platform_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(64) NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `emailContacto` VARCHAR(255) NOT NULL,
    `telefonoContacto` VARCHAR(20) NULL,
    `estado` ENUM('Active', 'Suspended', 'Archived') NOT NULL DEFAULT 'Active',
    `fechaCompra` DATETIME(3) NULL,
    `fechaSuspension` DATETIME(3) NULL,
    `fechaArchivado` DATETIME(3) NULL,
    `notasAdmin` TEXT NULL,
    `require2fa` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenants_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `userAgent` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_revokedAt_idx`(`userId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NULL,
    `codigoEmpresa` VARCHAR(64) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `userAgent` TEXT NOT NULL,
    `exitoso` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_codigoEmpresa_username_createdAt_idx`(`codigoEmpresa`, `username`, `createdAt`),
    INDEX `login_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_tokenHash_key`(`tokenHash`),
    INDEX `password_reset_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `ciudad` VARCHAR(128) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `branches_tenantId_nombre_key`(`tenantId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `rol` ENUM('admin', 'boletero', 'chofer') NOT NULL,
    `branchId` INTEGER NULL,
    `estado` ENUM('Activo', 'Inactivo', 'Suspendido') NOT NULL DEFAULT 'Activo',
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(45) NULL,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorSecret` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_tenantId_username_key`(`tenantId`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `seat_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `config` VARCHAR(8) NOT NULL,
    `pisos` INTEGER NOT NULL DEFAULT 1,
    `layout` JSON NOT NULL,
    `capacidadTotal` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `placa` VARCHAR(20) NOT NULL,
    `marca` VARCHAR(64) NOT NULL,
    `modelo` VARCHAR(64) NOT NULL,
    `anio` INTEGER NOT NULL,
    `seatTemplateId` INTEGER NOT NULL,
    `estado` ENUM('Activo', 'Inactivo', 'Mantenimiento') NOT NULL DEFAULT 'Activo',

    UNIQUE INDEX `buses_tenantId_placa_key`(`tenantId`, `placa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drivers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `cedula` VARCHAR(20) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `licenciaNumero` VARCHAR(64) NOT NULL,
    `licenciaVence` DATETIME(3) NOT NULL,
    `estado` ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',

    UNIQUE INDEX `drivers_tenantId_cedula_key`(`tenantId`, `cedula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `nombre` VARCHAR(128) NOT NULL,
    `cedula` VARCHAR(20) NOT NULL,
    `telefono` VARCHAR(20) NULL,

    UNIQUE INDEX `helpers_tenantId_cedula_key`(`tenantId`, `cedula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `origenBranchId` INTEGER NOT NULL,
    `destino` VARCHAR(128) NOT NULL,
    `distanciaKm` DOUBLE NULL,
    `precioMaximoAtt` DOUBLE NOT NULL,
    `precioSugerido` DOUBLE NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `routes_tenantId_origenBranchId_destino_key`(`tenantId`, `origenBranchId`, `destino`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `busId` INTEGER NOT NULL,
    `routeId` INTEGER NOT NULL,
    `salidaAt` DATETIME(3) NOT NULL,
    `driverMainId` INTEGER NOT NULL,
    `driverReliefId` INTEGER NULL,
    `helperId` INTEGER NULL,
    `estado` ENUM('Habilitada', 'Finalizada', 'Cancelada') NOT NULL DEFAULT 'Habilitada',
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `schedules_tenantId_estado_salidaAt_idx`(`tenantId`, `estado`, `salidaAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `scheduleId` INTEGER NOT NULL,
    `asientoNumero` INTEGER NOT NULL,
    `pasajeroNombre` VARCHAR(128) NOT NULL,
    `pasajeroCi` VARCHAR(20) NOT NULL,
    `precio` DOUBLE NOT NULL,
    `metodoPago` ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Pendiente') NOT NULL,
    `tipoDocumento` ENUM('Recibo', 'Factura') NOT NULL DEFAULT 'Recibo',
    `nit` VARCHAR(20) NULL,
    `razonSocial` VARCHAR(255) NULL,
    `estado` ENUM('Vendido', 'Reservado') NOT NULL DEFAULT 'Vendido',
    `vendidoPor` INTEGER NOT NULL,
    `vendidoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tickets_tenantId_scheduleId_idx`(`tenantId`, `scheduleId`),
    UNIQUE INDEX `tickets_tenantId_scheduleId_asientoNumero_key`(`tenantId`, `scheduleId`, `asientoNumero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parcels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `scheduleId` INTEGER NOT NULL,
    `remitenteNombre` VARCHAR(128) NOT NULL,
    `remitenteCi` VARCHAR(20) NOT NULL,
    `remitenteTel` VARCHAR(20) NULL,
    `destinatarioNombre` VARCHAR(128) NOT NULL,
    `destinatarioCi` VARCHAR(20) NOT NULL,
    `destinatarioTel` VARCHAR(20) NULL,
    `descripcion` TEXT NOT NULL,
    `pesoKg` DOUBLE NULL,
    `precio` DOUBLE NOT NULL,
    `estado` ENUM('Registrada', 'Embarcada', 'Entregada') NOT NULL DEFAULT 'Registrada',
    `registradoPor` INTEGER NOT NULL,
    `registradoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `parcels_tenantId_scheduleId_idx`(`tenantId`, `scheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `abiertaAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `saldoInicial` DOUBLE NOT NULL,
    `cerradaAt` DATETIME(3) NULL,
    `saldoFinal` DOUBLE NULL,
    `diferencia` DOUBLE NULL,
    `estado` ENUM('Abierta', 'Cerrada') NOT NULL DEFAULT 'Abierta',

    INDEX `cash_sessions_tenantId_estado_idx`(`tenantId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_movements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `sessionId` INTEGER NOT NULL,
    `tipo` ENUM('Ingreso', 'Egreso') NOT NULL,
    `origen` ENUM('Boleto', 'Encomienda', 'Manual') NOT NULL,
    `refId` INTEGER NULL,
    `monto` DOUBLE NOT NULL,
    `concepto` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cash_movements_tenantId_sessionId_idx`(`tenantId`, `sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `tenantCodigo` VARCHAR(64) NOT NULL,
    `userId` INTEGER NULL,
    `accion` VARCHAR(64) NOT NULL,
    `entidad` VARCHAR(64) NOT NULL,
    `entidadId` INTEGER NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `userAgent` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_tenantId_entidad_createdAt_idx`(`tenantId`, `entidad`, `createdAt`),
    INDEX `audit_log_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seat_templates` ADD CONSTRAINT `seat_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buses` ADD CONSTRAINT `buses_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buses` ADD CONSTRAINT `buses_seatTemplateId_fkey` FOREIGN KEY (`seatTemplateId`) REFERENCES `seat_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `helpers` ADD CONSTRAINT `helpers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_origenBranchId_fkey` FOREIGN KEY (`origenBranchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_busId_fkey` FOREIGN KEY (`busId`) REFERENCES `buses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_driverMainId_fkey` FOREIGN KEY (`driverMainId`) REFERENCES `drivers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_driverReliefId_fkey` FOREIGN KEY (`driverReliefId`) REFERENCES `drivers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_helperId_fkey` FOREIGN KEY (`helperId`) REFERENCES `helpers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_vendidoPor_fkey` FOREIGN KEY (`vendidoPor`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parcels` ADD CONSTRAINT `parcels_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parcels` ADD CONSTRAINT `parcels_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parcels` ADD CONSTRAINT `parcels_registradoPor_fkey` FOREIGN KEY (`registradoPor`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `cash_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
