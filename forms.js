// forms.js - Lógica dos formulários de agendamento (Quadra e Funcional)
window.AppForms = (function () {

    // --- Quadra ---
    const modalQuadra = 'modal-quadra';
    const formQuadra = document.getElementById('form-quadra');
    const qId = document.getElementById('quadra-id');
    const qSearch = document.getElementById('quadra-cliente-search');
    const qAutocomplete = document.getElementById('quadra-cliente-autocomplete');
    const qPhone = document.getElementById('quadra-telefone');
    const qDate = document.getElementById('quadra-data');
    const qTime = document.getElementById('quadra-hora');
    const qValue = document.getElementById('quadra-valor');
    const qIsRecurring = document.getElementById('quadra-is-recurring');
    const qRecurOpts = document.getElementById('quadra-recurrence-options');
    const qRecurDays = document.getElementById('quadra-recurrence-days');
    const qRecurCount = document.getElementById('quadra-recurrence-count');
    const btnDelQuadra = document.getElementById('btn-delete-quadra');

    let selectedClientId = null;

    // --- Funcional ---
    const modalFunc = 'modal-funcional';
    const formFunc = document.getElementById('form-funcional');
    const fId = document.getElementById('funcional-id');
    const fDate = document.getElementById('funcional-data');
    const fTime = document.getElementById('funcional-hora');
    const fValue = document.getElementById('funcional-valor');
    const fAddPartInput = document.getElementById('funcional-add-participant');
    const btnAddPart = document.getElementById('btn-add-participant');
    const fPartListEl = document.getElementById('funcional-participants-list');
    const btnDelFunc = document.getElementById('btn-delete-funcional');

    let currentParticipants = [];

    function init() {
        // Buttons to open modals
        document.getElementById('btn-novo-agendamento-quadra').addEventListener('click', () => openNewBooking('quadra'));
        document.getElementById('btn-novo-agendamento-funcional').addEventListener('click', () => openNewBooking('funcional'));

        // Quadra autocomplete
        qSearch.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            if (!val) {
                qAutocomplete.style.display = 'none';
                selectedClientId = null;
                return;
            }
            const clients = Store.getClients().filter(c => c.name.toLowerCase().includes(val));
            if (clients.length > 0) {
                qAutocomplete.innerHTML = clients.map(c => `
                    <div class="autocomplete-item" style="padding:10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.1);" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone}">
                        <strong>${c.name}</strong> - ${c.phone}
                    </div>
                `).join('');
                qAutocomplete.style.display = 'block';
            } else {
                qAutocomplete.innerHTML = `<div style="padding:10px; color:#aaa;">Nenhum cliente encontrado. Será salvo como novo.</div>`;
                qAutocomplete.style.display = 'block';
                selectedClientId = null;
            }
        });

        qAutocomplete.addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                selectedClientId = item.getAttribute('data-id');
                qSearch.value = item.getAttribute('data-name');
                qPhone.value = item.getAttribute('data-phone');
                qAutocomplete.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target !== qSearch && e.target !== qAutocomplete) {
                qAutocomplete.style.display = 'none';
            }
        });

        // Recurrence toggle
        qIsRecurring.addEventListener('change', (e) => {
            qRecurOpts.style.display = e.target.checked ? 'block' : 'none';
        });

        // Form Quadra Submit
        formQuadra.addEventListener('submit', (e) => {
            e.preventDefault();

            // Sunday Check
            const dateObj = new Date(qDate.value + 'T00:00:00');
            if (dateObj.getDay() === 0) { // 0 é Domingo
                if (!confirm("Atenção: Este agendamento está sendo feito em um DOMINGO. Deseja prosseguir?")) {
                    return;
                }
            }

            // Client Management
            let clientId = selectedClientId;
            let clientName = qSearch.value.trim();
            if (!clientId) {
                const newCli = Store.saveClient({ name: clientName, phone: qPhone.value.trim() });
                clientId = newCli.id;
                if (window.AppClients) window.AppClients.renderClients();
            } else {
                // Update phone if changed
                Store.saveClient({ id: clientId, name: clientName, phone: qPhone.value.trim() });
            }

            const baseBooking = {
                type: 'quadra',
                clientId: clientId,
                clientName: clientName,
                time: qTime.value,
                price: parseFloat(qValue.value)
            };

            if (qId.value) {
                // Edit existing
                baseBooking.id = qId.value;
                baseBooking.date = qDate.value;
                // keep existing recurrenceId if any
                const existing = Store.getBookings().find(b => b.id === qId.value);
                if (existing && existing.recurrenceId) baseBooking.recurrenceId = existing.recurrenceId;
                Store.saveBooking(baseBooking);
            } else {
                // New Booking
                if (qIsRecurring.checked) {
                    const days = parseInt(qRecurDays.value);
                    const count = parseInt(qRecurCount.value);
                    const groupId = 'grp_' + Date.now();

                    const bookingsToSave = [];
                    for (let i = 0; i < count; i++) {
                        const d = new Date(dateObj);
                        d.setDate(d.getDate() + (i * days));
                        const yyyymmdd = d.toISOString().split('T')[0];
                        bookingsToSave.push({
                            ...baseBooking,
                            id: 'bkg_' + Date.now() + '_' + i,
                            date: yyyymmdd,
                            recurrenceId: groupId
                        });
                    }
                    Store.saveMultipleBookings(bookingsToSave);
                } else {
                    baseBooking.date = qDate.value;
                    Store.saveBooking(baseBooking);
                }
            }

            window.AppModals.closeModal();
            window.CalendarApp.renderCalendar('quadra');
        });

        btnDelQuadra.addEventListener('click', () => {
            const id = qId.value;
            if (!id) return;

            const b = Store.getBookings().find(x => x.id === id);
            if (b && b.recurrenceId) {
                const opt = confirm("Este agendamento faz parte de uma recorrência.\nClique em OK para APAGAR ESTE E TODOS OS FUTUROS.\nClique em Cancelar para APAGAR APENAS ESTE.");
                Store.deleteBooking(id, opt); // opt true = delete all future
            } else {
                if (confirm("Tem certeza que deseja apagar este agendamento?")) {
                    Store.deleteBooking(id, false);
                }
            }
            window.AppModals.closeModal();
            window.CalendarApp.renderCalendar('quadra');
        });

        // --- Funcional Logic ---
        btnAddPart.addEventListener('click', addParticipant);
        fAddPartInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addParticipant();
            }
        });

        function addParticipant() {
            const name = fAddPartInput.value.trim();
            if (!name) return;
            currentParticipants.push({ name: name, id: 'p_' + Date.now() });
            fAddPartInput.value = '';
            renderParticipants();
        }

        function renderParticipants() {
            fPartListEl.innerHTML = currentParticipants.map(p => `
                <li style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <span>${p.name}</span>
                    <button type="button" class="btn-icon" style="background:var(--danger); width:24px; height:24px; font-size:12px;" onclick="window.AppForms.removeParticipant('${p.id}')">X</button>
                </li>
            `).join('');
        }

        formFunc.addEventListener('submit', (e) => {
            e.preventDefault();

            const baseBooking = {
                type: 'funcional',
                date: fDate.value,
                time: fTime.value,
                price: parseFloat(fValue.value),
                participants: currentParticipants
            };

            if (fId.value) {
                baseBooking.id = fId.value;
            }
            Store.saveBooking(baseBooking);

            window.AppModals.closeModal();
            window.CalendarApp.renderCalendar('funcional');
        });

        btnDelFunc.addEventListener('click', () => {
            const id = fId.value;
            if (!id) return;
            if (confirm("Tem certeza que deseja apagar esta turma?")) {
                Store.deleteBooking(id, false);
                window.AppModals.closeModal();
                window.CalendarApp.renderCalendar('funcional');
            }
        });
    }

    // Exported for inline onclick
    function removeParticipant(id) {
        currentParticipants = currentParticipants.filter(p => p.id !== id);
        fPartListEl.innerHTML = currentParticipants.map(p => `
            <li style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <span>${p.name}</span>
                <button type="button" class="btn-icon" style="background:var(--danger); width:24px; height:24px; font-size:12px;" onclick="window.AppForms.removeParticipant('${p.id}')">X</button>
            </li>
        `).join('');
    }

    function openNewBooking(type, dateStr = null) {
        if (type === 'quadra') {
            formQuadra.reset();
            qId.value = '';
            selectedClientId = null;
            qIsRecurring.checked = false;
            qIsRecurring.disabled = false; // can recur on new
            qRecurOpts.style.display = 'none';
            btnDelQuadra.style.display = 'none';
            if (dateStr) qDate.value = dateStr;
            else qDate.value = new Date().toISOString().split('T')[0];

            document.getElementById('modal-quadra-title').textContent = "Novo Agendamento - Quadra";
            window.AppModals.openModal(modalQuadra);
        } else {
            formFunc.reset();
            fId.value = '';
            currentParticipants = [];
            fPartListEl.innerHTML = '';
            btnDelFunc.style.display = 'none';
            if (dateStr) fDate.value = dateStr;
            else fDate.value = new Date().toISOString().split('T')[0];

            document.getElementById('modal-funcional-title').textContent = "Nova Turma Funcional";
            window.AppModals.openModal(modalFunc);
        }
    }

    function editBooking(id) {
        const b = Store.getBookings().find(x => x.id === id);
        if (!b) return;

        if (b.type === 'quadra') {
            formQuadra.reset();
            qId.value = b.id;
            selectedClientId = b.clientId || null;
            qSearch.value = b.clientName || '';

            const cli = Store.getClients().find(x => x.id === b.clientId);
            qPhone.value = cli ? cli.phone : '';

            qDate.value = b.date;
            qTime.value = b.time;
            qValue.value = b.price || 100;

            qIsRecurring.checked = false;
            qIsRecurring.disabled = true; // disable recurrent creation on edit
            qRecurOpts.style.display = 'none';

            btnDelQuadra.style.display = 'inline-block';
            document.getElementById('modal-quadra-title').textContent = "Editar Agendamento";
            window.AppModals.openModal(modalQuadra);
        } else {
            formFunc.reset();
            fId.value = b.id;
            fDate.value = b.date;
            fTime.value = b.time;
            fValue.value = b.price || 60;
            currentParticipants = b.participants || [];

            function renderParticipantsLocal() {
                fPartListEl.innerHTML = currentParticipants.map(p => `
                    <li style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                        <span>${p.name}</span>
                        <button type="button" class="btn-icon" style="background:var(--danger); width:24px; height:24px; font-size:12px;" onclick="window.AppForms.removeParticipant('${p.id}')">X</button>
                    </li>
                `).join('');
            }
            renderParticipantsLocal();

            btnDelFunc.style.display = 'inline-block';
            document.getElementById('modal-funcional-title').textContent = "Editar Turma";
            window.AppModals.openModal(modalFunc);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        openNewBooking,
        editBooking,
        removeParticipant
    };
})();
