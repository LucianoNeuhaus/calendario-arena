// store.js - Gerenciamento de Dados (Integração Google Sheets / Apps Script)

const Store = (function () {
    // IMPORTANTE: Insira aqui a URL do seu app web gerado no Google Apps Script
    // Exemplo: 'https://script.google.com/macros/s/AKfycb.../exec'
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzilMoCGGk_mwUqMKw74Rr1FgdRcvdddaYfy8tNfZAYGq19PnM7F3YWIATpKauh9tfn/exec';

    let localClients = [];
    let localBookings = [];

    // Busca todos os dados do servidor ao abrir o aplicativo
    async function initSync() {
        if (!GAS_WEB_APP_URL) {
            console.warn("GAS_WEB_APP_URL não configurada. Usando LocalStorage como fallback temporário.");
            localClients = JSON.parse(localStorage.getItem('arena_clientes') || '[]');
            localBookings = JSON.parse(localStorage.getItem('arena_agendamentos') || '[]');
            return true;
        }

        try {
            const res = await fetch(GAS_WEB_APP_URL + "?action=sync");
            const data = await res.json();

            if (data.error) {
                console.error("Erro retornado do Apps Script:", data.error);
                throw new Error(data.error);
            }

            localClients = data.clients || [];
            localBookings = data.bookings || [];

            // Grava um cache offline
            localStorage.setItem('arena_clientes_cache', JSON.stringify(localClients));
            localStorage.setItem('arena_agendamentos_cache', JSON.stringify(localBookings));
            return true;
        } catch (err) {
            console.error("Erro sincronizando com Google Sheets:", err);
            alert("Não foi possível carregar os dados online. Carregando versão offline (somente leitura).");
            localClients = JSON.parse(localStorage.getItem('arena_clientes_cache') || '[]');
            localBookings = JSON.parse(localStorage.getItem('arena_agendamentos_cache') || '[]');
            return false;
        }
    }

    // Função interna para requisições em background (sem bloquear a UI)
    function backgroundSync(payload) {
        if (!GAS_WEB_APP_URL) {
            // Em modo offline temporário, salva no LocalStorage antigo para não perder
            localStorage.setItem('arena_clientes', JSON.stringify(localClients));
            localStorage.setItem('arena_agendamentos', JSON.stringify(localBookings));
            return;
        }

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' // Necessário para evitar preflight CORS restritivo do Apps Script
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) console.error("Erro no Apps Script:", data.error);
            })
            .catch(err => console.error("Erro de requisição background:", err));

        // Mantém cache super atual
        localStorage.setItem('arena_clientes_cache', JSON.stringify(localClients));
        localStorage.setItem('arena_agendamentos_cache', JSON.stringify(localBookings));
    }

    function getClients() {
        return localClients;
    }

    function saveClient(client) {
        if (!client.id) {
            client.id = 'cli_' + Date.now();
            localClients.push(client);
        } else {
            const index = localClients.findIndex(c => c.id === client.id);
            if (index > -1) {
                localClients[index] = client;
            } else {
                localClients.push(client);
            }
        }
        backgroundSync({ action: 'saveClient', client: client });
        return client;
    }

    function deleteClient(id) {
        localClients = localClients.filter(c => c.id !== id);
        backgroundSync({ action: 'deleteClient', id: id });
    }

    function getBookings() {
        return localBookings;
    }

    function saveBooking(booking) {
        if (!booking.id) {
            booking.id = 'bkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            localBookings.push(booking);
        } else {
            const index = localBookings.findIndex(b => b.id === booking.id);
            if (index > -1) localBookings[index] = booking;
            else localBookings.push(booking);
        }
        backgroundSync({ action: 'saveBooking', booking: booking });
        return booking;
    }

    function saveMultipleBookings(bookingsArr) {
        localBookings.push(...bookingsArr);
        backgroundSync({ action: 'saveMultipleBookings', bookings: bookingsArr });
    }

    function deleteBooking(id, deleteAllFuture = false) {
        const b = localBookings.find(x => x.id === id);
        if (!b) return;

        let recurrenceId = null;

        if (deleteAllFuture && b.recurrenceId) {
            recurrenceId = b.recurrenceId;
            const targetDate = new Date(b.date);
            localBookings = localBookings.filter(x => {
                if (x.recurrenceId === recurrenceId) {
                    return new Date(x.date) < targetDate && x.id !== id;
                }
                return true;
            });
        } else {
            localBookings = localBookings.filter(x => x.id !== id);
        }

        backgroundSync({ action: 'deleteBooking', id: id, deleteAllFuture: deleteAllFuture, recurrenceId: recurrenceId });
    }

    function getSystemBackup() {
        return {
            clients: getClients(),
            bookings: getBookings(),
            exportDate: new Date().toISOString()
        };
    }

    function restoreBackup(data) {
        if (data && typeof data === 'object') {
            if (data.clients) localClients = data.clients;
            if (data.bookings) localBookings = data.bookings;

            // Send to Apps script? Or array?
            // Restoring huge backup might be heavy for Apps Script row-by-row logic.
            // But doing it optimally would require a special 'restoreBackup' action.
            // For now, let's trigger it.
            if (data.clients) data.clients.forEach(c => backgroundSync({ action: 'saveClient', client: c }));
            if (data.bookings) backgroundSync({ action: 'saveMultipleBookings', bookings: data.bookings });

            return true;
        }
        return false;
    }

    return {
        initSync,
        getClients,
        saveClient,
        deleteClient,
        getBookings,
        saveBooking,
        saveMultipleBookings,
        deleteBooking,
        getSystemBackup,
        restoreBackup
    };
})();
