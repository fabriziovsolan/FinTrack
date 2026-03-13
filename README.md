# 💰 FinTrack

Aplicación de seguimiento financiero personal: tarjetas de crédito, préstamos e ingresos.

## ✨ Funcionalidades

- 📊 **Dashboard** con resumen mensual, balance neto y distribución del ingreso
- 💳 **Tarjetas de crédito** — límite, consumo por mes, cuotas, barra de uso
- 🏦 **Préstamos** — monto original, saldo restante, cuota mensual, progreso de cancelación
- 💵 **Ingresos** — registro mensual con historial completo
- 🏷️ **Detección automática de banco** — Santander, BBVA, Galicia, Macro, Naranja X, Ualá, Mercado Pago y más
- 💾 **Persistencia con localStorage** — los datos se guardan en el navegador

---

## 🚀 Deploy en Netlify (recomendado)

### Opción A — Sin terminal (más fácil)

1. Abrí [netlify.com](https://netlify.com) e iniciá sesión (o creá una cuenta gratis)
2. Conectá tu repositorio de GitHub **o** arrastrá la carpeta del proyecto a [netlify.com/drop](https://app.netlify.com/drop)
3. Si usás GitHub:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. ¡Listo! Netlify te da una URL pública

### Opción B — Con terminal

```bash
# 1. Instalá dependencias
npm install

# 2. Build de producción
npm run build

# 3. Instalá Netlify CLI (una sola vez)
npm install -g netlify-cli

# 4. Deploy
netlify deploy --prod --dir=dist
```

---

## 💻 Desarrollo local

```bash
npm install
npm run dev
```

Abrí http://localhost:5173

---

## 📁 Estructura del proyecto

```
fintrack/
├── index.html           # Entrada HTML
├── vite.config.js       # Config de Vite
├── netlify.toml         # Config de Netlify
├── public/
│   ├── favicon.svg
│   └── _redirects       # Para SPA routing en Netlify
└── src/
    ├── main.jsx         # Entry point React
    ├── index.css        # Estilos globales
    └── App.jsx          # Toda la lógica de la app
```

---

## 🛠️ Stack

- **React 18** + **Vite 5**
- **localStorage** para persistencia de datos
- Sin dependencias adicionales de UI — todo en CSS-in-JS
