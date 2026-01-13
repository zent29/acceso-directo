/**
 * LÓGICA DE LA APLICACIÓN: Mis Accesos Pro
 * Gestiona el almacenamiento (Local y Supabase), renderizado y reordenamiento de tarjetas.
 */

// --- CONFIGURACIÓN DE SUPABASE (Nube) ---
const SUPABASE_URL = 'https://svyqvpuuqqvqkssbcssz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZpVwCk2J0-lMz6NdpFGvog_fzszx87m';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // --- REFERENCIAS A ELEMENTOS DE LA INTERFAZ (UI) ---
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const tagsInput = document.getElementById('tagsInput');
    const addBtn = document.getElementById('addBtn');
    const shortcutsList = document.getElementById('shortcutsList');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');

    // UI del Perfil de Usuario
    const userAvatar = document.getElementById('userAvatar');
    const avatarImage = document.getElementById('avatarImage');
    const avatarInitial = document.getElementById('avatarInitial');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const photoInput = document.getElementById('photoInput');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userBadge = document.getElementById('userBadge');
    const profileDropdown = document.getElementById('profileDropdown');

    // --- VARIABLES DE ESTADO ---
    let shortcuts = [];         // Array principal con todos los accesos directos
    let currentUser = null;     // Datos del usuario logueado actualmente
    let sortableInstance = null; // Instancia de SortableJS para el Drag & Drop

    // --- INICIALIZACIÓN ---
    checkUserSession();         // Verifica si hay una sesión activa de Google
    loadLocalProfilePhoto();    // Carga la foto de perfil desde el localStorage local

    // --- ESCUCHADORES DE EVENTOS (EVENT LISTENERS) ---

    // Manejo del menú desplegable del perfil (Dropdown)
    userBadge.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown-item') || e.target.tagName === 'INPUT') return;
        profileDropdown.classList.toggle('show');
    });

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!userBadge.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });

    // Acciones de añadir y buscar
    addBtn.addEventListener('click', addShortcut);
    searchInput.addEventListener('input', (e) => renderShortcuts(e.target.value));

    // Navegación rápida entre inputs con la tecla "Enter"
    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') titleInput.focus(); });
    titleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') descriptionInput.focus(); });
    descriptionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') tagsInput.focus(); });
    tagsInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addShortcut(); });

    // Gestión de fotos de perfil y login
    changePhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handleProfilePhotoChange);

    loginBtn.addEventListener('click', async () => {
        try {
            await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.href }
            });
        } catch (e) { console.error(e); alert('Error al iniciar sesión'); }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });

    // --- LÓGICA DE SESIÓN Y PERSISTENCIA ---

    // Comprueba si el usuario está autenticado con Google
    async function checkUserSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        supabaseClient.auth.onAuthStateChange((_event, session) => handleSession(session));
        handleSession(session);
    }

    // Configura la interfaz según si hay usuario o no
    function handleSession(session) {
        currentUser = session?.user || null;
        if (currentUser) {
            // MODO NUBE: Usuario logueado
            const { user_metadata } = currentUser;
            userName.textContent = user_metadata.full_name || 'Usuario';
            userRole.textContent = 'Cuenta de Google';
            if (user_metadata.avatar_url) setAvatar(user_metadata.avatar_url);
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'flex';
        } else {
            // MODO LOCAL: Usuario visitante
            userName.textContent = 'Usuario';
            userRole.textContent = 'Perfil Local';
            loadLocalProfilePhoto();
            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
        fetchShortcuts(); // Al terminar, carga los accesos correspondientes
    }

    // Trae los datos desde la nube o localStorage
    async function fetchShortcuts() {
        if (currentUser) {
            try {
                // Intentamos traerlos ordenados por nuestra columna manual de posición
                const { data, error } = await supabaseClient
                    .from('shortcuts')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('display_order', { ascending: true });

                if (error) {
                    // Si falla el orden manual (ej: columna no existe), ordenamos por fecha
                    const { data: retryData, error: retryError } = await supabaseClient
                        .from('shortcuts')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .order('created_at', { ascending: false });
                    if (retryError) throw retryError;
                    shortcuts = retryData || [];
                } else {
                    shortcuts = data || [];
                }
            } catch (error) { console.error('Error Supabase:', error); }
        } else {
            // Modo local: Cargar del navegador
            shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
        }
        renderShortcuts(searchInput.value);
    }

    // Función para crear un nuevo acceso directo
    async function addShortcut() {
        const urlValue = urlInput.value.trim();
        const titleValue = titleInput.value.trim();
        const descriptionValue = descriptionInput.value.trim();
        const tagsValue = tagsInput.value.trim();

        if (!urlValue) { shakeInput(urlInput); return; }

        // Formatear URL (asegurar https://)
        let formattedUrl = urlValue;
        if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

        let domain = '';
        try { domain = new URL(formattedUrl).hostname; } catch (e) { shakeInput(urlInput); return; }

        const title = titleValue || domain;
        const icon = `https://www.google.com/s2/favicons?domain=${formattedUrl}&sz=128`;
        const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];
        const description = descriptionValue;
        const display_order = shortcuts.length; // Se coloca al final por defecto

        if (currentUser) {
            // Guardar en la base de datos de Supabase
            try {
                const { data, error } = await supabaseClient
                    .from('shortcuts')
                    .insert([{
                        title, url: formattedUrl, icon, user_id: currentUser.id,
                        description, tags, display_order
                    }])
                    .select();

                if (error) throw error;
                if (data) {
                    shortcuts.push(data[0]);
                    renderShortcuts(searchInput.value);
                    clearInputs();
                }
            } catch (error) {
                console.error('Fallo inserción avanzada:', error);
                // Reintento simplificado (fallback)
                const { data } = await supabaseClient.from('shortcuts').insert([{ title, url: formattedUrl, icon, user_id: currentUser.id }]).select();
                if (data) { shortcuts.push({ ...data[0], description, tags }); renderShortcuts(searchInput.value); clearInputs(); }
            }
        } else {
            // Guardar en LocalStorage
            const newShortcut = {
                id: Date.now(), title, url: formattedUrl, icon,
                description, tags, display_order, created_at: new Date().toISOString()
            };
            shortcuts.push(newShortcut);
            saveLocalShortcuts();
            renderShortcuts(searchInput.value);
            clearInputs();
        }
    }

    // Limpia los campos del formulario
    function clearInputs() {
        urlInput.value = ''; titleInput.value = ''; descriptionInput.value = ''; tagsInput.value = '';
        urlInput.focus();
    }

    // Eliminar un acceso directo
    window.removeShortcut = async function (id, event) {
        event.stopPropagation();
        event.preventDefault();

        if (confirm('¿Eliminar este acceso directo?')) {
            if (currentUser) {
                try {
                    await supabaseClient.from('shortcuts').delete().eq('id', id);
                    shortcuts = shortcuts.filter(s => s.id !== id);
                } catch (e) { console.error(e); }
            } else {
                shortcuts = shortcuts.filter(s => s.id !== id);
                saveLocalShortcuts();
            }
            renderShortcuts(searchInput.value);
        }
    };

    // Acción para copiar URL al portapapeles
    window.copyUrl = function (url, event) {
        event.stopPropagation();
        event.preventDefault();
        navigator.clipboard.writeText(url).then(() => {
            const btn = event.currentTarget;
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            btn.style.color = '#00ff88';
            setTimeout(() => {
                btn.innerHTML = originalIcon;
                btn.style.color = '';
            }, 2000);
        });
    };

    // --- FUNCIONES DE ALMACENAMIENTO Y ORDEN ---

    window.saveLocalShortcuts = function () {
        localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    }

    // Actualiza la posición (orden) en la base de datos tras un Drag & Drop
    async function updateShortcutsOrder() {
        if (currentUser) {
            for (let i = 0; i < shortcuts.length; i++) {
                await supabaseClient.from('shortcuts').update({ display_order: i }).eq('id', shortcuts[i].id);
            }
        } else {
            saveLocalShortcuts();
        }
    }

    // --- UTILIDADES DE RENDERIZADO ---

    function setAvatar(url) {
        avatarImage.src = url; avatarImage.style.display = 'block'; avatarInitial.style.display = 'none';
    }

    function renderShortcuts(filterText = '') {
        shortcutsList.innerHTML = '';
        const term = filterText.toLowerCase();

        // Aplicamos el filtro de búsqueda a múltiples campos
        const filteredShortcuts = shortcuts.filter(shortcut =>
            (shortcut.title && shortcut.title.toLowerCase().includes(term)) ||
            (shortcut.url && shortcut.url.toLowerCase().includes(term)) ||
            (shortcut.description && shortcut.description.toLowerCase().includes(term)) ||
            (shortcut.tags && shortcut.tags.some(tag => tag.toLowerCase().includes(term)))
        );

        if (filteredShortcuts.length === 0) {
            shortcutsList.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = term ? `No se encontraron resultados para "${filterText}"` : 'Aún no tienes accesos. ¡Agrega uno!';
        } else {
            emptyState.style.display = 'none';
            shortcutsList.style.display = 'grid';

            filteredShortcuts.forEach((shortcut, index) => {
                const card = document.createElement('div');
                card.className = 'shortcut-card';
                card.dataset.id = shortcut.id; // Guardamos el ID en el HTML para referenciarlo al moverlo
                card.style.animation = `fadeInUp 0.5s ease-out ${index * 0.05}s backwards`;

                const tagsHtml = (shortcut.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join('');
                const descriptionHtml = shortcut.description ? `<div class="shortcut-description">${shortcut.description}</div>` : '';

                card.innerHTML = `
                    <div class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
                    <button class="delete-btn" onclick="removeShortcut(${shortcut.id}, event)"><i class="fa-solid fa-times"></i></button>
                    <button class="copy-btn" onclick="copyUrl('${shortcut.url}', event)" title="Copiar URL">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <a href="${shortcut.url}" target="_blank" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center; width: 100%;">
                        <div class="shortcut-icon">
                            <img src="${shortcut.icon}" alt="${shortcut.title}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fa-solid fa-globe\'></i>'">
                        </div>
                        <div class="shortcut-title">${shortcut.title}</div>
                        ${descriptionHtml}
                        <div class="shortcut-tags">${tagsHtml}</div>
                        <div class="shortcut-url">${new URL(shortcut.url).hostname}</div>
                    </a>
                `;
                shortcutsList.appendChild(card);
            });
            initSortable(); // Reinicializamos el sistema de Drag & Drop para las nuevas tarjetas
        }
    }

    // Inicia SortableJS con efectos premium de movimiento
    function initSortable() {
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(shortcutsList, {
            animation: 500,                         // Duración de la animación en ms
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", // Curva de rebote profesional
            ghostClass: 'sortable-ghost',           // Clase para el "fantasma" que queda en el hueco
            dragClass: 'sortable-drag',             // Clase para el elemento que flota en el aire
            forceFallback: true,                    // Permite que se vea bien el estilo neón al arrastrar
            fallbackOnBody: true,
            swapThreshold: 0.6,                     // Sensibilidad al intercambiar posiciones
            invertSwap: true,
            onEnd: () => reorderShortcutsInArray()  // Se ejecuta al soltar la tarjeta
        });
    }

    // Calcula el nuevo orden del array basado en la posición visual de los elementos HTML
    function reorderShortcutsInArray() {
        const currentCards = [...shortcutsList.querySelectorAll('.shortcut-card')];
        const newOrder = currentCards.map(card => {
            const id = card.dataset.id;
            return shortcuts.find(s => String(s.id) === String(id));
        }).filter(s => s !== undefined);

        if (newOrder.length === shortcuts.length) {
            shortcuts = newOrder;
            updateShortcutsOrder();
        }
    }

    // Animación de error (vibración) si el input está vacío
    function shakeInput(input) {
        input.style.borderColor = '#ff4040';
        input.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(0)' }
        ], { duration: 400 });
        setTimeout(() => input.style.borderColor = 'var(--glass-border)', 1500);
    }

    // Gestión de perfil local
    function handleProfilePhotoChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target.result; setAvatar(result); localStorage.setItem('localProfilePhoto', result);
            };
            reader.readAsDataURL(file);
        }
    }

    function loadLocalProfilePhoto() {
        if (!currentUser) {
            const localPhoto = localStorage.getItem('localProfilePhoto');
            if (localPhoto) setAvatar(localPhoto);
            else { avatarImage.style.display = 'none'; avatarInitial.style.display = 'flex'; }
        }
    }
});
