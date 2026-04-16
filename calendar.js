// calendar.js - Lógica de renderização de calendários
window.CalendarApp = (function () {

    const state = {
        quadra: { date: new Date(), view: 'mensal' },
        funcional: { date: new Date(), view: 'mensal' }
    };

    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    function init() {
        // Attach toggles
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                const tab = e.target.closest('.view-section').id.replace('view-', '');

                // update UI toggles
                e.target.parentNode.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                state[tab].view = view;
                renderCalendar(tab);
            });
        });

        // Attach Navigations
        if (document.getElementById('btn-prev-month-quadra')) {
            document.getElementById('btn-prev-month-quadra').addEventListener('click', () => changeDate('quadra', -1));
            document.getElementById('btn-next-month-quadra').addEventListener('click', () => changeDate('quadra', 1));

            document.getElementById('btn-prev-month-funcional').addEventListener('click', () => changeDate('funcional', -1));
            document.getElementById('btn-next-month-funcional').addEventListener('click', () => changeDate('funcional', 1));
        }

        renderCalendar('quadra');
        renderCalendar('funcional');
    }

    function changeDate(tab, offset) {
        const d = state[tab].date;
        const view = state[tab].view;
        if (view === 'mensal') d.setMonth(d.getMonth() + offset);
        else if (view === 'semanal') d.setDate(d.getDate() + (offset * 7));
        else d.setDate(d.getDate() + offset);
        renderCalendar(tab);
    }

    function formatTitle(date, view) {
        if (view === 'mensal') return `${months[date.getMonth()]} ${date.getFullYear()}`;
        if (view === 'semanal') {
            const start = new Date(date);
            start.setDate(date.getDate() - date.getDay());
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return `${start.getDate()} ${months[start.getMonth()].substr(0, 3)} - ${end.getDate()} ${months[end.getMonth()].substr(0, 3)} ${date.getFullYear()}`;
        }
        return `${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    function getDaysForView(date, view) {
        const days = [];
        if (view === 'mensal') {
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Previous month padding
            const prevMonthDays = new Date(year, month, 0).getDate();
            for (let i = firstDay - 1; i >= 0; i--) {
                days.push({ d: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
            }
            // Current month
            for (let i = 1; i <= daysInMonth; i++) {
                days.push({ d: new Date(year, month, i), currentMonth: true });
            }
            // Next month padding
            let nextDays = 42 - days.length; // 6 rows of 7
            for (let i = 1; i <= nextDays; i++) {
                days.push({ d: new Date(year, month + 1, i), currentMonth: false });
            }
        } else if (view === 'semanal') {
            const start = new Date(date);
            start.setDate(date.getDate() - date.getDay());
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                days.push({ d: d, currentMonth: true });
            }
        } else {
            // Diario
            days.push({ d: new Date(date), currentMonth: true });
        }
        return days;
    }

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    function renderCalendar(tab) {
        const container = document.getElementById(`calendar-${tab}`);
        const titleEl = document.getElementById(`current-month-${tab}`);
        if (!container || !titleEl) return;

        const config = state[tab];
        titleEl.textContent = formatTitle(config.date, config.view);

        const days = getDaysForView(config.date, config.view);
        const allBookings = Store.getBookings().filter(b => b.type === tab);

        let html = '';
        if (config.view === 'mensal' || config.view === 'semanal') {
            html += `<div class="calendar-grid" style="grid-template-columns: repeat(7, 1fr);">`;
            // Headers
            weekDays.forEach(w => html += `<div class="calendar-day-header">${w}</div>`);
        } else {
            html += `<div class="calendar-grid" style="grid-template-columns: 1fr;">`;
            html += `<div class="calendar-day-header">${weekDays[config.date.getDay()]} - ${config.date.getDate()} de ${months[config.date.getMonth()]}</div>`;
        }

        const today = new Date();

        days.forEach(dayObj => {
            const d = dayObj.d;
            const isToday = isSameDay(d, today);
            const classes = ['calendar-cell'];
            if (!dayObj.currentMonth) classes.push('other-month');
            if (isToday) classes.push('today');

            // Find bookings for this day
            const dayBookings = allBookings.filter(b => {
                // Parse date safely
                const bDateParts = b.date.split('-');
                const bDate = new Date(bDateParts[0], bDateParts[1] - 1, bDateParts[2]);
                return isSameDay(bDate, d);
            });
            // Sort by time
            dayBookings.sort((a, b) => a.time.localeCompare(b.time));

            let eventsHtml = '';
            dayBookings.forEach(b => {
                let badgeClass = tab === 'funcional' ? 'funcional' : '';
                let titleText = tab === 'quadra' ? `${b.time} - ${b.clientName}` : `${b.time} - Turma (${b.participants?.length || 0})`;
                eventsHtml += `<div class="event-badge ${badgeClass}" onclick="window.AppForms.editBooking('${b.id}')">${titleText}</div>`;
            });

            const dayNum = d.getDate();
            // Create YYYY-MM-DD safely
            const yyyymmdd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            html += `
                <div class="${classes.join(' ')}" onclick="window.AppForms.openNewBooking('${tab}', '${yyyymmdd}')">
                    <span class="day-number">${config.view === 'diario' ? '' : dayNum}</span>
                    ${eventsHtml}
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Prevent cell click when clicking on event badge
        const badges = container.querySelectorAll('.event-badge');
        badges.forEach(badge => badge.addEventListener('click', (e) => e.stopPropagation()));
    }

    document.addEventListener('DOMContentLoaded', init);

    return { renderCalendar };
})();
