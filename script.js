/**
 * LÓGICA DE LA APLICACIÓN: Mis Accesos Pro
 * Gestiona el almacenamiento (Local y Supabase), renderizado y reordenamiento de tarjetas.
 */

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://svyqvpuuqqvqkssbcssz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZpVwCk2J0-lMz6NdpFGvog_fzszx87m';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // --- REFERENCIAS A ELEMENTOS DE LA UI ---
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const tagsInput = document.getElementById('tagsInput');
    const addBtn = document.getElementById('addBtn');
    const shortcutsList = document.getElementById('shortcutsList');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');

    // UI del Perfil
    const avatarImage = document.getElementById('avatarImage');
    const avatarInitial = document.getElementById('avatarInitial');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const photoInput = document.getElementById('photoInput');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userBadge = document.getElementById('userBadge');
    const profileDropdown = document.getElementById('profileDropdown');

    // --- ESTADO ---
    let shortcuts = [];
    let currentUser = null;
    let sortableInstance = null;

    // --- INICIALIZACIÓN ---
    checkUserSession();
    loadLocalProfilePhoto();

    // --- EVENTOS ---
    userBadge.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown-item') || e.target.tagName === 'INPUT') return;
        profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!userBadge.contains(e.target)) profileDropdown.classList.remove('show');
    });

    addBtn.addEventListener('click', addShortcut);
    searchInput.addEventListener('input', (e) => renderShortcuts(e.target.value));

    // Atajos de teclado
    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') titleInput.focus(); });
    titleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') descriptionInput.focus(); });
    descriptionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') tagsInput.focus(); });
    tagsInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addShortcut(); });

    changePhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handleProfilePhotoChange);

    loginBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });

    // --- LOGICA PRINCIPAL ---

    async function checkUserSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        supabaseClient.auth.onAuthStateChange((_event, session) => handleSession(session));
        handleSession(session);
    }

    function handleSession(session) {
        currentUser = session?.user || null;
        if (currentUser) {
            const { user_metadata } = currentUser;
            userName.textContent = user_metadata.full_name || 'Usuario';
            userRole.textContent = 'Cuenta de Google';
            if (user_metadata.avatar_url) setAvatar(user_metadata.avatar_url);
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'flex';
        } else {
            userName.textContent = 'Usuario';
            userRole.textContent = 'Perfil Local';
            loadLocalProfilePhoto();
            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }
        fetchShortcuts();
    }

    async function fetchShortcuts() {
        if (currentUser) {
            try {
                const { data, error } = await supabaseClient
                    .from('shortcuts')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('display_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (error) {
                    // Fallback si no existe display_order
                    const { data: retryData } = await supabaseClient
                        .from('shortcuts')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .order('created_at', { ascending: false });
                    shortcuts = retryData || [];
                } else {
                    shortcuts = data || [];
                }
            } catch (e) { console.error(e); }
        } else {
            shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
        }
        renderShortcuts();
    }
    async function addShortcut() {
        const urlValue = urlInput.value.trim();
        const titleValue = titleInput.value.trim();
        const descriptionValue = descriptionInput.value.trim();
        const tagsValue = tagsInput.value.trim();

        if (!urlValue) {
            shakeInput(urlInput);
            return;
        }

        const originalBtnContent = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
        addBtn.disabled = true;

        // Pequeño delay para que el usuario vea el feedback
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            let formattedUrl = urlValue;
            if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

            let domain = '';
            try {
                domain = new URL(formattedUrl).hostname;
            } catch (e) {
                shakeInput(urlInput);
                addBtn.innerHTML = originalBtnContent;
                addBtn.disabled = false;
                return;
            }

            const title = titleValue || domain;
            const icon = `https://www.google.com/s2/favicons?domain=${formattedUrl}&sz=128`;
            const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];
            const description = descriptionValue;
            // Ajustar órdenes: el nuevo será el 0, el resto se desplaza
            const minOrder = shortcuts.length > 0 ? Math.min(...shortcuts.map(s => s.display_order || 0)) : 0;
            const targetOrder = minOrder - 1;

            const newShortcut = {
                title,
                url: formattedUrl,
                icon,
                description,
                tags,
                display_order: targetOrder, // El menor de todos para ser primero
                is_pinned: false, // Por defecto no está fijado
                id: Date.now(),
                user_id: currentUser ? currentUser.id : null,
                created_at: new Date().toISOString()
            };

            // Intentar guardar en Supabase si hay usuario
            let savedToCloud = false;
            if (currentUser) {
                try {
                    const { data, error } = await supabaseClient
                        .from('shortcuts')
                        .insert([newShortcut])
                        .select();

                    if (!error && data && data.length > 0) {
                        shortcuts.unshift(data[0]); // Agregar al principio del array local
                        savedToCloud = true;
                    }
                } catch (e) {
                    console.warn('No se pudo guardar en la nube, guardando localmente:', e);
                }
            }

            // Si no se guardó en la nube, guardar localmente
            if (!savedToCloud) {
                shortcuts.unshift(newShortcut);
                saveLocalShortcuts();
            }

            renderShortcuts();
            updateShortcutsOrder(); // Sincroniza y guarda los nuevos órdenes
            clearInputs();

            // Mostrar éxito brevemente
            addBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado!';
            await new Promise(resolve => setTimeout(resolve, 800));

            addBtn.innerHTML = originalBtnContent;
            addBtn.disabled = false;
        } catch (error) {
            console.error('Error inesperado:', error);
            addBtn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error';
            await new Promise(resolve => setTimeout(resolve, 1500));
            addBtn.innerHTML = originalBtnContent;
            addBtn.disabled = false;
        }
    }

    function clearInputs() {
        urlInput.value = ''; titleInput.value = ''; descriptionInput.value = ''; tagsInput.value = '';
        urlInput.focus();
    }

    function saveLocalShortcuts() {
        // Guardar también el estado de pinning
        localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    }

    async function updateShortcutsOrder() {
        const allCards = [...shortcutsList.querySelectorAll('.shortcut-card')];
        const orderedShortcuts = [];

        allCards.forEach((card, index) => {
            const id = card.dataset.id;
            const item = shortcuts.find(s => String(s.id) === String(id));
            if (item) {
                item.display_order = index;
                orderedShortcuts.push(item);
            }
        });

        shortcuts = orderedShortcuts;

        if (currentUser) {
            for (let i = 0; i < shortcuts.length; i++) {
                // Actualización silenciosa del orden
                supabaseClient.from('shortcuts').update({ display_order: i }).eq('id', shortcuts[i].id);
            }
        }
        saveLocalShortcuts();
    }

    function renderShortcuts(filterText = '') {
        if (!shortcutsList) return;
        shortcutsList.innerHTML = '';
        const term = filterText.toLowerCase();

        const filtered = shortcuts.filter(s =>
            (s.title && s.title.toLowerCase().includes(term)) ||
            (s.url && s.url.toLowerCase().includes(term)) ||
            (s.description && s.description.toLowerCase().includes(term)) ||
            (s.tags && s.tags.some(tag => tag.toLowerCase().includes(term)))
        ).sort((a, b) => {
            // 1. Prioridad a los fijados (Pinned)
            const aPinned = a.is_pinned === true || a.is_pinned === 'true';
            const bPinned = b.is_pinned === true || b.is_pinned === 'true';
            if (aPinned !== bPinned) return bPinned ? 1 : -1;

            // 2. Por orden de visualización (menor primero)
            const aOrder = a.display_order ?? 999999;
            const bOrder = b.display_order ?? 999999;
            if (aOrder !== bOrder) return aOrder - bOrder;

            // 3. Tie-breaker: Los más nuevos primero (por fecha de creación desc)
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        });

        if (filtered.length === 0) {
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = term ? `Sin resultados para "${filterText}"` : 'Aún no tienes accesos. ¡Agrega uno!';
            return;
        }
        emptyState.style.display = 'none';

        filtered.forEach((shortcut, index) => {
            const card = document.createElement('div');
            card.className = `shortcut-card ${shortcut.is_pinned ? 'is-pinned' : ''}`;
            card.dataset.id = shortcut.id;
            card.style.animation = `fadeInUp 0.5s ease-out ${index * 0.05}s backwards`;

            const tagsHtml = (shortcut.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join('');
            const descHtml = shortcut.description ? `<div class="shortcut-description">${shortcut.description}</div>` : '';

            card.innerHTML = `
                <div class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
                <button class="pin-btn ${shortcut.is_pinned ? 'active' : ''}" data-id="${shortcut.id}" title="${shortcut.is_pinned ? 'Desfijar' : 'Fijar'}">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
                <button class="delete-btn" data-id="${shortcut.id}"><i class="fa-solid fa-times"></i></button>
                <button class="copy-btn" data-url="${shortcut.url}" title="Copiar URL">
                    <i class="fa-solid fa-copy"></i>
                </button>
                <a href="${shortcut.url}" target="_blank" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <div class="shortcut-icon">
                        <img src="${shortcut.icon}" alt="${shortcut.title}" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fa-solid fa-globe\\'></i>'">
                    </div>
                    <div class="shortcut-title">${shortcut.title}</div>
                    ${descHtml}
                    <div class="shortcut-tags">${tagsHtml}</div>
                    <div class="shortcut-url">${new URL(shortcut.url).hostname}</div>
                </a>
            `;

            shortcutsList.appendChild(card);
        });

        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(shortcutsList, {
            animation: 500,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            forceFallback: true,
            fallbackOnBody: true,
            filter: '.delete-btn, .copy-btn, .pin-btn', // NO arrastrar desde los botones
            preventOnFilter: false, // Permitir que el clic pase al botón
            onEnd: () => updateShortcutsOrder()
        });
    }

    // --- DELEGACIÓN DE EVENTOS PARA BOTONES EN TARJETAS ---
    // Esto asegura que los botones siempre respondan, sin importar los re-renders
    shortcutsList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        const copyBtn = e.target.closest('.copy-btn');
        const pinBtn = e.target.closest('.pin-btn');

        if (pinBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = pinBtn.dataset.id;
            const shortcut = shortcuts.find(s => String(s.id) === String(id));
            if (shortcut) {
                shortcut.is_pinned = !shortcut.is_pinned;

                if (currentUser) {
                    supabaseClient.from('shortcuts').update({ is_pinned: shortcut.is_pinned }).eq('id', shortcut.id);
                }

                saveLocalShortcuts();
                renderShortcuts();
                updateShortcutsOrder();
            }
        }

        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = deleteBtn.dataset.id;
            const shortcut = shortcuts.find(s => String(s.id) === String(id));

            if (shortcut && confirm('¿Eliminar este acceso directo?')) {
                if (currentUser) {
                    try {
                        await supabaseClient.from('shortcuts').delete().eq('id', shortcut.id);
                    } catch (err) { console.error(err); }
                }
                shortcuts = shortcuts.filter(s => String(s.id) !== String(id));
                saveLocalShortcuts();
                renderShortcuts();
            }
        }

        if (copyBtn) {
            e.preventDefault();
            e.stopPropagation();
            const url = copyBtn.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                const icon = copyBtn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'fa-solid fa-check';
                copyBtn.style.color = '#00ff88';
                setTimeout(() => {
                    icon.className = originalClass;
                    copyBtn.style.color = '';
                }, 2000);
            });
        }
    });

    function shakeInput(input) {
        input.style.borderColor = '#ff4040';
        input.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(0)' }
        ], { duration: 400 });
        setTimeout(() => input.style.borderColor = '', 1500);
    }

    function handleProfilePhotoChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const res = e.target.result; setAvatar(res); localStorage.setItem('localProfilePhoto', res);
            };
            reader.readAsDataURL(file);
        }
    }

    function setAvatar(url) {
        avatarImage.src = url; avatarImage.style.display = 'block'; avatarInitial.style.display = 'none';
    }

    function loadLocalProfilePhoto() {
        if (!currentUser) {
            const photo = localStorage.getItem('localProfilePhoto');
            if (photo) setAvatar(photo);
        }
    }
});
