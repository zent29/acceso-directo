
// Configuración de Supabase
const SUPABASE_URL = 'https://svyqvpuuqqvqkssbcssz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZpVwCk2J0-lMz6NdpFGvog_fzszx87m';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // Referencias UI
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const addBtn = document.getElementById('addBtn');
    const shortcutsList = document.getElementById('shortcutsList');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');

    // UI Perfil
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

    let shortcuts = [];
    let currentUser = null;

    // --- Inicialización ---
    checkUserSession();
    loadLocalProfilePhoto();

    // --- UI Event Listeners ---

    // Dropdown Logic
    userBadge.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown-item') || e.target.tagName === 'INPUT') return;
        profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!userBadge.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });

    // Inputs
    addBtn.addEventListener('click', addShortcut);
    searchInput.addEventListener('input', (e) => renderShortcuts(e.target.value));

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') titleInput.value.trim() === '' ? addShortcut() : titleInput.focus();
    });
    titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addShortcut();
    });

    // Perfil
    changePhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handleProfilePhotoChange);

    loginBtn.addEventListener('click', async () => {
        try {
            await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.href
                }
            });
        }
        catch (e) { console.error(e); alert('Error al iniciar sesión'); }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });

    // --- Lógica Híbrida (Local vs Nube) ---

    async function checkUserSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });

        handleSession(session);
    }

    function handleSession(session) {
        currentUser = session?.user || null;

        if (currentUser) {
            // MODO NUBE
            const { user_metadata } = currentUser;
            userName.textContent = user_metadata.full_name || 'Usuario';
            userRole.textContent = 'Cuenta de Google';
            if (user_metadata.avatar_url) setAvatar(user_metadata.avatar_url);

            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'flex';
        } else {
            // MODO LOCAL (LIBRE)
            userName.textContent = 'Usuario';
            userRole.textContent = 'Perfil Local';
            loadLocalProfilePhoto();

            loginBtn.style.display = 'flex';
            logoutBtn.style.display = 'none';
        }

        // Cargar datos (de la fuente que corresponda)
        fetchShortcuts();
    }

    async function fetchShortcuts() {
        if (currentUser) {
            // Cargar de Supabase
            try {
                const { data, error } = await supabaseClient
                    .from('shortcuts')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                shortcuts = data || [];
            } catch (error) {
                console.error('Error Supabase:', error);
            }
        } else {
            // Cargar de LocalStorage
            shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
        }
        renderShortcuts(searchInput.value);
    }

    async function addShortcut() {
        const urlValue = urlInput.value.trim();
        const titleValue = titleInput.value.trim();

        if (!urlValue) {
            shakeInput(urlInput);
            return;
        }

        let formattedUrl = urlValue;
        if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

        let domain = '';
        try { domain = new URL(formattedUrl).hostname; }
        catch (e) { shakeInput(urlInput); return; }

        const title = titleValue || domain;
        const icon = `https://www.google.com/s2/favicons?domain=${formattedUrl}&sz=128`;

        if (currentUser) {
            // GUARDAR EN NUBE
            try {
                const { data, error } = await supabaseClient
                    .from('shortcuts')
                    .insert([{ title, url: formattedUrl, icon, user_id: currentUser.id }])
                    .select();

                if (error) throw error;
                if (data) {
                    shortcuts.unshift(data[0]);
                    renderShortcuts(searchInput.value);

                    // Limpiar inputs
                    urlInput.value = '';
                    titleInput.value = '';
                    urlInput.focus();
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('Error de Supabase: ' + (error.message || 'Error desconocido'));
            }
        } else {
            // GUARDAR LOCALMENTE
            const newShortcut = {
                id: Date.now(), // ID temporal local
                title,
                url: formattedUrl,
                icon,
                created_at: new Date().toISOString()
            };
            shortcuts.unshift(newShortcut);
            saveLocalShortcuts();
        }

        renderShortcuts(searchInput.value);
        urlInput.value = '';
        titleInput.value = '';
        urlInput.focus();
    }

    window.removeShortcut = async function (id, event) {
        event.stopPropagation();
        event.preventDefault();

        if (confirm('¿Eliminar acceso directo?')) {
            if (currentUser) {
                // BORRAR DE NUBE
                try {
                    const { error } = await supabaseClient
                        .from('shortcuts')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    shortcuts = shortcuts.filter(s => s.id !== id);
                } catch (e) {
                    console.error(e);
                    alert('Error al eliminar de la nube.');
                }
            } else {
                // BORRAR LOCAL
                shortcuts = shortcuts.filter(s => s.id !== id);
                saveLocalShortcuts();
            }
            renderShortcuts(searchInput.value);
        }
    };

    function saveLocalShortcuts() {
        localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    }

    // --- Utilidades ---
    function setAvatar(url) {
        avatarImage.src = url;
        avatarImage.style.display = 'block';
        avatarInitial.style.display = 'none';
    }

    function handleProfilePhotoChange(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const result = e.target.result;
                setAvatar(result);
                localStorage.setItem('localProfilePhoto', result);
            };
            reader.readAsDataURL(file);
        }
    }

    function loadLocalProfilePhoto() {
        // Solo cargar foto local si NO estamos mostrando un avatar de Google
        if (!currentUser) {
            const localPhoto = localStorage.getItem('localProfilePhoto');
            if (localPhoto) {
                setAvatar(localPhoto);
            } else {
                avatarImage.style.display = 'none';
                avatarInitial.style.display = 'flex';
            }
        }
    }

    function renderShortcuts(filterText = '') {
        shortcutsList.innerHTML = '';
        const term = filterText.toLowerCase();

        const filteredShortcuts = shortcuts.filter(shortcut =>
            (shortcut.title && shortcut.title.toLowerCase().includes(term)) ||
            (shortcut.url && shortcut.url.toLowerCase().includes(term))
        );

        if (filteredShortcuts.length === 0) {
            shortcutsList.style.display = 'none';
            emptyState.style.display = 'flex';

            if (term) {
                emptyState.querySelector('.empty-icon').innerHTML = '<i class="fa-solid fa-search"></i>';
                emptyState.querySelector('p').textContent = `No se encontraron resultados para "${filterText}"`;
            } else {
                emptyState.querySelector('.empty-icon').innerHTML = '<i class="fa-solid fa-link"></i>';
                emptyState.querySelector('p').textContent = 'No hay accesos directos. ¡Agrega uno!';
            }
        } else {
            emptyState.style.display = 'none';
            shortcutsList.style.display = 'grid';

            filteredShortcuts.forEach(shortcut => {
                const card = document.createElement('div');
                card.className = 'shortcut-card';
                card.style.animation = 'fadeInUp 0.5s ease-out backwards';

                card.innerHTML = `
                    <button class="delete-btn" onclick="removeShortcut(${shortcut.id}, event)">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <a href="${shortcut.url}" target="_blank" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center; width: 100%;">
                        <div class="shortcut-icon">
                            <img src="${shortcut.icon}" alt="${shortcut.title}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fa-solid fa-globe\'></i>'">
                        </div>
                        <div class="shortcut-title">${shortcut.title}</div>
                        <div class="shortcut-url">${new URL(shortcut.url).hostname}</div>
                    </a>
                `;
                shortcutsList.appendChild(card);
            });
        }
    }

    function shakeInput(input) {
        input.style.borderColor = '#ff4040';
        input.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(0)' }
        ], { duration: 400 });
        setTimeout(() => input.style.borderColor = 'var(--glass-border)', 1500);
    }
});
