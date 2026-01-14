🚀 Mis Accesos Pro

¡Bienvenido a **Mis Accesos Pro**! Una aplicación web ultra-rápida, estética y funcional para gestionar tus marcadores y accesos directos favoritos con un diseño premium inspirado en **ChromeOS y Android**.

![Preview](https://www.google.com/s2/favicons?domain=google.com&sz=128) <!-- Puedes reemplazar esto con una captura de pantalla real -->

## ✨ Características Principales

- 🎨 **Diseño Glassmorphism Premium**: Interfaz moderna con efectos de desenfuerzo, gradientes neón y animaciones fluidas.
- 📱 **Totalmente Responsivo**: Optimizado específicamente para móviles con una cuadrícula inteligente que se adapta a cualquier pantalla.
- 📌 **Sistema de Fijación (Pin)**: Ancla tus sitios más usados en la parte superior para que nunca se muevan.
- 🔄 **Orden Inteligente**: Los nuevos accesos aparecen automáticamente al principio. Además, puedes arrastrar y soltar (Drag & Drop) para organizar todo a tu gusto.
- 🔐 **Autenticación con Google**: Inicia sesión para sincronizar tus datos en la nube o úsalo de forma local sin registro.
- 💾 **Persistencia Híbrida**: Usa **Supabase** para el almacenamiento en la nube y **LocalStorage** como respaldo local.
- ⚡ **Acciones Rápidas**: Copia URLs al portapapeles con un clic y elimina accesos con feedback instantáneo.

## 🛠️ Tecnologías Utilizadas

*   **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+).
*   **Backend & DB**: [Supabase](https://supabase.com/) (Auth & PostgreSQL).
*   **Librerías**: 
    *   [SortableJS](https://sortablejs.github.io/Sortable/) para el sistema de arrastre.
    *   [FontAwesome](https://fontawesome.com/) para la iconografía.
    *   Google Fonts (Outfit) para la tipografía.

## 🚀 Instalación y Uso

### Requisitos previos
- Un navegador moderno.
- (Opcional) [Docker](https://www.docker.com/) para despliegue rápido.

### Ejecución Local
1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/mis-accesos-pro.git
   ```
2. Abre el archivo `index.html` en tu navegador.

### Despliegue con Docker
Si prefieres usar Docker, ya tenemos todo configurado:
```bash
docker compose up -d --build
```
La aplicación estará disponible en `http://localhost:8080`.

## 📸 Capturas de Pantalla (Diseño Móvil)
El diseño móvil cuenta con:
*   Perfil minimalista en la esquina superior izquierda (solo foto).
*   Botones de acción (Eliminar y Fijar) diseñados para una interacción táctil perfecta.
*   Cuadrícula flexible de iconos circulares.

---

Desarrollado con ❤️ para una experiencia de navegación superior.
