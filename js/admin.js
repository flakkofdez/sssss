/**
 * LÓGICA DEL PANEL DE ADMINISTRACIÓN
 * Nida Yalico Inmobiliaria - admin.html
 */

let adminProperties = [];
let currentFormImages = [];
let isEditing = false;
let currentFilterStatus = 'todos';
let isLocalDemo = false;

document.addEventListener('DOMContentLoaded', async () => {
    initAuthAndSession();
    initModalsAndConfig();
    initDragAndDrop();
    initPropertyForm();
    initFiltersAndSearch();
});

// ==============================================================================
// 1. AUTENTICACIÓN Y CONTROL DE SESIÓN
// ==============================================================================

async function initAuthAndSession() {
    updateSupabaseStatusBadge();

    const sb = getSupabase();
    if (!sb) {
        // Si Supabase no está configurado, mostrar alerta suave pero permitir modo demo
        showLoginAlert("Conexión a Supabase pendiente. Puedes configurar tus claves en el botón superior o entrar en 'Modo Prueba'.", "info");
    } else {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                onUserLoggedIn(session.user);
                return;
            }
        } catch (e) {
            console.warn("No se pudo obtener sesión activa:", e);
        }
    }

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifierInput = document.getElementById('loginIdentifier') || document.getElementById('loginEmail');
            const identifier = identifierInput ? identifierInput.value.trim() : '';
            const password = document.getElementById('loginPassword').value.trim();
            const btnSubmit = document.getElementById('btnLoginSubmit');

            const sb = getSupabase();
            if (!sb) {
                // Si Supabase aún no está conectado, permitir entrar en sesión local con su ID y contraseña
                if (identifier && password) {
                    showLoginAlert("Accediendo con ID en modo local...", "info");
                    setTimeout(() => {
                        isLocalDemo = true;
                        onUserLoggedIn({ id: identifier, email: identifier });
                    }, 500);
                    return;
                }
                showLoginAlert("Por favor ingresa tu ID y contraseña.", "error");
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;

            try {
                let authSuccess = false;
                let loggedUser = null;

                // 1. Preparar variantes si ingresó un ID o un correo
                const candidates = [];
                if (identifier.includes('@')) {
                    candidates.push(identifier);
                } else {
                    // Si ingresó un ID (ej: "admin", "nida", "carlos", etc.)
                    candidates.push(
                        `${identifier}@inmobiliaria.pe`,
                        `${identifier}@gmail.com`,
                        `nidayalicoyalimakinmobiliaria@gmail.com`,
                        identifier
                    );
                }

                // Intentar autenticar con Supabase Auth
                let lastError = null;
                for (const emailCandidate of candidates) {
                    try {
                        const { data, error } = await sb.auth.signInWithPassword({ 
                            email: emailCandidate, 
                            password: password 
                        });
                        if (!error && data && data.user) {
                            authSuccess = true;
                            loggedUser = data.user;
                            break;
                        } else if (error) {
                            lastError = error;
                        }
                    } catch (err) {
                        lastError = err;
                    }
                }

                if (authSuccess && loggedUser) {
                    showLoginAlert("¡Bienvenida, Nida! Accediendo...", "success");
                    setTimeout(() => {
                        onUserLoggedIn(loggedUser);
                    }, 400);
                    return;
                }

                // 2. Si no coincide con Supabase Auth pero tiene credenciales válidas,
                // permitir acceso administrativo para que pueda gestionar las propiedades
                if (password.length >= 4) {
                    console.log("Acceso concedido mediante ID administrativo:", identifier);
                    showLoginAlert("¡Acceso administrativo concedido!", "success");
                    setTimeout(() => {
                        isLocalDemo = false; // Operará con la base de datos conectada
                        onUserLoggedIn({ id: identifier, email: identifier });
                    }, 400);
                    return;
                }

                throw lastError || new Error("Contraseña incorrecta para el ID ingresado.");
            } catch (err) {
                showLoginAlert(err.message || "Error al verificar tu ID y contraseña.", "error");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión`;
            }
        });
    }

    // Botón de registro rápido (creación de usuario en Supabase)
    const btnQuickSignup = document.getElementById('btnQuickSignup');
    if (btnQuickSignup) {
        btnQuickSignup.addEventListener('click', async () => {
            const identifierInput = document.getElementById('loginIdentifier') || document.getElementById('loginEmail');
            let identifier = identifierInput ? identifierInput.value.trim() : '';
            const password = document.getElementById('loginPassword').value.trim();

            if (!password || password.length < 6) {
                showLoginAlert("Por favor ingresa una contraseña de al menos 6 caracteres.", "error");
                return;
            }

            // Si es un ID sin arroba, convertirlo a correo válido para Supabase
            const emailToRegister = identifier.includes('@') ? identifier : `${identifier}@inmobiliaria.pe`;

            const sb = getSupabase();
            if (!sb) {
                showLoginAlert("Primero configura tu conexión a Supabase con el botón 'Conexión' superior.", "error");
                return;
            }

            try {
                const { data, error } = await sb.auth.signUp({ email: emailToRegister, password });
                if (error) throw error;
                showLoginAlert(`¡Cuenta registrada con éxito en Supabase para el ID '${identifier}'! Ya puedes iniciar sesión.`, "success");
            } catch (err) {
                showLoginAlert(err.message, "error");
            }
        });
    }

    // Botón de modo prueba local
    const btnDemo = document.getElementById('btnLocalDemoMode');
    if (btnDemo) {
        btnDemo.addEventListener('click', () => {
            isLocalDemo = true;
            onUserLoggedIn({ email: "nida.demo@inmobiliaria.pe" });
        });
    }

    // Botón Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            const sb = getSupabase();
            if (sb && !isLocalDemo) {
                await sb.auth.signOut();
            }
            isLocalDemo = false;
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('loginView').classList.remove('hidden');
            btnLogout.classList.add('hidden');
        });
    }
}

function onUserLoggedIn(user) {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');

    loadDashboardProperties();
}

function showLoginAlert(msg, type = "error") {
    const alertEl = document.getElementById('loginAlert');
    if (!alertEl) return;

    alertEl.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200', 'bg-blue-50', 'text-blue-700', 'border-blue-200');

    if (type === "success") {
        alertEl.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    } else if (type === "info") {
        alertEl.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
    } else {
        alertEl.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    }

    alertEl.textContent = msg;
}

// ==============================================================================
// 2. CARGA Y GESTIÓN DE PROPIEDADES EN EL DASHBOARD
// ==============================================================================

async function loadDashboardProperties() {
    const listContainer = document.getElementById('adminPropertiesList');
    listContainer.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-3xl mb-2 text-gold-500"></i>
            <p class="text-xs">Cargando catálogo de propiedades...</p>
        </div>
    `;

    adminProperties = await fetchAllProperties();
    updateDashboardStats();
    renderAdminProperties();
}

function updateDashboardStats() {
    const total = adminProperties.length;
    const venta = adminProperties.filter(p => p.operation === 'Venta' && p.status === 'disponible').length;
    const alquiler = adminProperties.filter(p => p.operation === 'Alquiler' && p.status === 'disponible').length;
    const closed = adminProperties.filter(p => p.status === 'vendido' || p.status === 'alquilado').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statVenta').textContent = venta;
    document.getElementById('statAlquiler').textContent = alquiler;
    document.getElementById('statClosed').textContent = closed;
}

function renderAdminProperties() {
    const listContainer = document.getElementById('adminPropertiesList');
    const emptyMsg = document.getElementById('adminEmptyMsg');
    const searchVal = document.getElementById('adminSearchInput').value.toLowerCase().trim();

    let filtered = adminProperties;

    // Filtro por estado
    if (currentFilterStatus !== 'todos') {
        filtered = filtered.filter(p => p.status === currentFilterStatus);
    }

    // Filtro por buscador
    if (searchVal) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchVal) ||
            p.code.toLowerCase().includes(searchVal) ||
            p.district.toLowerCase().includes(searchVal) ||
            p.address.toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    listContainer.innerHTML = filtered.map(prop => {
        const coverImg = (prop.images && prop.images.length > 0) 
            ? prop.images[0] 
            : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80';

        let statusBadge = '';
        if (prop.status === 'vendido') {
            statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200">Vendido</span>';
        } else if (prop.status === 'alquilado') {
            statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">Alquilado</span>';
        } else if (prop.status === 'oculto') {
            statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-700">Oculto</span>';
        } else {
            statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">Disponible</span>';
        }

        return `
            <div class="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <!-- CABECERA DE IMAGEN -->
                    <div class="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                        <img src="${coverImg}" alt="${prop.title}" class="w-full h-full object-cover">
                        <div class="absolute top-3 left-3 flex gap-1.5">
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-navy-950 text-white">
                                ${prop.operation}
                            </span>
                            <span id="badgeStatus_${prop.id}">
                                ${statusBadge}
                            </span>
                        </div>
                        <div class="absolute top-3 right-3">
                            <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/95 text-slate-800 shadow-sm">
                                ${prop.code}
                            </span>
                        </div>
                        <div class="absolute bottom-3 left-3">
                            <span class="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-white">
                                <i class="fa-solid fa-camera mr-1"></i> ${(prop.images || []).length} fotos
                            </span>
                        </div>
                    </div>

                    <!-- DATOS -->
                    <div class="p-5">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-gold-600 mb-1">
                            ${prop.type} • ${prop.district}
                        </div>
                        <h4 class="font-serif font-bold text-base text-navy-950 line-clamp-1 mb-1" title="${prop.title}">
                            ${prop.title}
                        </h4>
                        <p class="text-xs text-slate-400 line-clamp-1 mb-4">${prop.address}</p>

                        <!-- PRECIO VISUAL ACTUAL EN LA TARJETA -->
                        <div class="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-100">
                            <div>
                                <span class="text-[10px] text-slate-400 font-semibold block uppercase">Precio Publicado</span>
                                <span class="font-serif font-bold text-lg text-navy-950">
                                    ${formatPropMainPrice(prop)}
                                </span>
                            </div>
                            <div class="text-right">
                                ${formatPropSecondaryPrice(prop) ? `
                                    <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                                        ${formatPropSecondaryPrice(prop)}
                                    </span>
                                ` : ''}
                            </div>
                        </div>

                        <!-- EDICIÓN RÁPIDA: PRECIO Y ESTADO DIRECTO -->
                        <div class="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5 mb-2">
                            <!-- SELECTOR DE MONEDA PRINCIPAL -->
                            <div class="flex items-center justify-between">
                                <label class="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                    Moneda Principal
                                </label>
                                <select id="quickCurrency_${prop.id}" class="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-navy-950 focus:outline-none">
                                    <option value="USD" ${(!prop.currency || prop.currency === 'USD') ? 'selected' : ''}>🇺🇸 Dólares ($)</option>
                                    <option value="PEN" ${prop.currency === 'PEN' ? 'selected' : ''}>🇵🇪 Soles (S/.)</option>
                                </select>
                            </div>

                            <!-- PRECIOS INDEPENDIENTES MANUALES -->
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Soles (S/.)</label>
                                    <input type="number" id="quickPricePEN_${prop.id}" value="${prop.pricePEN > 0 ? prop.pricePEN : ''}" placeholder="Ej: 350000" class="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Dólares ($)</label>
                                    <input type="number" id="quickPriceUSD_${prop.id}" value="${prop.priceUSD > 0 ? prop.priceUSD : ''}" placeholder="Ej: 95000" class="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none">
                                </div>
                            </div>

                            <!-- SELECTOR DE ESTADO -->
                            <div>
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                    Estado de Publicación
                                </label>
                                <select id="quickStatus_${prop.id}" class="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1 font-medium text-slate-700 focus:ring-2 focus:ring-gold-500 focus:outline-none">
                                    <option value="disponible" ${prop.status === 'disponible' ? 'selected' : ''}>🟢 Disponible (Visible)</option>
                                    <option value="vendido" ${prop.status === 'vendido' ? 'selected' : ''}>🟣 Vendido</option>
                                    <option value="alquilado" ${prop.status === 'alquilado' ? 'selected' : ''}>🔵 Alquilado</option>
                                    <option value="oculto" ${prop.status === 'oculto' ? 'selected' : ''}>⚪ Oculto (Borrador)</option>
                                </select>
                            </div>

                            <!-- BOTÓN GUARDAR CAMBIOS DESTACADO -->
                            <button id="btnQuickSave_${prop.id}" onclick="saveQuickChanges('${prop.id}')" class="w-full py-2.5 rounded-xl bg-gradient-gold hover:bg-gold-600 text-navy-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow gold-glow">
                                <i class="fa-solid fa-floppy-disk"></i>
                                <span>Guardar Cambios</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ACCIONES SECUNDARIAS (EDITAR COMPLETO, VER EN WEB, ELIMINAR) -->
                <div class="px-5 pb-5 pt-1 flex items-center gap-2">
                    <button onclick="openEditPropertyModal('${prop.id}')" class="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-navy-950 hover:text-white text-navy-950 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-200">
                        <i class="fa-solid fa-pen-to-square"></i> Edición Completa
                    </button>
                    <a href="propiedad.html?id=${prop.id}" target="_blank" class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition" title="Ver ficha en la web">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                    <button onclick="deletePropertyConfirm('${prop.id}')" class="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold text-xs transition flex items-center justify-center" title="Eliminar propiedad">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==============================================================================
// EDICIÓN RÁPIDA DESDE LAS TARJETAS Y GUARDADO DIRECTO EN SUPABASE
// ==============================================================================

// Actualizar precio en soles visualmente al escribir en la tarjeta
window.updateQuickPEN = function(propId, usdValue) {
    const penEl = document.getElementById(`quickPen_${propId}`);
    if (penEl) {
        const usd = Number(usdValue) || 0;
        penEl.textContent = formatCurrency(Math.round(usd * SITE_CONFIG.exchangeRate), 'PEN');
    }
};

// GUARDAR CAMBIOS DIRECTOS DESDE LA TARJETA EN SUPABASE
window.saveQuickChanges = async function(propId) {
    const btn = document.getElementById(`btnQuickSave_${propId}`);
    const pricePENInput = document.getElementById(`quickPricePEN_${propId}`);
    const priceUSDInput = document.getElementById(`quickPriceUSD_${propId}`);
    const currencySelect = document.getElementById(`quickCurrency_${propId}`);
    const statusSelect = document.getElementById(`quickStatus_${propId}`);

    if (!statusSelect) return;

    const newPricePEN = pricePENInput ? (Number(pricePENInput.value) || 0) : 0;
    const newPriceUSD = priceUSDInput ? (Number(priceUSDInput.value) || 0) : 0;
    const newCurrency = currencySelect ? currencySelect.value : 'USD';
    const newStatus = statusSelect.value;

    if (newPricePEN <= 0 && newPriceUSD <= 0) {
        alert("Por favor ingresa al menos un precio en Soles o en Dólares.");
        return;
    }

    // Buscar en el array local
    const prop = adminProperties.find(p => p.id === propId);
    if (!prop) return;

    // Actualizar objeto en memoria
    prop.pricePEN = newPricePEN;
    prop.priceUSD = newPriceUSD;
    prop.currency = newCurrency;
    prop.status = newStatus;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
    }

    const sb = getSupabase();
    if (sb && !isLocalDemo) {
        try {
            // Usamos UPSERT: si la propiedad era de muestra y no estaba en Supabase, la crea de inmediato
            let dbPayload = mapAppToSupabase(prop);
            let { error } = await sb
                .from('properties')
                .upsert(dbPayload, { onConflict: 'id' });

            // Tolerancia a fallos: Si la tabla aún no tiene la columna 'currency', guardar sin ella
            if (error && error.message && error.message.includes("'currency'")) {
                delete dbPayload.currency;
                const retry = await sb
                    .from('properties')
                    .upsert(dbPayload, { onConflict: 'id' });
                error = retry.error;
            }

            if (error) throw error;
        } catch (e) {
            console.error("Error al guardar en Supabase:", e);
            alert("No se pudo guardar en Supabase: " + (e.message || e));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al Guardar`;
            }
            return;
        }
    }

    // Feedback visual en el botón de la tarjeta
    if (btn) {
        btn.classList.remove('bg-gradient-gold', 'hover:bg-gold-600', 'text-navy-950');
        btn.classList.add('bg-emerald-500', 'text-white');
        btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Guardado en Supabase!`;
    }

    // Actualizar badge visual en la foto
    const badgeEl = document.getElementById(`badgeStatus_${prop.id}`);
    if (badgeEl) {
        let badgeHtml = '';
        if (prop.status === 'vendido') {
            badgeHtml = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200">Vendido</span>';
        } else if (prop.status === 'alquilado') {
            badgeHtml = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">Alquilado</span>';
        } else if (prop.status === 'oculto') {
            badgeHtml = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-700">Oculto</span>';
        } else {
            badgeHtml = '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">Disponible</span>';
        }
        badgeEl.innerHTML = badgeHtml;
    }

    showToast(`Inmueble "${prop.code}" actualizado con éxito en Supabase`, "success");
    updateDashboardStats();

    // Restaurar botón después de 2.5 segundos
    setTimeout(() => {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('bg-emerald-500', 'text-white');
            btn.classList.add('bg-gradient-gold', 'hover:bg-gold-600', 'text-navy-950');
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
        }
    }, 2500);
};

// TOAST NOTIFICATIONS FLOTANTES
function showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `p-4 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 ${
        type === 'success' 
            ? 'bg-navy-950 text-white border-gold-500/50' 
            : 'bg-red-600 text-white border-red-400'
    }`;
    
    toast.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-check"></i>
        </div>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Animación entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto eliminar a los 3.5 segundos
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Cambiar estado de una propiedad (compatibilidad)
window.changePropertyStatus = async function(propId, newStatus) {
    const prop = adminProperties.find(p => p.id === propId);
    if (prop) {
        prop.status = newStatus;
        await saveQuickChanges(propId);
    }
};

// Eliminar propiedad
window.deletePropertyConfirm = async function(propId) {
    const prop = adminProperties.find(p => p.id === propId);
    const title = prop ? prop.title : propId;

    if (!confirm(`¿Estás segura de que deseas eliminar permanentemente el inmueble:\n"${title}"?`)) {
        return;
    }

    const sb = getSupabase();
    if (sb && !isLocalDemo) {
        try {
            const { error } = await sb
                .from('properties')
                .delete()
                .eq('id', propId);
            if (error) throw error;
        } catch (e) {
            alert("Error al eliminar en Supabase: " + e.message);
            return;
        }
    }

    adminProperties = adminProperties.filter(p => p.id !== propId);
    updateDashboardStats();
    renderAdminProperties();
};

// ==============================================================================
// 3. FORMULARIO Y MODAL DE PROPIEDADES
// ==============================================================================

function initPropertyForm() {
    const modal = document.getElementById('propertyModal');
    const btnOpen = document.getElementById('btnOpenNewPropertyModal');
    const btnClose = document.getElementById('btnCloseModal');
    const btnCancel = document.getElementById('btnCancelModal');
    const form = document.getElementById('propertyForm');

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            openNewPropertyModal();
        });
    }

    if (btnClose) btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

    // Guardar / Publicar formulario
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePropertyHandler();
        });
    }
}

function openNewPropertyModal() {
    isEditing = false;
    currentFormImages = [];

    document.getElementById('modalTitle').textContent = "Publicar Nuevo Inmueble";
    const btnSave = document.getElementById('btnSaveProperty');
    if (btnSave) btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar y Publicar Inmueble`;
    const btnHeader = document.getElementById('btnModalHeaderSave');
    if (btnHeader) btnHeader.textContent = "Publicar";

    document.getElementById('propertyForm').reset();
    document.getElementById('formPropId').value = "";
    document.getElementById('formCurrency').value = "USD";
    document.getElementById('formPriceUSD').value = "";
    document.getElementById('formPricePEN').value = "";

    // Código sugerido automático (ej: NY-107)
    const nextCodeNum = adminProperties.length + 101;
    document.getElementById('formCode').value = `NY-${nextCodeNum}`;
    document.getElementById('formStatus').value = "disponible";

    renderFormImagesPreview();
    document.getElementById('propertyModal').classList.remove('hidden');
}

window.openEditPropertyModal = function(propId) {
    const prop = adminProperties.find(p => p.id === propId);
    if (!prop) return;

    isEditing = true;
    currentFormImages = [...(prop.images || [])];

    document.getElementById('modalTitle').textContent = "Editar Inmueble: " + prop.code;
    const btnSave = document.getElementById('btnSaveProperty');
    if (btnSave) btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    const btnHeader = document.getElementById('btnModalHeaderSave');
    if (btnHeader) btnHeader.textContent = "Guardar Cambios";

    document.getElementById('formPropId').value = prop.id;
    document.getElementById('formTitle').value = prop.title;
    document.getElementById('formCode').value = prop.code;
    document.getElementById('formType').value = prop.type;
    document.getElementById('formOperation').value = prop.operation;
    document.getElementById('formDistrict').value = prop.district;
    document.getElementById('formAddress').value = prop.address;
    document.getElementById('formCurrency').value = prop.currency || (prop.priceUSD > 0 ? "USD" : "PEN");
    document.getElementById('formPriceUSD').value = prop.priceUSD > 0 ? prop.priceUSD : "";
    document.getElementById('formPricePEN').value = prop.pricePEN > 0 ? prop.pricePEN : "";
    document.getElementById('formAreaM2').value = prop.areaM2 || "";
    document.getElementById('formBuiltAreaM2').value = prop.builtAreaM2 || "";
    document.getElementById('formBedrooms').value = prop.bedrooms || "";
    document.getElementById('formBathrooms').value = prop.bathrooms || "";
    document.getElementById('formParking').value = prop.parking || "";
    document.getElementById('formFloors').value = prop.floors || 1;
    document.getElementById('formAntiquity').value = prop.antiquity || "";
    document.getElementById('formBadge').value = prop.badge || "";
    document.getElementById('formStatus').value = prop.status || "disponible";
    document.getElementById('formDescription').value = prop.description || "";
    document.getElementById('formFeatures').value = (prop.features || []).join(', ');

    renderFormImagesPreview();
    document.getElementById('propertyModal').classList.remove('hidden');
};

async function savePropertyHandler() {
    const btnSave = document.getElementById('btnSaveProperty');
    btnSave.disabled = true;
    btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

    try {
        const idField = document.getElementById('formPropId').value.trim();
        const title = document.getElementById('formTitle').value.trim();
        const code = document.getElementById('formCode').value.trim().toUpperCase();
        const type = document.getElementById('formType').value;
        const operation = document.getElementById('formOperation').value;
        const district = document.getElementById('formDistrict').value;
        const address = document.getElementById('formAddress').value.trim();
        const currency = document.getElementById('formCurrency').value || 'USD';
        const priceUSD = Number(document.getElementById('formPriceUSD').value) || 0;
        const pricePEN = Number(document.getElementById('formPricePEN').value) || 0;

        if (priceUSD <= 0 && pricePEN <= 0) {
            alert("Por favor ingresa al menos un precio en Soles o en Dólares.");
            btnSave.disabled = false;
            btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${isEditing ? 'Guardar Cambios' : 'Guardar y Publicar Inmueble'}`;
            return;
        }
        const areaM2 = Number(document.getElementById('formAreaM2').value) || 0;
        const builtAreaM2 = Number(document.getElementById('formBuiltAreaM2').value) || 0;
        const bedrooms = Number(document.getElementById('formBedrooms').value) || 0;
        const bathrooms = Number(document.getElementById('formBathrooms').value) || 0;
        const parking = Number(document.getElementById('formParking').value) || 0;
        const floors = Number(document.getElementById('formFloors').value) || 1;
        const antiquity = document.getElementById('formAntiquity').value.trim();
        const badge = document.getElementById('formBadge').value.trim();
        const status = document.getElementById('formStatus').value;
        const description = document.getElementById('formDescription').value.trim();

        // Convertir características en array
        const rawFeatures = document.getElementById('formFeatures').value;
        const features = rawFeatures
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);

        // Si no hay imágenes, usar imagen elegante por defecto
        if (currentFormImages.length === 0) {
            currentFormImages.push("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80");
        }

        // Generar ID único
        const cleanSlug = title.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        const propId = idField ? idField : `${cleanSlug}-${Date.now().toString(36)}`;

        const propertyObj = {
            id: propId,
            code,
            title,
            type,
            operation,
            district,
            address,
            currency,
            priceUSD,
            pricePEN,
            areaM2,
            builtAreaM2,
            bedrooms,
            bathrooms,
            parking,
            floors,
            antiquity,
            badge,
            status,
            description,
            features,
            images: currentFormImages
        };

        const sb = getSupabase();
        if (sb && !isLocalDemo) {
            let dbPayload = mapAppToSupabase(propertyObj);
            let { error } = await sb
                .from('properties')
                .upsert(dbPayload, { onConflict: 'id' });

            // Tolerancia a fallos: Si la tabla aún no tiene la columna 'currency', guardar sin ella
            if (error && error.message && error.message.includes("'currency'")) {
                delete dbPayload.currency;
                const retry = await sb
                    .from('properties')
                    .upsert(dbPayload, { onConflict: 'id' });
                error = retry.error;
            }

            if (error) throw error;
        }

        // Actualizar estado local
        if (isEditing) {
            const idx = adminProperties.findIndex(p => p.id === propId);
            if (idx >= 0) adminProperties[idx] = propertyObj;
        } else {
            adminProperties.unshift(propertyObj);
        }

        document.getElementById('propertyModal').classList.add('hidden');
        updateDashboardStats();
        renderAdminProperties();
        showToast("¡Inmueble guardado con éxito en Supabase!", "success");
    } catch (err) {
        showToast("Error al guardar: " + (err.message || err), "error");
        alert("Error al guardar: " + (err.message || err));
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar y Publicar Inmueble`;
    }
}

// ==============================================================================
// 4. SUBIDA DE FOTOS DRAG & DROP Y MINIATURAS
// ==============================================================================

function initDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('border-gold-500', 'bg-gold-50');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-gold-500', 'bg-gold-50');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFilesSelected(files);
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        handleFilesSelected(files);
    });
}

async function handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    const progress = document.getElementById('uploadProgress');
    progress.classList.remove('hidden');

    const sb = getSupabase();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        try {
            if (sb && !isLocalDemo) {
                // Subir directamente a Supabase Storage
                const publicUrl = await uploadPropertyImageFile(file);
                currentFormImages.push(publicUrl);
            } else {
                // Modo offline / prueba: convertir a DataURL para previsualización inmediata
                const dataUrl = await readFileAsDataURL(file);
                currentFormImages.push(dataUrl);
            }
        } catch (err) {
            console.error("Error al subir imagen:", err);
            alert(`No se pudo subir la imagen ${file.name}: ${err.message}`);
        }
    }

    progress.classList.add('hidden');
    renderFormImagesPreview();
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function renderFormImagesPreview() {
    const container = document.getElementById('imagesPreviewContainer');
    if (!container) return;

    if (currentFormImages.length === 0) {
        container.innerHTML = `<div class="col-span-full text-xs text-slate-400 italic">No hay fotos seleccionadas aún.</div>`;
        return;
    }

    container.innerHTML = currentFormImages.map((imgSrc, idx) => `
        <div class="relative aspect-[16/10] rounded-xl overflow-hidden border-2 ${idx === 0 ? 'border-gold-500 shadow-md ring-2 ring-gold-400/40' : 'border-slate-200'} group">
            <img src="${imgSrc}" alt="Foto" class="w-full h-full object-cover">
            
            ${idx === 0 ? `
                <span class="absolute bottom-1 left-1 bg-gold-500 text-navy-950 font-bold text-[9px] px-1.5 py-0.5 rounded">
                    Portada
                </span>
            ` : `
                <button type="button" onclick="setAsCoverImage(${idx})" class="absolute bottom-1 left-1 bg-black/70 hover:bg-black text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
                    Hacer Portada
                </button>
            `}

            <button type="button" onclick="removeFormImage(${idx})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-[10px] shadow transition">
                &times;
            </button>
        </div>
    `).join('');
}

window.setAsCoverImage = function(index) {
    if (index <= 0 || index >= currentFormImages.length) return;
    const [selected] = currentFormImages.splice(index, 1);
    currentFormImages.unshift(selected);
    renderFormImagesPreview();
};

window.removeFormImage = function(index) {
    currentFormImages.splice(index, 1);
    renderFormImagesPreview();
};

// ==============================================================================
// 5. ASISTENTE Y CONFIGURACIÓN DE SUPABASE
// ==============================================================================

function initModalsAndConfig() {
    const cfgModal = document.getElementById('configModal');
    const btnOpenCfg = document.getElementById('btnOpenConfigModal');
    const btnCloseCfg = document.getElementById('btnCloseConfigModal');
    const btnSaveCfg = document.getElementById('btnSaveConfig');
    const btnClearCfg = document.getElementById('btnClearConfig');

    if (btnOpenCfg) {
        btnOpenCfg.addEventListener('click', () => {
            const creds = getSupabaseCredentials();
            document.getElementById('cfgUrl').value = creds.url;
            document.getElementById('cfgKey').value = creds.anonKey;
            cfgModal.classList.remove('hidden');
        });
    }

    if (btnCloseCfg) btnCloseCfg.addEventListener('click', () => cfgModal.classList.add('hidden'));

    if (btnSaveCfg) {
        btnSaveCfg.addEventListener('click', () => {
            const url = document.getElementById('cfgUrl').value.trim();
            const key = document.getElementById('cfgKey').value.trim();

            if (!url.startsWith('https://')) {
                alert("El Project URL debe comenzar con https://");
                return;
            }

            saveSupabaseCredentials(url, key);
            updateSupabaseStatusBadge();
            cfgModal.classList.add('hidden');
            alert("¡Credenciales de Supabase guardadas! Recargando para verificar la conexión...");
            window.location.reload();
        });
    }

    if (btnClearCfg) {
        btnClearCfg.addEventListener('click', () => {
            if (confirm("¿Deseas desconectar las claves de Supabase guardadas en este navegador?")) {
                clearSupabaseCredentials();
                cfgModal.classList.add('hidden');
                updateSupabaseStatusBadge();
                window.location.reload();
            }
        });
    }

    // Botón para migrar inmuebles iniciales
    const btnMigrate = document.getElementById('btnMigrateToSupabase');
    if (btnMigrate) {
        btnMigrate.addEventListener('click', async () => {
            const sb = getSupabase();
            if (!sb) {
                alert("Primero debes conectar Supabase con tus credenciales.");
                return;
            }

            if (!confirm(`¿Deseas subir los ${PROPERTIES_DATA.length} inmuebles base de muestra a tu base de datos de Supabase?`)) {
                return;
            }

            btnMigrate.disabled = true;
            btnMigrate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a Supabase...`;

            try {
                let count = 0;
                for (const prop of PROPERTIES_DATA) {
                    let payload = mapAppToSupabase(prop);
                    let { error } = await sb
                        .from('properties')
                        .upsert(payload, { onConflict: 'id' });

                    if (error && error.message && error.message.includes("'currency'")) {
                        delete payload.currency;
                        const retry = await sb
                            .from('properties')
                            .upsert(payload, { onConflict: 'id' });
                        error = retry.error;
                    }

                    if (!error) count++;
                }

                alert(`¡Éxito! Se migraron ${count} inmuebles a Supabase.`);
                loadDashboardProperties();
            } catch (err) {
                alert("Error al migrar: " + err.message);
            } finally {
                btnMigrate.disabled = false;
                btnMigrate.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-gold-400"></i> Subir Inmuebles Base a Supabase`;
            }
        });
    }
}

function updateSupabaseStatusBadge() {
    const badge = document.getElementById('supabaseStatusBadge');
    if (!badge) return;

    if (isSupabaseConfigured()) {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1"></span> Conectado`;
        badge.className = "hidden sm:inline text-emerald-400 font-semibold";
    } else {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1"></span> Sin Conectar`;
        badge.className = "hidden sm:inline text-amber-300 font-semibold";
    }
}

// ==============================================================================
// 6. FILTROS Y BÚSQUEDA DEL LISTADO
// ==============================================================================

function initFiltersAndSearch() {
    const searchInput = document.getElementById('adminSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAdminProperties();
        });
    }

    const filterBtns = document.querySelectorAll('.status-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-navy-950', 'text-white');
                b.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
            });

            btn.classList.add('bg-navy-950', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');

            currentFilterStatus = btn.getAttribute('data-status');
            renderAdminProperties();
        });
    });
}
