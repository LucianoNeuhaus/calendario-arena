// app.js - Navegação, Modais e Clientes UI
document.addEventListener('DOMContentLoaded', async () => {

    // --- Sincronização Inicial com Google Sheets ---
    const loadingEl = document.getElementById('global-loading');
    if (loadingEl) {
        await Store.initSync();
        loadingEl.style.opacity = '0';
        setTimeout(() => {
            loadingEl.remove();
            // Re-render after fetch
            if (window.AppClients) window.AppClients.renderClients();
            if (window.CalendarApp) {
                window.CalendarApp.renderCalendar('quadra');
                window.CalendarApp.renderCalendar('funcional');
            }
            // Verifica se tem dashboard ativo para re-renderizar
            const activeNav = document.querySelector('.nav-links li.active');
            if (activeNav && activeNav.getAttribute('data-target') === 'view-dashboard') {
                activeNav.click();
            }
        }, 500);
    }

    // --- Navegação entre Abas ---
    const navItems = document.querySelectorAll('.nav-links li');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all
            navItems.forEach(nav => nav.classList.remove('active'));
            viewSections.forEach(section => section.classList.remove('active'));

            // Set active to clicked
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Re-render specifics if needed
            if (targetId === 'view-clientes') {
                renderClients();
            } else if (targetId === 'view-dashboard') {
                renderDashboard();
            } else if (targetId === 'view-quadra') {
                if (window.CalendarApp) window.CalendarApp.renderCalendar('quadra');
            } else if (targetId === 'view-funcional') {
                if (window.CalendarApp) window.CalendarApp.renderCalendar('funcional');
            }
        });
    });

    // --- Modal Logic ---
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.btn-close');

    function openModal(modalId) {
        modalBackdrop.classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
    }

    function closeModal() {
        modalBackdrop.classList.add('hidden');
        modals.forEach(m => m.classList.add('hidden'));
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
    });

    window.AppModals = { openModal, closeModal };

    // --- ABA: GERENCIAR CLIENTES ---
    const clientsListEl = document.getElementById('clients-list');
    const searchClientInput = document.getElementById('search-cliente');
    const btnNovoCliente = document.getElementById('btn-novo-cliente');

    // Modal Elementos
    const formCliente = document.getElementById('form-cliente');
    const inputNome = document.getElementById('cliente-nome');
    const inputTelefone = document.getElementById('cliente-telefone');
    const inputId = document.getElementById('cliente-id');
    const modalTitle = document.getElementById('modal-cliente-title');

    function renderClients(filter = "") {
        const clients = Store.getClients();
        clientsListEl.innerHTML = '';

        const filtered = clients.filter(c =>
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.phone.includes(filter)
        );

        if (filtered.length === 0) {
            clientsListEl.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted)">Nenhum cliente encontrado.</td></tr>`;
            return;
        }

        filtered.forEach(client => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${client.name}</td>
                <td>${client.phone}</td>
                <td>
                    <button class="btn-icon btn-edit-client" data-id="${client.id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-del-client" data-id="${client.id}" title="Excluir">🗑️</button>
                </td>
            `;
            clientsListEl.appendChild(tr);
        });

        // Attach events
        document.querySelectorAll('.btn-edit-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const client = Store.getClients().find(c => c.id === id);
                if (client) {
                    inputId.value = client.id;
                    inputNome.value = client.name;
                    inputTelefone.value = client.phone;
                    modalTitle.textContent = "Editar Cliente";
                    openModal('modal-cliente');
                }
            });
        });

        document.querySelectorAll('.btn-del-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Tem certeza que deseja excluir este cliente?')) {
                    Store.deleteClient(id);
                    renderClients(searchClientInput.value);
                }
            });
        });
    }

    // Modal Events
    btnNovoCliente.addEventListener('click', () => {
        formCliente.reset();
        inputId.value = '';
        modalTitle.textContent = "Novo Cliente";
        openModal('modal-cliente');
    });

    formCliente.addEventListener('submit', (e) => {
        e.preventDefault();
        const client = {
            id: inputId.value || null,
            name: inputNome.value.trim(),
            phone: inputTelefone.value.trim()
        };
        Store.saveClient(client);
        closeModal();
        renderClients(searchClientInput.value);
    });

    searchClientInput.addEventListener('input', (e) => {
        renderClients(e.target.value);
    });

    window.AppClients = { renderClients }; // Export for other modules

    // --- ABA: DASHBOARD FINANCEIRO ---
    function renderDashboard() {
        const bookings = Store.getBookings();
        const todayStr = new Date().toISOString().split('T')[0];

        let monthRecQuadra = 0, monthRecFunc = 0;
        let monthPrevQuadra = 0, monthPrevFunc = 0;
        let weekRecQuadra = 0, weekRecFunc = 0;
        let weekPrevQuadra = 0, weekPrevFunc = 0;

        const today = new Date(todayStr + "T00:00:00");
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        bookings.forEach(b => {
            if (!b.price || !b.date) return;
            const bDate = new Date(b.date + "T00:00:00");
            const val = parseFloat(b.price);
            const isQuadra = b.type === 'quadra';

            if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
                if (bDate <= today) {
                    if (isQuadra) monthRecQuadra += val; else monthRecFunc += val;
                } else {
                    if (isQuadra) monthPrevQuadra += val; else monthPrevFunc += val;
                }
            }

            if (bDate >= startOfWeek && bDate <= endOfWeek) {
                if (bDate <= today) {
                    if (isQuadra) weekRecQuadra += val; else weekRecFunc += val;
                } else {
                    if (isQuadra) weekPrevQuadra += val; else weekPrevFunc += val;
                }
            }
        });

        const formatBRL = (num) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        document.getElementById('dash-month-quadra-rec').textContent = formatBRL(monthRecQuadra);
        document.getElementById('dash-month-func-rec').textContent = formatBRL(monthRecFunc);
        document.getElementById('dash-month-total-rec').textContent = formatBRL(monthRecQuadra + monthRecFunc);

        document.getElementById('dash-month-quadra-prev').textContent = formatBRL(monthPrevQuadra);
        document.getElementById('dash-month-func-prev').textContent = formatBRL(monthPrevFunc);
        document.getElementById('dash-month-total-prev').textContent = formatBRL(monthPrevQuadra + monthPrevFunc);

        document.getElementById('dash-week-quadra-rec').textContent = formatBRL(weekRecQuadra);
        document.getElementById('dash-week-func-rec').textContent = formatBRL(weekRecFunc);
        document.getElementById('dash-week-total-rec').textContent = formatBRL(weekRecQuadra + weekRecFunc);

        document.getElementById('dash-week-quadra-prev').textContent = formatBRL(weekPrevQuadra);
        document.getElementById('dash-week-func-prev').textContent = formatBRL(weekPrevFunc);
        document.getElementById('dash-week-total-prev').textContent = formatBRL(weekPrevQuadra + weekPrevFunc);
    }

    // --- ABA: BACKUP E DADOS ---
    const btnExport = document.getElementById('btn-export-backup');
    const btnTriggerImport = document.getElementById('btn-trigger-import');
    const fileImport = document.getElementById('file-import-backup');

    btnExport.addEventListener('click', () => {
        const data = Store.getSystemBackup();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `arena_eldorado_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    btnTriggerImport.addEventListener('click', () => {
        fileImport.click();
    });

    fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if (Store.restoreBackup(data)) {
                    alert("Dados restaurados com sucesso!");
                    window.location.reload(); // Reload to refresh all views
                } else {
                    alert("Formato de arquivo inválido.");
                }
            } catch (err) {
                alert("Erro ao ler o arquivo: " + err.message);
            }
            fileImport.value = ''; // Reset
        };
        reader.readAsText(file);
    });

    // Initial Render
    renderClients();
});
