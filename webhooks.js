const WEBHOOK_TRANSACTION = "https://discord.com/api/webhooks/1485795847420772372/az3BlOR_KRD1auAlGNI7Pserm0fcu5B7zmN7L8tCmkVUL-AeI52ewrhnx8PahFmlY2YD";
const WEBHOOK_SHIFT = "https://discord.com/api/webhooks/1485795991251714258/ddpkSfMY8edAthRquT--v3M1GLlFlX5o4OAdcsyZxAdnlM48-hHMTxYBjX6TkQFSJNly";
const WEBHOOK_WEEKLY = "https://discord.com/api/webhooks/1493034525851123915/mSB0JB0Yi-wzmY-Lqsges7sJ_9iXop0qGqnWIwKCbJhHd5cnFqVjqGnLx8-zCA7t1_aJ"; // 🔥 Ustaw swój webhook dla podsumowania tygodniowego

// 🔥 LICZENIE PROWIZJI
function calculateCommission(profit, commissions){
    const role = localStorage.getItem("role");
    const percent = commissions[role] || 0;
    const value = Math.round((profit * percent) / 100);

    return { role, percent, value };
}

// 🔥 WEBHOOK TRANSAKCJI
async function sendTransactionWebhook({ list, buy, sell, custom, negotiation, profit, commissions }){
    const { role, percent, value } = calculateCommission(profit, commissions);

    const discordId = localStorage.getItem("discordId");
    const userTag = discordId ? `<@${discordId}>` : "Brak";

    await fetch(WEBHOOK_TRANSACTION, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "Nowa transakcja",
                color: 0x2b2d31,
                description:
`👤 Pracownik: ${userTag}

📦 Przedmioty:
${list}

💰 Skup: ${buy}$
💸 Lombard: ${sell}$
💵 Sprzedaż: ${custom}$

📉 Negocjacja: ${negotiation}$
📈 Zysk: ${profit}$

💼 Ranga: ${role || "Brak"}
💸 Prowizja (${percent}%): ${value}$`
            }]
        })
    });
}

// 🔥 WEBHOOK ZMIANY
async function sendShiftWebhook({ data, commissions }){
    let totalBuy = 0;
    let totalSell = 0;
    let totalFinal = 0;
    let combined = {};

    const role = localStorage.getItem("role");
    const percent = commissions[role] || 0;
    let totalCommission = 0;

    data.forEach(t=>{
        totalBuy += t.buyTotal;
        totalSell += t.sellTotal;
        totalFinal += (t.final || t.sellTotal);

        (t.items || []).forEach(i=>{
            combined[i.name] = (combined[i.name] || 0) + i.qty;
        });

        const profitSingle = t.sellTotal - (t.final || t.sellTotal);
        totalCommission += Math.round((profitSingle * percent) / 100);
    });

    let list = "";
    Object.entries(combined).forEach(([name, qty])=>{
        list += `• ${name} x${qty}\n`;
    });

    const negotiation = totalFinal - totalBuy;
    const profit = totalSell - totalFinal;

    const discordId = localStorage.getItem("discordId");
    const userTag = discordId ? `<@${discordId}>` : "Brak";

    await fetch(WEBHOOK_SHIFT, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "Zakończenie zmiany",
                color: 0x000000,
                description:
`👤 Pracownik: ${userTag}

📦 Przedmioty:
${list || "Brak"}

💰 Skup: ${totalBuy}$
💸 Lombard: ${totalSell}$
💵 Sprzedaż: ${totalFinal}$

📉 Negocjacja: ${negotiation}$
📈 Zysk: ${profit}$

💼 Ranga: ${role || "Brak"}
💸 Prowizja (${percent}%): ${totalCommission}$`
            }]
        })
    });
}

// 🔥 WEBHOOK TYGODNIOWEGO PODSUMOWANIA
async function sendWeeklyWebhook({ weeklyData, fromDate, toDate }){
    // Grupowanie danych po pracowniku (discordId)
    const workers = {};

    weeklyData.forEach(shift => {
        const id = shift.discordId || "unknown";

        if(!workers[id]){
            workers[id] = {
                discordId: id,
                role: shift.role,
                shifts: 0,
                totalBuy: 0,
                totalSell: 0,
                totalFinal: 0,
                totalProfit: 0,
                totalCommission: 0,
                items: {}
            };
        }

        const w = workers[id];
        w.shifts++;
        w.totalBuy += shift.totalBuy;
        w.totalSell += shift.totalSell;
        w.totalFinal += shift.totalFinal;
        w.totalProfit += shift.profit;
        w.totalCommission += shift.commission;

        Object.entries(shift.items || {}).forEach(([name, qty]) => {
            w.items[name] = (w.items[name] || 0) + qty;
        });
    });

    // Ogólne sumy
    let grandBuy = 0, grandSell = 0, grandFinal = 0, grandProfit = 0, grandCommission = 0;
    Object.values(workers).forEach(w => {
        grandBuy += w.totalBuy;
        grandSell += w.totalSell;
        grandFinal += w.totalFinal;
        grandProfit += w.totalProfit;
        grandCommission += w.totalCommission;
    });

    // Buduj opisy pracowników
    let workersDesc = "";
    Object.values(workers).forEach(w => {
        const tag = w.discordId !== "unknown" ? `<@${w.discordId}>` : "Brak ID";
        const itemList = Object.entries(w.items).map(([n, q]) => `• ${n} x${q}`).join("\n") || "Brak";

        workersDesc +=
`─────────────────────
👤 ${tag} | 💼 ${w.role || "Brak rangi"}
🔄 Zmiany: ${w.shifts}
📦 Przedmioty:\n${itemList}
💰 Skup: ${w.totalBuy}$
💸 Lombard: ${w.totalSell}$
💵 Sprzedaż: ${w.totalFinal}$
📈 Zysk: ${w.totalProfit}$
💸 Prowizja: ${w.totalCommission}$
`;
    });

    const description =
`📅 Okres: ${fromDate} — ${toDate}

${workersDesc}
═════════════════════
📊 **ŁĄCZNE PODSUMOWANIE**
💰 Skup: ${grandBuy}$
💸 Lombard: ${grandSell}$
💵 Sprzedaż: ${grandFinal}$
📈 Zysk: ${grandProfit}$
💸 Prowizje: ${grandCommission}$`;

    await fetch(WEBHOOK_WEEKLY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "📊 Tygodniowe Podsumowanie Lombardu",
                color: 0x4caf50,
                description
            }]
        })
    });
}
