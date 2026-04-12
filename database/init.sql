-- FORZAR EL CONTEXTO CORRECTO
SET search_path TO public;

-- =============================================
-- SCRIPT DE BASE DE DATOS: PROLIFE
-- =============================================

-- 1. Crear tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Crear tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    id_rol INT REFERENCES roles(id_rol) ON DELETE SET NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla de Preferencias
CREATE TABLE IF NOT EXISTS preferencias_usuario (
    id_preferencia SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    genero_musical VARCHAR(50),
    cronotipo VARCHAR(50) 
);

-- 4. Crear tabla de Logs de Energía
CREATE TABLE IF NOT EXISTS logs_energia (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nivel_fatiga_detectado INT CHECK (nivel_fatiga_detectado BETWEEN 0 AND 10),
    timestamp_log TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Crear tabla de Tareas
CREATE TABLE IF NOT EXISTS tareas (
    id_tarea SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'Pendiente', 
    prioridad VARCHAR(10) DEFAULT 'Media'
);

-- =============================================
-- INSERCIÓN DE DATOS SEMILLA
-- =============================================

INSERT INTO roles (nombre_rol) VALUES ('Administrador'), ('Usuario') 
ON CONFLICT DO NOTHING;

INSERT INTO usuarios (nombre, email, password_hash, id_rol) VALUES 
('Ana Martínez', 'ana.mtz@prolife.com', '$2b$12$KZeeb8LpDq8U.O2YmZ3VveO5H1l7Nf1q1', 2),
('Roberto Gómez', 'roberto.g@prolife.com', '$2b$12$KZeeb8LpDq8U.O2YmZ3VveO5H1l7Nf1q1', 2)
ON CONFLICT DO NOTHING;

INSERT INTO preferencias_usuario (id_usuario, genero_musical, cronotipo) VALUES 
(1, 'Rock / Indie', 'Vespertino'),
(2, 'Lo-Fi / Jazz', 'Matutino')
ON CONFLICT DO NOTHING;

INSERT INTO tareas (id_usuario, titulo, estado, prioridad) VALUES 
(1, 'Inspección de Perímetro A1', 'Pendiente', 'Alta'),
(2, 'Revisión de Sensores Térmicos', 'Progreso', 'Alta')
ON CONFLICT DO NOTHING;

INSERT INTO logs_energia (id_usuario, nivel_fatiga_detectado) VALUES 
(1, 6)
ON CONFLICT DO NOTHING;

-- VERIFICACIÓN FINAL
SELECT * FROM usuarios;