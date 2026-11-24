# Portal Inmobiliario & Panel de Administración - Nida Yalico

Sitio web oficial, catálogo interactivo y **Panel de Administración Privado** para la agente inmobiliaria **Nida Yalico** (Yalimak Inmobiliaria), especialista en el **Cono Norte de Lima** (Los Olivos, SMP, Comas, Carabayllo, Independencia y Puente Piedra).

---

## 🌟 Novedad: Panel de Administración Sin Tocar Código (`admin.html`)

Olvídate de Decap CMS o sistemas complejos de Git. Ahora tienes un panel visual en la web donde Nida puede:

1. **Publicar nuevos inmuebles:** Llenar título, código, tipo, operación (*Venta/Alquiler*), distrito, dirección, precios ($ y S/.), $m^2$, cuartos, baños, cocheras, descripción y características.
2. **Subir fotografías directamente (Drag & Drop):** Arrastra fotos desde tu computadora o celular. Las fotos se almacenan en la nube pública de Supabase con URL permanente. Puedes elegir cuál es la foto de portada.
3. **Editar propiedades existentes:** Corregir precios o descripciones con 1 clic.
4. **Cambiar estado del inmueble:** Marcar como **Disponible**, **Vendido**, **Alquilado** u **Oculto** (borrador).
5. **Eliminar propiedades:** Con confirmación de seguridad.
6. **Subir los 6 inmuebles iniciales:** Botón en el panel para migrar el catálogo de muestra a Supabase con 1 solo clic.

---

## ⚡ Configuración de Supabase en 2 Minutos

Para tener tu base de datos y almacén de fotos en la nube 100% gratis:

1. **Crea tu cuenta gratuita:** Entra a [https://supabase.com](https://supabase.com) y crea un nuevo proyecto (dale un nombre como `nida-inmobiliaria`).
2. **Ejecuta el script SQL:**
   - En el menú lateral de Supabase, entra a **SQL Editor** -> haz clic en **+ New Query**.
   - Abre el archivo [`supabase-setup.sql`](file:///c:/Users/USUARIO/Documents/CARLOS%20WEB/supabase-setup.sql) de tu proyecto, copia todo su contenido, pégalo en Supabase y presiona **RUN**.
   - *(Esto crea la tabla `properties`, el almacén de fotos `property-images` y los permisos de seguridad automáticamente)*.
3. **Conecta el panel:**
   - En Supabase ve a **Project Settings** (engranaje abajo a la izquierda) -> **API**.
   - Copia tu **Project URL** y tu **anon public key**.
   - Abre [`admin.html`](file:///c:/Users/USUARIO/Documents/CARLOS%20WEB/admin.html) en tu navegador, haz clic en el botón superior **"Conexión"**, pega ambos datos y dale a **"Guardar Conexión"**.
   - *(También puedes pegarlas en el archivo [`js/supabase-config.js`](file:///c:/Users/USUARIO/Documents/CARLOS%20WEB/js/supabase-config.js) si prefieres)*.
4. **Crea la cuenta de acceso de Nida:**
   - En la pantalla de login de `admin.html`, escribe su correo y tu contraseña deseada y haz clic en **"¿Primera vez? Crear cuenta de Nida con este correo"**.

---

## 📁 Estructura del Proyecto

```text
CARLOS WEB/
│
├── index.html               # Web principal (Buscador, Catálogo, Servicios, Bio, Contacto)
├── propiedad.html           # Ficha de detalle dedicada con galería y simulador hipotecario
├── admin.html               # PANEL DE ADMINISTRACIÓN PRIVADO PARA NIDA YALICO
│
├── supabase-setup.sql       # Script SQL de 1 clic para configurar Supabase
│
├── css/
│   └── style.css            # Estilos personalizados, gradientes dorados y animaciones
│
├── js/
│   ├── admin.js             # Lógica del panel de administración (CRUD, fotos, estados)
│   ├── supabase-config.js   # Conector con la base de datos y storage de Supabase
│   ├── app.js               # Lógica del catálogo público y filtros de index.html
│   ├── property-detail.js   # Lógica de la ficha individual, galería y simulador
│   └── data.js              # Base de datos local de respaldo
│
└── README.md                # Documentación del proyecto
```

---

## 🚀 Cómo Usar el Sitio Web y el Admin

* **Para ver la web pública:** Haz doble clic en [`index.html`](file:///c:/Users/USUARIO/Documents/CARLOS%20WEB/index.html).
* **Para administrar inmuebles:** Haz doble clic en [`admin.html`](file:///c:/Users/USUARIO/Documents/CARLOS%20WEB/admin.html) o haz clic en *"Acceso Asesora"* en el pie de página de la web pública.
* **Modo Prueba:** Si aún no has creado tu proyecto de Supabase, puedes hacer clic en *"Entrar en Modo Prueba"* en `admin.html` para explorar el panel y probar el formulario de inmediato.
