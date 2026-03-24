const WEBHOOK_TRANSACTION = "https://discord.com/api/webhooks/1485795847420772372/az3BlOR_KRD1auAlGNI7Pserm0fcu5B7zmN7L8tCmkVUL-AeI52ewrhnx8PahFmlY2YD";
const WEBHOOK_SHIFT = "https://discord.com/api/webhooks/1485795991251714258/ddpkSfMY8edAthRquT--v3M1GLlFlX5o4OAdcsyZxAdnlM48-hHMTxYBjX6TkQFSJNly";

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
