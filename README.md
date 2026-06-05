# Trans Andina — Sistema de Terminal de Buses

SaaS multi-tenant para gestión de terminales de buses (Bolivia).

## Requisitos previos

- **Node.js** v18+
- **MySQL** 8.0+ corriendo localmente
- **ngrok** (opcional, para acceso externo)

---

## 1. Configurar variables de entorno

```bash
cd backend
cp .env.example .env
```

Editar `.env` con tus datos de MySQL:

```env
PORT=3000
JWT_SECRET=un_secreto_largo_y_aleatorio
CLIENT_URL=http://localhost:5173
NODE_ENV=development
DATABASE_URL="mysql://root:tu_password@localhost:3306/terminal_buses"
```

---

## 2. Base de datos

```bash
cd backend
npm install

# Crear tablas
npx prisma migrate deploy

# Cargar datos iniciales (tenant, sucursal, usuarios de prueba)
npm run seed
```

---

## 3. Levantar el backend

```bash
cd backend
npm run dev
# Corre en http://localhost:3000
```

---

## 4. Levantar el frontend

```bash
cd frontend
npm install
npm run dev
# Corre en http://localhost:5173
```

---

## 5. Acceder al sistema

| URL | Descripción |
|-----|-------------|
| `http://localhost:5173/t/trans-andina/login` | Login de operadores |
| `http://localhost:5173/admin/login` | Login de admin de plataforma |

### Credenciales de prueba (tenant `trans-andina`)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@transandina.com` | `Admin2024!` | Admin (pedirá cambio de contraseña) |
| `boletero@transandina.com` | `Boletero2024!` | Boletero |

---

## 6. Acceso externo con ngrok (opcional)

Para que compañeros accedan desde otros dispositivos:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend (escucha en todas las interfaces)
cd frontend && npm run dev -- --host

# Terminal 3 — ngrok (dominio estático ya configurado en vite.config.ts)
ngrok http 5173 --domain shortwave-vertebrae-massive.ngrok-free.app
```

Compartir: `https://shortwave-vertebrae-massive.ngrok-free.app/t/trans-andina/login`

> El backend **no** necesita exponerse con ngrok — el proxy de Vite redirige `/api` a `localhost:3000` internamente.

---

## Estructura del proyecto

```
TerminalBuses/
├── backend/      # Express + Prisma + MySQL
│   ├── prisma/   # Schema y migraciones
│   └── src/      # Rutas, middlewares, jobs
└── frontend/     # React + Vite + Tailwind
    └── src/
        ├── pages/        # Páginas por módulo
        ├── components/   # UI reutilizable
        └── context/      # Auth context
```

## Módulos disponibles

| Módulo | Roles |
|--------|-------|
| Dashboard | Todos |
| Habilitaciones (schedules) | Todos |
| Boletos | Todos |
| Encomiendas | Boletero, Supervisor, Admin |
| Caja | Todos |
| Reportes | Supervisor, Admin |
| Sucursales, Rutas, Flotas, Personal | Admin |
